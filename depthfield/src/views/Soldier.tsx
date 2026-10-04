import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useWorld } from "koota/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
    Color,
    Group,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Quaternion,
    RingGeometry,
    Vector3,
    type Texture,
} from "three";
import type { Entity } from "koota";
import { Bar, Text, VelocityTrait } from "@spawnite/engine";
import { readHeroHealth } from "../rules/hero";
import { findLook, LookId, u } from "../rules/data";
import { echoOffsetX, echoOffsetZ } from "../rules/field";
import { dyingSeconds } from "../rules/run";
import { RunPhase, type RunState } from "../rules/traits";
import { DashLook, Figures, useLook } from "../store/look";
import { findRun } from "./findRun";
import { liftNeon } from "./neon";
import { readStandingHeight, soldierMetres } from "./models";
import { readPrismHue } from "./prism";
import { kickShake } from "./shake";
import { useRunView } from "../hud/useRunView";
import { usePhoneLayout } from "../hud/usePhoneLayout";
import { SoldierModel, type SoldierDress } from "./SoldierModel";
import {
    hitMatrix,
    loadSoldierPixels,
    lookMatrix,
    readSoldierTexture,
    soldierHeight,
    soldierWidth,
} from "./soldierSprites";

//  The soldier as the source drew it: the pixel sprite facing the camera,
//  its two boots stepping apart as it walks, its body bobbing, leaning and
//  breathing, and its name over its head. The Prismatic echo stands beside
//  it in pale blue. Three moves of its own: a dash leaves fading copies and
//  a streak on the floor, a level-up swells it inside a ring of light, and
//  a hit knocks the sprite back and squashes it. With the models, the
//  Player wears the soldier's model, and SoldierModel lays the look over it
//  beside the sprite's shadow, ring, streak and name.

/** A plane showing the texture's pixels from (x, y), w by h, one unit a
 *  pixel, its centre at the plane's origin. */
function buildPart(x: number, y: number, width: number, height: number) {
    const plane = new PlaneGeometry(u(width), u(height));
    const uv = plane.attributes.uv;
    const left = x / soldierWidth;
    const right = (x + width) / soldierWidth;
    const top = 1 - y / soldierHeight;
    const bottom = 1 - (y + height) / soldierHeight;
    //  PlaneGeometry's corners: top left, top right, bottom left, bottom
    //  right.
    uv.setXY(0, left, top);
    uv.setXY(1, right, top);
    uv.setXY(2, left, bottom);
    uv.setXY(3, right, bottom);
    return plane;
}

const parts = {
    leftBoot: buildPart(0, 34, 16, 18),
    rightBoot: buildPart(16, 34, 16, 18),
    body: buildPart(0, 0, 32, 35),
    //  The whole sprite, for the dash's copies: its feet where the boots'
    //  are, four pixels under the ground's line.
    whole: buildPart(0, 0, 32, 52).translate(0, u(22), 0),
};

/** Seconds a dash's copy takes to fade, and between two copies. */
const ghostSeconds = 0.22;
const ghostEverySeconds = 0.035;
const ghostCount = 6;

/** Seconds the level-up's swell and ring take. */
export const levelUpSeconds = 0.45;

/** Seconds a hit's knock back takes. */
const recoilSeconds = 0.18;

/** A copy the dash left: where the hero stood, and how long ago. */
interface Ghost {
    x: number;
    z: number;
    age: number;
    facingLeft: boolean;
}

function createGhostMaterial() {
    return new MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.01,
        depthWrite: false,
        toneMapped: false,
    });
}

const ringGeometry = new RingGeometry(0.86, 1, 48);

/** The walk's bob, stride and lean, or the stand's breath, at `clock`. */
function readPose(moving: boolean, clock: number) {
    if (moving)
        return {
            bob: Math.round(Math.abs(Math.sin(clock * 13)) * 1.5),
            stride: Math.round(Math.sin(clock * 13) * 2),
            lean: Math.sin(clock * 13) * 0.025,
            breath: 1,
        };
    return {
        bob: 0,
        stride: 0,
        lean: 0,
        breath: 1 + Math.sin(clock * 2.4) * 0.012,
    };
}

/** The hero's speed on the ground, metres a second. */
function readGroundSpeed(hero: Entity) {
    const velocity = hero.get(VelocityTrait);
    return velocity ? Math.hypot(velocity.x, velocity.z) : 0;
}

interface SpriteRefs {
    root: Group | null;
    leftBoot: Mesh | null;
    rightBoot: Mesh | null;
    pivot: Group | null;
    body: Mesh | null;
}

interface SoldierSpriteProps {
    material: MeshBasicMaterial;
    refs: SpriteRefs;
}

function SoldierSprite({ material, refs }: SoldierSpriteProps) {
    return (
        <group ref={(group) => void (refs.root = group)}>
            <mesh
                ref={(mesh) => void (refs.leftBoot = mesh)}
                geometry={parts.leftBoot}
                material={material}
            />
            <mesh
                ref={(mesh) => void (refs.rightBoot = mesh)}
                geometry={parts.rightBoot}
                material={material}
            />
            <group ref={(group) => void (refs.pivot = group)}>
                <mesh
                    ref={(mesh) => void (refs.body = mesh)}
                    geometry={parts.body}
                    material={material}
                    position-y={u(16.5)}
                />
            </group>
        </group>
    );
}

function createSpriteMaterial() {
    return new MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.5,
        toneMapped: false,
    });
}

function createRefs(): SpriteRefs {
    return {
        root: null,
        leftBoot: null,
        rightBoot: null,
        pivot: null,
        body: null,
    };
}

/** Lays the pose on a sprite's parts, facing left or right. */
function placeSprite(
    refs: SpriteRefs,
    pose: ReturnType<typeof readPose>,
    facingLeft: boolean,
) {
    const { root, leftBoot, rightBoot, pivot } = refs;
    if (!root || !leftBoot || !rightBoot || !pivot) return;
    root.scale.x = facingLeft ? -1 : 1;
    leftBoot.position.set(u(-8), u(5 - pose.stride), 0);
    rightBoot.position.set(u(8), u(5 + pose.stride), 0);
    pivot.position.y = u(14 + pose.bob);
    pivot.rotation.z = -pose.lean;
    pivot.scale.y = pose.breath;
}

/** The texture key and matrix the hero wears now. */
function readHeroVariant(run: RunState) {
    if (run.invul > 0) return { key: "hit", matrix: hitMatrix };
    if (run.look === LookId.Prismatic) {
        const step = Math.floor(readPrismHue() / 30);
        return { key: `prism-${step}`, matrix: lookMatrix(step * 30) };
    }
    const look = findLook(run.look);
    return { key: look.id, matrix: lookMatrix(look.hue) };
}

const echoMatrix = lookMatrix(125);

//  Written in place each frame.
const parentRotation = new Quaternion();
const heroSpot = new Vector3();
/** Where a name stands over the soldier: 55 pixels up the screen from its
 *  feet, as the source wrote it, along the camera's up. */
const nameSpot = new Vector3(0, u(55), 0);
const lookColor = new Color();

interface SoldierProps {
    /** The engine's hero, whose velocity says whether the soldier walks. */
    hero: Entity;
    /** What the Player's model wears, which a hit flashes and the look
     *  turns. */
    dress: SoldierDress;
}

/** The soldier drawn over the engine's hero, inside its body's group. With
 *  the flat figures the engine's capsule is hidden: the sprite is the
 *  soldier. */
export function Soldier({ hero: heroEntity, dress }: SoldierProps) {
    const world = useWorld();
    const [pixels, setPixels] = useState<ImageData | null>(null);
    useEffect(() => {
        let live = true;
        void loadSoldierPixels().then((loaded) => live && setPixels(loaded));
        return () => {
            live = false;
        };
    }, []);
    const hero = useMemo(createRefs, []);
    const echo = useMemo(createRefs, []);
    const heroMaterial = useMemo(createSpriteMaterial, []);
    const echoMaterial = useMemo(createSpriteMaterial, []);
    const frameRef = useRef<Group>(null);
    const nameRef = useRef<Group>(null);
    const phone = usePhoneLayout();
    //  Read here: the name's Html renders in a root of its own, which has
    //  no world to read.
    const health = useRunView((_run, world) => {
        const { current, maximum } = readHeroHealth(world);
        return { current: Math.ceil(current), maximum };
    });
    const echoNameRef = useRef<Group>(null);
    const ghostGroupsRef = useRef<(Group | null)[]>([]);
    const ghostMaterials = useMemo(
        () => Array.from({ length: ghostCount }, createGhostMaterial),
        [],
    );
    const streakRef = useRef<Mesh>(null);
    const ringRef = useRef<Mesh>(null);
    const moves = useMemo(
        () => ({
            ghosts: [] as Ghost[],
            sinceGhost: 0,
            level: 0,
            levelAge: levelUpSeconds,
            invul: 0,
            recoilAge: recoilSeconds,
        }),
        [],
    );
    const figures = useLook((look) => look.figures);
    const billboard = useRef<Group>(null);
    const echoBillboard = useRef<Group>(null);
    const echoGroup = useRef<Group>(null);
    const [names, setNames] = useState({
        hero: "",
        echo: false,
        look: LookId.Grove,
    });

    useFrame(({ camera, clock }, delta) => {
        const run = findRun(world);
        const frame = frameRef.current;
        if (!run || !pixels || !frame?.parent) return;
        frame.parent.getWorldPosition(heroSpot);
        const drawing = useLook.getState();
        const models = drawing.figures === Figures.Models;
        nameSpot
            .set(
                0,
                models
                    ? readStandingHeight(soldierMetres, drawing.lean) + u(14)
                    : u(55),
                0,
            )
            .applyQuaternion(camera.quaternion);
        nameRef.current?.position.copy(nameSpot);
        echoNameRef.current?.position.copy(nameSpot);
        const facingLeft = run.faceX < -0.1;
        const look = findLook(run.look);
        //  ponytail: with the flat figures the engine's Player draws its
        //  capsule with no way to leave it out; hidden here until the
        //  Player takes a body of the game's own (the pull request's engine
        //  gaps).
        for (const child of frame.parent.children)
            if (child !== frame && child instanceof Mesh) child.visible = false;
        //  Undo the hero's facing, so the frame's axes are the world's.
        frame.parent.getWorldQuaternion(parentRotation);
        frame.quaternion.copy(parentRotation.invert());
        const playing =
            run.phase === RunPhase.Playing || run.phase === RunPhase.Upgrade;
        const clockSeconds = playing ? run.time : clock.elapsedTime;
        const moving =
            run.phase === RunPhase.Playing &&
            (run.dashTime > 0 || readGroundSpeed(heroEntity) > 0.1);
        const pose = readPose(moving, clockSeconds);
        const variant = readHeroVariant(run);
        heroMaterial.map = readSoldierTexture(
            pixels,
            variant.key,
            variant.matrix,
        ) as Texture;
        placeSprite(hero, pose, facingLeft);
        const dying = run.phase === RunPhase.Dying;
        const fall =
            dying || run.phase === RunPhase.Defeated
                ? 1 - Math.max(0, run.deathTimer) / dyingSeconds
                : 0;
        heroMaterial.opacity = Math.max(0, 1 - fall * 0.9);
        //  A level-up swells the sprite inside a ring of light; a hit knocks
        //  it back against its facing and squashes it.
        if (run.level > moves.level) {
            if (moves.level > 0) moves.levelAge = 0;
            moves.level = run.level;
        }
        moves.levelAge += delta;
        if (run.invul > moves.invul + 0.3) {
            moves.recoilAge = 0;
            if (drawing.shake) kickShake(0.35);
        }
        moves.invul = run.invul;
        moves.recoilAge += delta;
        const swell =
            moves.levelAge < levelUpSeconds
                ? Math.sin((Math.PI * moves.levelAge) / levelUpSeconds) * 0.25
                : 0;
        const recoil = Math.max(0, 1 - moves.recoilAge / recoilSeconds);
        if (billboard.current) {
            billboard.current.visible = !models;
            billboard.current.quaternion.copy(camera.quaternion);
            billboard.current.rotateZ(-fall * 1.35);
            billboard.current.scale.set(
                1 + swell + recoil * 0.1,
                1 + swell - recoil * 0.15,
                1,
            );
            billboard.current.position.set(
                -run.faceX * u(8) * recoil,
                0,
                -run.faceZ * u(8) * recoil,
            );
        }
        if (ringRef.current) {
            const progress = moves.levelAge / levelUpSeconds;
            ringRef.current.visible = progress < 1;
            ringRef.current.scale.setScalar(u(20 + progress * 120));
            const material = ringRef.current.material as MeshBasicMaterial;
            liftNeon(look.color, material.color);
            material.opacity = 1 - progress;
        }
        //  The dash's copies, dropped where the hero stood and fading.
        moves.sinceGhost += delta;
        if (run.dashTime > 0 && moves.sinceGhost >= ghostEverySeconds) {
            moves.sinceGhost = 0;
            moves.ghosts.unshift({
                x: heroSpot.x,
                z: heroSpot.z,
                age: 0,
                facingLeft,
            });
            moves.ghosts.length = Math.min(moves.ghosts.length, ghostCount);
        }
        liftNeon(look.color, lookColor, 1.4);
        let oldest: Ghost | null = null;
        for (let index = 0; index < ghostCount; index++) {
            const group = ghostGroupsRef.current[index];
            const ghost = moves.ghosts[index];
            if (ghost) ghost.age += delta;
            const shown = ghost && ghost.age < ghostSeconds;
            if (!group) continue;
            group.visible = Boolean(shown) && !models;
            if (!shown) continue;
            oldest = ghost;
            group.position.set(ghost.x - heroSpot.x, 0, ghost.z - heroSpot.z);
            group.quaternion.copy(camera.quaternion);
            group.scale.x = ghost.facingLeft ? -1 : 1;
            const material = ghostMaterials[index];
            material.map = heroMaterial.map;
            material.color.copy(lookColor);
            material.opacity = 0.5 * (1 - ghost.age / ghostSeconds);
        }
        if (streakRef.current) {
            streakRef.current.visible =
                oldest !== null && drawing.dash !== DashLook.Roll;
            if (oldest) {
                const dx = heroSpot.x - oldest.x;
                const dz = heroSpot.z - oldest.z;
                const length = Math.hypot(dx, dz);
                streakRef.current.position.set(-dx / 2, 0.065, -dz / 2);
                streakRef.current.rotation.set(
                    -Math.PI / 2,
                    Math.atan2(-dz, dx),
                    0,
                    "YXZ",
                );
                streakRef.current.scale.set(Math.max(0.001, length), u(10), 1);
                const material = streakRef.current
                    .material as MeshBasicMaterial;
                material.color.copy(lookColor);
                material.opacity = 0.22 * (1 - oldest.age / ghostSeconds);
            }
        }
        if (echoGroup.current) echoGroup.current.visible = run.hasTwin;
        if (echoBillboard.current) echoBillboard.current.visible = !models;
        if (run.hasTwin && echoBillboard.current) {
            echoMaterial.map = readSoldierTexture(pixels, "echo", echoMatrix);
            placeSprite(echo, pose, facingLeft);
            echoBillboard.current.quaternion.copy(camera.quaternion);
        }
        const name = dying ? "" : run.nickname || "YOU";
        if (
            names.hero !== name ||
            names.echo !== run.hasTwin ||
            names.look !== run.look
        )
            setNames({ hero: name, echo: run.hasTwin, look: run.look });
    });

    return (
        <>
            <group ref={frameRef}>
                <mesh
                    rotation-x={-Math.PI / 2}
                    position-y={0.06}
                    scale-y={0.45}
                >
                    <circleGeometry args={[u(14), 24]} />
                    <meshBasicMaterial
                        color="#000000"
                        transparent
                        opacity={0.33}
                        depthWrite={false}
                    />
                </mesh>
                <mesh ref={streakRef} visible={false}>
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial
                        transparent
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
                <mesh
                    ref={ringRef}
                    visible={false}
                    rotation-x={-Math.PI / 2}
                    position-y={0.07}
                    geometry={ringGeometry}
                >
                    <meshBasicMaterial
                        transparent
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
                {ghostMaterials.map((material, index) => (
                    <group
                        key={index}
                        ref={(group) =>
                            void (ghostGroupsRef.current[index] = group)
                        }
                        visible={false}
                    >
                        <mesh geometry={parts.whole} material={material} />
                    </group>
                ))}
                <group ref={billboard}>
                    <SoldierSprite material={heroMaterial} refs={hero} />
                </group>
                {(names.hero || phone) && (
                    <group ref={nameRef}>
                        <Html center zIndexRange={[5, 0]}>
                            <Text
                                as="div"
                                className="pointer-events-none flex flex-col items-center"
                            >
                                <Text
                                    className={`text-[10px] whitespace-nowrap df-look-${names.look}`}
                                >
                                    {names.hero}
                                </Text>
                                {phone && health && (
                                    <Bar
                                        label="Health"
                                        value={health.current}
                                        maximum={health.maximum}
                                        className="mt-0.5 block h-1.5 w-14"
                                    />
                                )}
                            </Text>
                        </Html>
                    </group>
                )}
                <group ref={echoGroup} position={[echoOffsetX, 0, echoOffsetZ]}>
                    <group ref={echoBillboard}>
                        <SoldierSprite material={echoMaterial} refs={echo} />
                    </group>
                    {names.echo && (
                        <group ref={echoNameRef}>
                            <Html center zIndexRange={[5, 0]}>
                                <Text className="pointer-events-none text-[10px] text-[#abd9ff]">
                                    ECHO
                                </Text>
                            </Html>
                        </group>
                    )}
                </group>
            </group>
            {/*  Beside the frame, which this view turns a frame late: the
            model's look turns its own group as the model is posed. */}
            {figures === Figures.Models && (
                <Suspense fallback={null}>
                    <SoldierModel
                        hero={heroEntity}
                        dress={dress}
                        moves={moves}
                        levelUpSeconds={levelUpSeconds}
                        recoilSeconds={recoilSeconds}
                        ghostSeconds={ghostSeconds}
                    />
                </Suspense>
            )}
        </>
    );
}
