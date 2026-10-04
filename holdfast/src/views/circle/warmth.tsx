import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait, useWorld } from "koota/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    Color,
    CylinderGeometry,
    DoubleSide,
    ShaderMaterial,
    Vector3,
    type Mesh,
} from "three";
import {
    findPlayerHero,
    HeroTrait,
    TransformTrait,
    useTime,
    WelcomesTrait,
} from "@spawnite/engine";
import { measureHearing, playSound, Sound } from "../../audio/sounds";
import { fireMetres, measureFireRing } from "../../siege/fire";
import { FireTrait, WardenTrait } from "../../siege/traits";
import { emitGlow, emitSparks } from "../effects/EffectPools";
import { useWelcomed } from "../welcomed";
import { LifeMachine } from "../../siege/life";
import { PhaseTrait, readPhase } from "../../siege/phase";

//  The hearth's warmth, where a warden near the fire heals: a low curtain of
//  firelight round the ground its ring reaches, the fire roaring up, and
//  embers rising off each warden it heals. Between waves it burns full;
//  during a wave, once the wardens have fed the fire, it burns lower. Each
//  level the fire rises widens the ring and grows the flames, and each
//  feed throws a burst of sparks up out of it. Diablo's and League's
//  healing zones mark their edge the same way.

/** How warm the hearth is, 0 in a fight with an unfed fire to 1 between
 *  waves, eased: the fire, its light and the curtain read it. */
export const hearthWarmth = { value: 0 };
/** How big the fire burns, 1 at its first level and larger with each,
 *  and how far its ring reaches, eased as it rises. */
export const hearthGrowth = { size: 1, ring: fireMetres };

/** Seconds the warmth takes to come up, and to die down. */
const warmSeconds = 1.2;
const coolSeconds = 0.6;
/** Metres tall the curtain stands. */
const curtainMetres = 0.9;
/** Seconds between two embers off a warden the fire heals. */
const emberSeconds = 0.12;
/** How warm the fed fire burns during a wave, as a share of between
 *  waves. */
const waveWarmth = 0.6;
/** Times its first size each level adds to the flames, and the most. */
const levelSize = 0.2;
const mostSize = 3.2;
/** The burst a feed throws, and a rising level's. */
const feedColor = new Color("#ffb35a").multiplyScalar(2.4);
const flareColor = new Color("#ffd08a").multiplyScalar(2.2);

const curtainGeometry = new CylinderGeometry(
    fireMetres,
    fireMetres,
    curtainMetres,
    96,
    1,
    true,
);
const emberColor = new Color("#ffc46b").multiplyScalar(2.2);
const upward = new Vector3(0, 1, 0);
//  Written in place for each ember.
const spot = new Vector3();

const curtainVertex = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Brightest at the ground and gone at its top, flickering round the ring
 *  as the fire does. */
const curtainFragment = /* glsl */ `
uniform float uTime;
uniform float uWarmth;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
    float around = vUv.x * 6.2831853;
    float flicker = 0.7 + 0.3 * sin(around * 23.0 + uTime * 2.1) * sin(around * 9.0 - uTime * 1.3);
    float glow = pow(max(1.0 - vUv.y, 0.0), 2.4) * flicker * uWarmth;
    gl_FragColor = vec4(uColor, glow * 0.5);
}`;

/** A burst of sparks up out of the fire, and a flare where it rises a
 *  level, heard from where this page's warden stands. */
function useFeedBursts() {
    const world = useWorld();
    const fire = useTrait(useQueryFirst(FireTrait), FireTrait);
    const level = fire?.level ?? 0;
    const fuel = fire?.fuel ?? 0;
    const welcomes = world.get(WelcomesTrait)?.count ?? 0;
    const lastRef = useRef({ level, fuel, welcomes });
    useEffect(() => {
        const last = lastRef.current;
        lastRef.current = { level, fuel, welcomes };
        //  A welcome brings the fire as it stands, which nobody fed now.
        if (welcomes !== last.welcomes) return;
        const rose = level > last.level;
        //  A new run puts the fire back, which throws nothing.
        if (!rose && !(level === last.level && fuel > last.fuel)) return;
        const hearth = spot.set(0, 0.6, 0);
        emitSparks({
            position: hearth,
            color: feedColor,
            count: rose ? 60 : 22,
            speed: rose ? 9 : 6,
            toward: upward,
            spread: 0.6,
            seconds: rose ? 1.4 : 0.9,
            width: 0.07,
            weight: -0.15,
        });
        emitGlow({
            position: hearth,
            color: flareColor,
            seconds: rose ? 0.8 : 0.35,
            size: 1.2,
            endSize: rose ? 7 : 3.5,
        });
        if (rose)
            emitGlow({
                position: spot.set(0, 0.15, 0),
                color: flareColor,
                seconds: 1,
                size: 1.5,
                endSize: measureFireRing(level) * 2,
                ring: true,
            });
        const feet = findPlayerHero(world)?.get(TransformTrait);
        playSound(Sound.Feed, {
            volume: feet ? measureHearing(Math.hypot(feet.x, feet.z)) : 1,
        });
    }, [level, fuel, welcomes, world]);
}

/** The warmth: eased toward the phase and the fire's level, and on them
 *  at once after a welcome, drawn as the curtain, and thrown off each
 *  warden it heals as embers. A page mounts it in the hearth. */
export function HearthWarmth() {
    const world = useWorld();
    const isWelcomed = useWelcomed();
    useFeedBursts();
    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: curtainVertex,
                fragmentShader: curtainFragment,
                uniforms: {
                    uTime: { value: 0 },
                    uWarmth: { value: 0 },
                    uColor: { value: new Color("#ff9a4a").multiplyScalar(1.3) },
                },
                transparent: true,
                depthWrite: false,
                side: DoubleSide,
                blending: AdditiveBlending,
                toneMapped: false,
            }),
        [],
    );
    useLayoutEffect(() => () => material.dispose(), [material]);
    const emberClock = useMemo(() => ({ seconds: 0 }), []);

    const curtainRef = useRef<Mesh>(null);
    useFrame((_, delta) => {
        //  Read in the frame, which may come before a welcome's render.
        const phase = readPhase(world.queryFirst(PhaseTrait));
        const level = world.queryFirst(FireTrait)?.get(FireTrait)?.level ?? 0;
        const resting = phase === "breather";
        const healing = resting || (phase === "fight" && level > 0);
        const target = resting ? 1 : healing ? waveWarmth : 0;
        const rising = target > hearthWarmth.value;
        const welcomed = isWelcomed();
        const rate = welcomed
            ? Infinity
            : delta / (rising ? warmSeconds : coolSeconds);
        hearthWarmth.value +=
            Math.sign(target - hearthWarmth.value) *
            Math.min(rate, Math.abs(target - hearthWarmth.value));
        //  The fire grows and its ring widens over a second as it rises.
        const ease = welcomed ? 1 : Math.min(1, delta * 2);
        hearthGrowth.size +=
            (Math.min(mostSize, 1 + level * levelSize) - hearthGrowth.size) *
            ease;
        hearthGrowth.ring +=
            (measureFireRing(level) - hearthGrowth.ring) * ease;
        curtainRef.current?.scale.set(
            hearthGrowth.ring / fireMetres,
            1,
            hearthGrowth.ring / fireMetres,
        );
        material.uniforms.uTime.value = useTime.getState().seconds;
        material.uniforms.uWarmth.value = hearthWarmth.value;
        //  Embers off each warden standing inside the ring below her
        //  health, whom the room heals now.
        emberClock.seconds += delta;
        if (!healing || emberClock.seconds < emberSeconds) return;
        emberClock.seconds = 0;
        for (const hero of world.query(
            HeroTrait,
            WardenTrait,
            TransformTrait,
        )) {
            const warden = hero.get(WardenTrait);
            const feet = hero.get(TransformTrait);
            if (!warden || !feet || hero.has(LifeMachine.is.down)) continue;
            if (warden.health >= warden.maximum) continue;
            if (Math.hypot(feet.x, feet.z) > hearthGrowth.ring) continue;
            const angle = Math.random() * Math.PI * 2;
            spot.set(
                feet.x + Math.sin(angle) * 0.35,
                feet.y + 0.2 + Math.random() * 0.6,
                feet.z + Math.cos(angle) * 0.35,
            );
            emitSparks({
                position: spot,
                color: emberColor,
                count: 1,
                speed: 1.4,
                toward: upward,
                spread: 0.25,
                seconds: 0.9,
                width: 0.05,
                weight: -0.2,
            });
        }
    });

    return (
        <mesh
            ref={curtainRef}
            geometry={curtainGeometry}
            material={material}
            position-y={curtainMetres / 2}
            renderOrder={2}
        />
    );
}
