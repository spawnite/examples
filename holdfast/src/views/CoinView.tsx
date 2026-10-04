import { useFrame } from "@react-three/fiber";
import type { Entity } from "koota";
import { useWorld } from "koota/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import {
    AdditiveBlending,
    CanvasTexture,
    Color,
    CylinderGeometry,
    DynamicDrawUsage,
    Euler,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
    Quaternion,
    SRGBColorSpace,
    TorusGeometry,
    Vector3,
    type BufferAttribute,
    type BufferGeometry,
    type Material,
    type Texture,
} from "three";
import {
    findPlayerHero,
    TransformTrait,
    useEvent,
    useHeadless,
} from "@spawnite/engine";
import { readCoinPitch } from "../audio/Cues";
import { playSound, Sound } from "../audio/sounds";
import { mostBurstCoins } from "../siege/coins";
import { CoinBurstsTrait, type CoinBurst } from "../siege/traits";
import { popCoin } from "./effects/coinPop";
import { readGlowTexture } from "./glowTexture";
import { addLatePose } from "./warden/latePoses";

//  The coins a monster drops, as every page draws them: each warden's share
//  pops out of the monster in a spray of gold discs, hangs a moment, then
//  streaks to her, wherever she runs, and bursts into gold as it lands. Her
//  own chime a step higher each, and her purse on the HUD counts each as it
//  lands. Every coin is one instance in four draws shared by all of them.

/** Coins drawn at most; past it the newest land at once. */
const capacity = 512;
/** Metres from a coin's middle to its rim. */
const coinRadius = 0.15;
/** Metres across a flying coin's streak, and at its widest a glint's star
 *  over its smallest. */
const streakMetres = 0.5;
const glintMetres = 0.38;
const glintBaseMetres = 0.08;
/** Metres over the monster's feet a coin pops from, and over a warden's
 *  feet it flies to. */
const popHeight = 1;
const chestHeight = 1.1;
/** Seconds a coin rises and falls before it turns for its warden, and the
 *  most a launch staggers the coins of one burst. */
const popSeconds = 0.42;
const staggerSeconds = 0.09;
/** Metres a second a coin pops up and out at, the gravity that turns it,
 *  and how fast it flies home: from the first speed to the last over the
 *  seconds given, steering onto its warden as it goes. */
const popUp = { least: 4.5, most: 6.5 };
const popOut = { least: 1.2, most: 2.8 };
const gravity = 13;
const homeSpeed = { first: 7, last: 30, seconds: 0.55 };
const steerRate = 9;
/** Metres from her chest at which a coin has landed, and the seconds after
 *  which one lands wherever it is. */
const landMetres = 0.45;
const longestSeconds = 2.5;
/** Metres across a coin's glow, and metres of streak per metre a second
 *  of flight. */
const glowMetres = 0.42;
const streakPerSpeed = 0.035;
/** Metres a second over which a coin draws as flying. */
const flyingSpeed = 4;
/** Seconds between two glints of one coin, and how long a glint lasts. */
const glintSeconds = 0.9;
const glintLength = 0.22;
/** Times its size a teammate's coin pops at, so her own read first. */
const teammatePop = 0.55;

/** Her own coins in flight, which her purse on the HUD holds back until
 *  each lands. */
export const useCoinsInFlight = create<{ coins: number }>(() => ({
    coins: 0,
}));

const faceGeometry = new CylinderGeometry(
    coinRadius,
    coinRadius,
    coinRadius * 0.24,
    20,
);
const rimGeometry = new TorusGeometry(coinRadius, coinRadius * 0.14, 6, 20);
const quad = new PlaneGeometry(1, 1);
//  Metal the scene lights, so the face catches the fire and the sky as it
//  turns, over a low warmth of its own that keeps it gold in the dusk and
//  well under the bloom's threshold: a coin glints, it does not shine.
const gold = new MeshStandardMaterial({
    color: "#e8b04a",
    metalness: 0.85,
    roughness: 0.32,
    emissive: "#ffb347",
    emissiveIntensity: 0.4,
});
const rim = new MeshStandardMaterial({
    color: "#f6d27e",
    metalness: 0.9,
    roughness: 0.25,
    emissive: "#ffc766",
    emissiveIntensity: 0.4,
});
const glowColor = new Color("#ffb52e").multiplyScalar(0.22);
const streakColor = new Color("#ffd27a").multiplyScalar(0.8);
/** A glint burns past white, so the bloom takes it: small and brief. */
const glintColor = new Color("#fff6d8").multiplyScalar(1.8);
/** The disc's face stands on its edge. */
const upright = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
const upAxis = new Vector3(0, 1, 0);

/** A coin in flight on this page. */
interface FlyingCoin {
    to: Entity | null;
    own: boolean;
    /** Whole coins it carries into her purse. */
    value: number;
    place: Vector3;
    velocity: Vector3;
    /** Seconds since it popped; below zero, it waits in the monster. */
    age: number;
    spin: number;
    /** Where it flies once its warden has left the page. */
    last: Vector3;
}

const flying: FlyingCoin[] = [];

//  Written in place for each coin.
const target = new Vector3();
const toward = new Vector3();

/** A random number between `least` and `most`. */
function between({ least, most }: { least: number; most: number }) {
    return least + Math.random() * (most - least);
}

/** Writes where `coin` flies into `target`: her chest, or where she last
 *  stood. */
function aimCoin(coin: FlyingCoin) {
    const feet = coin.to?.isAlive() ? coin.to.get(TransformTrait) : undefined;
    if (feet) coin.last.set(feet.x, feet.y + chestHeight, feet.z);
    return target.copy(coin.last);
}

/** Puts a burst's coins in flight: its whole coins, a handful at most,
 *  each worth its part. */
function launchBurst(burst: CoinBurst, own: boolean) {
    const count = Math.min(burst.coins, mostBurstCoins);
    for (let index = 0; index < count; index++) {
        const value =
            Math.floor(burst.coins / count) +
            (index < burst.coins % count ? 1 : 0);
        if (flying.length >= capacity) {
            if (own) landOwn(value);
            continue;
        }
        const angle = Math.random() * Math.PI * 2;
        const out = between(popOut);
        const coin: FlyingCoin = {
            to: burst.to,
            own,
            value,
            place: new Vector3(burst.x, burst.y + popHeight, burst.z),
            velocity: new Vector3(
                Math.sin(angle) * out,
                between(popUp),
                Math.cos(angle) * out,
            ),
            age: -Math.random() * staggerSeconds,
            spin: Math.random() * Math.PI * 2,
            last: new Vector3(burst.x, burst.y + popHeight, burst.z),
        };
        aimCoin(coin);
        flying.push(coin);
        if (own)
            useCoinsInFlight.setState((state) => ({
                coins: state.coins + value,
            }));
    }
}

/** The run of her own coins landing close together, which climbs a scale. */
const coinRun = { run: 0, at: -Infinity };
/** Milliseconds between two coins within which the second chimes a step
 *  higher. */
const coinRunMilliseconds = 400;

/** One of her own coins in her purse: its chime, a step up a quick run. */
function landOwn(value: number) {
    const now = performance.now();
    coinRun.run = now - coinRun.at < coinRunMilliseconds ? coinRun.run + 1 : 0;
    coinRun.at = now;
    playSound(Sound.Coin, { pitch: readCoinPitch(coinRun.run) });
    useCoinsInFlight.setState((state) => ({
        coins: Math.max(0, state.coins - value),
    }));
}

/** Moves every coin on by `delta` seconds, landing each that reached its
 *  warden. */
function flyCoins(delta: number) {
    for (let index = flying.length - 1; index >= 0; index--) {
        const coin = flying[index];
        coin.age += delta;
        if (coin.age < 0) continue;
        coin.spin += delta * (6 + coin.velocity.length() * 0.8);
        if (coin.age < popSeconds) {
            coin.velocity.y -= gravity * delta;
            coin.place.addScaledVector(coin.velocity, delta);
            continue;
        }
        const home = aimCoin(coin);
        const distance = home.distanceTo(coin.place);
        if (distance < landMetres || coin.age > longestSeconds) {
            popCoin(coin.place, coin.own ? 1 : teammatePop);
            if (coin.own) landOwn(coin.value);
            flying[index] = flying[flying.length - 1];
            flying.pop();
            continue;
        }
        const ramp = Math.min(1, (coin.age - popSeconds) / homeSpeed.seconds);
        const speed =
            homeSpeed.first + (homeSpeed.last - homeSpeed.first) * ramp * ramp;
        toward.subVectors(home, coin.place).normalize().multiplyScalar(speed);
        coin.velocity.lerp(toward, Math.min(1, delta * steerRate));
        const step = coin.velocity.length() * delta;
        //  Never past her.
        if (step > distance) coin.place.copy(home);
        else coin.place.addScaledVector(coin.velocity, delta);
    }
}

interface Layer {
    geometry: BufferGeometry;
    material: Material;
    colored: boolean;
}

function createLayer({ geometry, material, colored }: Layer) {
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    if (colored)
        mesh.instanceColor = new InstancedBufferAttribute(
            new Float32Array(capacity * 3),
            3,
        ).setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
}

function createAddedGlow(map: Texture) {
    return new MeshBasicMaterial({
        map,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
}

/** Pixels across the glint's texture. */
const sparkleSize = 128;

/** A coin's glint: a pinpoint with four long, thin rays and four short
 *  ones between them, so it twinkles off the metal rather than covering
 *  the coin in a soft flare as the muzzle's star does. */
function paintSparkle() {
    const canvas = document.createElement("canvas");
    canvas.width = sparkleSize;
    canvas.height = sparkleSize;
    const context = canvas.getContext("2d");
    const middle = sparkleSize / 2;
    if (context) {
        const core = context.createRadialGradient(
            middle,
            middle,
            0,
            middle,
            middle,
            middle * 0.18,
        );
        core.addColorStop(0, "rgba(255,255,255,1)");
        core.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = core;
        context.fillRect(0, 0, sparkleSize, sparkleSize);
        context.translate(middle, middle);
        context.fillStyle = "rgba(255,255,255,0.95)";
        for (let ray = 0; ray < 8; ray++) {
            const reach = middle * (ray % 2 === 0 ? 0.98 : 0.42);
            const width = ray % 2 === 0 ? 2.2 : 1.4;
            context.beginPath();
            context.moveTo(0, -width);
            context.quadraticCurveTo(reach * 0.35, -width * 0.4, reach, 0);
            context.quadraticCurveTo(reach * 0.35, width * 0.4, 0, width);
            context.fill();
            context.rotate(Math.PI / 4);
        }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

//  Written in place for each coin each frame.
const matrix = new Matrix4();
const turn = new Quaternion();
const spinTurn = new Quaternion();
const scale = new Vector3();
const along = new Vector3();
const side = new Vector3();
const facing = new Vector3();
const toCamera = new Vector3();
const cameraPlace = new Vector3();
const cameraRight = new Vector3();
const cameraUp = new Vector3();
const place = new Vector3();
const tint = new Color();

/** Draws every coin in flight, once for the scene; the room draws none. */
export function CoinField() {
    return useHeadless() ? null : <DrawnCoinField />;
}

function DrawnCoinField() {
    const world = useWorld();
    const glows = useMemo(
        () => ({
            glow: createAddedGlow(readGlowTexture()),
            glint: createAddedGlow(paintSparkle()),
        }),
        [],
    );
    const layers = useMemo(
        () => ({
            face: createLayer({
                geometry: faceGeometry,
                material: gold,
                colored: false,
            }),
            rim: createLayer({
                geometry: rimGeometry,
                material: rim,
                colored: false,
            }),
            glow: createLayer({
                geometry: quad,
                material: glows.glow,
                colored: true,
            }),
            glint: createLayer({
                geometry: quad,
                material: glows.glint,
                colored: true,
            }),
        }),
        [glows],
    );
    useLayoutEffect(
        () => () => {
            for (const mesh of Object.values(layers)) mesh.dispose();
            for (const material of Object.values(glows)) material.dispose();
            //  A page that leaves the scene lands nothing it still flies.
            flying.length = 0;
            useCoinsInFlight.setState({ coins: 0 });
            //  The glow's texture is shared; the sparkle is the field's own.
            glows.glint.map?.dispose();
        },
        [layers, glows],
    );

    useEvent(CoinBurstsTrait, (siege) => {
        const hero = findPlayerHero(world);
        for (const burst of siege.get(CoinBurstsTrait)?.bursts ?? [])
            launchBurst(burst, burst.to !== null && burst.to === hero);
    });

    const nowRef = useRef(0);
    useFrame(({ clock }, delta) => {
        nowRef.current = clock.elapsedTime;
        flyCoins(Math.min(delta, 0.1));
    });

    useEffect(
        () =>
            //  Each camera that draws the coins gets them facing it.
            addLatePose((camera) => {
                cameraPlace.setFromMatrixPosition(camera.matrixWorld);
                cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
                cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
                drawCoins(layers, nowRef.current);
            }),
        [layers],
    );

    return (
        <>
            <primitive object={layers.face} />
            <primitive object={layers.rim} />
            <primitive object={layers.glow} />
            <primitive object={layers.glint} />
        </>
    );
}

type Layers = Record<"face" | "rim" | "glow" | "glint", InstancedMesh>;

/** Writes every coin's four instances for this frame and camera. */
function drawCoins(layers: Layers, now: number) {
    let slot = 0;
    for (const coin of flying) {
        if (coin.age < 0) continue;
        place.copy(coin.place);
        const speed = coin.velocity.length();
        const streaking = Math.min(
            1,
            Math.max(0, (speed - flyingSpeed) / flyingSpeed),
        );
        //  Its face turns about the upright, and tumbles as it flies.
        spinTurn.setFromAxisAngle(upAxis, coin.spin);
        turn.multiplyQuaternions(spinTurn, upright);
        matrix.compose(place, turn, scale.setScalar(1));
        layers.face.setMatrixAt(slot, matrix);
        matrix.compose(place, spinTurn, scale.setScalar(1));
        layers.rim.setMatrixAt(slot, matrix);

        //  Its glow faces the camera, and stretches back along its path as
        //  it flies home.
        toCamera.subVectors(cameraPlace, place);
        if (streaking > 0 && speed > 0) {
            along.copy(coin.velocity).divideScalar(speed);
            side.crossVectors(along, toCamera).normalize();
            const length = streakMetres + speed * streakPerSpeed * streaking;
            facing.crossVectors(side, along);
            side.multiplyScalar(streakMetres * (1 - 0.4 * streaking));
            along.multiplyScalar(length);
            matrix.makeBasis(side, along, facing);
            matrix.setPosition(
                facing.copy(place).addScaledVector(along, -0.35),
            );
        } else {
            side.copy(cameraRight).multiplyScalar(glowMetres);
            facing.copy(cameraUp).multiplyScalar(glowMetres);
            matrix.makeBasis(side, facing, along.set(0, 0, 0));
            matrix.setPosition(place);
        }
        layers.glow.setMatrixAt(slot, matrix);
        layers.glow.setColorAt(
            slot,
            tint.copy(glowColor).lerp(streakColor, streaking),
        );

        //  A glint: a star that flares and turns for a moment each cycle.
        const phase = ((now + coin.spin * 0.37) % glintSeconds) / glintLength;
        const glint = phase < 1 ? Math.sin(phase * Math.PI) : 0;
        const size = glint > 0 ? glintBaseMetres + glint * glintMetres : 0;
        side.copy(cameraRight).multiplyScalar(size);
        facing.copy(cameraUp).multiplyScalar(size);
        side.applyAxisAngle(toCamera.normalize(), phase * 0.8);
        facing.applyAxisAngle(toCamera, phase * 0.8);
        matrix.makeBasis(side, facing, along.set(0, 0, 0));
        matrix.setPosition(
            place
                .addScaledVector(cameraRight, coinRadius * 0.4)
                .addScaledVector(cameraUp, coinRadius * 0.5),
        );
        layers.glint.setMatrixAt(slot, matrix);
        layers.glint.setColorAt(
            slot,
            tint.copy(glintColor).multiplyScalar(glint),
        );
        slot++;
    }
    for (const mesh of Object.values(layers)) {
        mesh.count = slot;
        if (slot === 0) continue;
        uploadInstances(mesh.instanceMatrix, slot * 16);
        if (mesh.instanceColor) uploadInstances(mesh.instanceColor, slot * 3);
    }
}

/** Sends the first `count` numbers of `attribute` to the GPU. */
function uploadInstances(attribute: BufferAttribute, count: number) {
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, count);
    attribute.needsUpdate = true;
}
