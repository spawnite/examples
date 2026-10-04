import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { createQuery, type Entity } from "koota";
import { useWorld } from "koota/react";
import { useMemo, useRef, useState } from "react";
import {
    CircleGeometry,
    InstancedMesh,
    MeshBasicMaterial,
    OctahedronGeometry,
    PlaneGeometry,
    Vector3,
    type BufferGeometry,
    type Group,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HealthTrait, readEach, Text } from "@spawnite/engine";
import { enemyStats, EnemyKind, u } from "../rules/data";
import { EnemyTrait, FelledTrait, type Fall } from "../rules/traits";
import { Figures, useLook } from "../store/look";
import { readBodyColor } from "./enemyColors";
import { findRun } from "./findRun";
import { useEventRecords } from "./useEventRecords";
import {
    blendPosition,
    finishInstances,
    lieFlat,
    placeInstance,
    readStepFraction,
    glowInstance,
    tintInstance,
} from "./instances";
import { readStandingHeight, riggedModels, swarmHeights } from "./models";

//  The swarm, drawn as the source drew it: each enemy a flat figure facing
//  the camera, a column in its kind's colour whose right side shows a dark
//  shade, with a dark visor, a shadow at its feet and, once hit, a bar over
//  its head. The loot runner is a glowing gold diamond. Every enemy of the
//  field draws in a handful of instanced meshes. While the Look panel
//  draws the Meshy models, the models stand in for the figures, and this
//  view keeps the shadows, the bars, the summoner's orb and the loot.

/** Room for every enemy the cap allows, the summons and the specials. */
const capacity = 220;

const placedEnemies = createQuery(EnemyTrait);

/** The word over a special enemy's head, and its colour. */
interface LabelText {
    text: string;
    className: string;
}

const labels: Partial<Record<EnemyKind, LabelText>> = {
    [EnemyKind.Elite]: { text: "ELITE", className: "text-[#ffe9a8]" },
    [EnemyKind.CrimsonElite]: { text: "ELITE+", className: "text-[#ffd0c8]" },
    [EnemyKind.Boss]: { text: "BOSS", className: "text-[#ffd0c8]" },
    [EnemyKind.LootRunner]: { text: "LOOT", className: "text-[#fff6c2]" },
};

interface Label extends LabelText {
    entity: Entity;
}

/** How far up the screen's up an enemy's head reaches: where its bar and
 *  its label stand. */
function readFigureTop(kind: EnemyKind, radius: number) {
    const { figures, lean } = useLook.getState();
    if (figures === Figures.Flat) return radius * 3;
    const rigged = riggedModels[kind];
    if (rigged) return readStandingHeight(rigged.metres, lean);
    return readStandingHeight((swarmHeights[kind] ?? 2.3) * radius, lean);
}

//  Written in place each frame.
const at = new Vector3();
const scale = new Vector3();
const spot = new Vector3();
const visorSpot = new Vector3();
const fallScale = new Vector3();
const cameraRight = new Vector3();
const cameraUp = new Vector3();
const cameraBack = new Vector3();

/** Seconds a killed enemy takes to fall: a white flash as it squashes,
 *  then flat into the floor as its sparks burst. */
const fallSeconds = 0.32;
/** The share of the fall the flash takes. */
const flashShare = 0.35;

/** A fall on the field, and how long it has played. */
interface Falling extends Fall {
    age: number;
}

/** How wide and how tall a falling figure stands, as shares of its own,
 *  `progress` into its fall. */
function readFallScale(progress: number, out: Vector3) {
    if (progress < flashShare) {
        const squash = progress / flashShare;
        return out.set(1 + 0.4 * squash, 1 - 0.35 * squash, 1);
    }
    const flatten = (progress - flashShare) / (1 - flashShare);
    return out.set(1.4 + 0.3 * flatten, 0.65 * (1 - flatten) ** 2, 1);
}

/** How far each layer of a figure stands before the one under it, toward
 *  the camera, so the layers never fight for depth. */
const layerStep = 0.005;

/** A flat shape whose feet are at its origin, in radii: the source's
 *  figure is two radii wide and 2.3 tall. */
function buildFigureShade() {
    return new PlaneGeometry(2, 1.65).translate(0, 0.975, 0);
}

/** The lit part of the figure: a top and a bottom ellipse joined by a
 *  body that leaves the right side's shade showing. */
function buildFigureBody() {
    const top = new CircleGeometry(1, 24).scale(1, 0.5, 1).translate(0, 1.8, 0);
    const body = new PlaneGeometry(1.45, 1.3).translate(-0.275, 1.15, 0);
    const bottom = new CircleGeometry(1, 24)
        .scale(1, 0.45, 1)
        .translate(0, 0.45, 0);
    return mergeGeometries([top, body, bottom])!;
}

function makeMesh(geometry: BufferGeometry, material: MeshBasicMaterial) {
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
}

export function Enemies() {
    const world = useWorld();
    const meshes = useMemo(
        () => ({
            shade: makeMesh(
                buildFigureShade(),
                new MeshBasicMaterial({ color: "#725963", toneMapped: false }),
            ),
            body: makeMesh(
                buildFigureBody(),
                new MeshBasicMaterial({ toneMapped: false }),
            ),
            visor: makeMesh(
                new PlaneGeometry(1, 1),
                new MeshBasicMaterial({ color: "#20323b", toneMapped: false }),
            ),
            shadow: makeMesh(
                new CircleGeometry(1, 20),
                new MeshBasicMaterial({
                    color: "#000000",
                    transparent: true,
                    opacity: 0.33,
                    depthWrite: false,
                    toneMapped: false,
                }),
            ),
            eye: makeMesh(
                new CircleGeometry(1, 16),
                new MeshBasicMaterial({ toneMapped: false }),
            ),
            loot: makeMesh(
                new OctahedronGeometry(1),
                new MeshBasicMaterial({ toneMapped: false }),
            ),
            barBack: makeMesh(
                new PlaneGeometry(1, 1),
                new MeshBasicMaterial({
                    color: "#101820",
                    depthTest: false,
                    toneMapped: false,
                }),
            ),
            barFill: makeMesh(
                new PlaneGeometry(1, 1),
                new MeshBasicMaterial({ depthTest: false, toneMapped: false }),
            ),
        }),
        [],
    );
    const [shown, setShown] = useState<Label[]>([]);
    const falls = useMemo<Falling[]>(() => [], []);
    useEventRecords(
        FelledTrait,
        (entity) => entity.get(FelledTrait)?.list,
        (fall) => {
            if (useLook.getState().figures !== Figures.Flat) return;
            if (fall.kind !== EnemyKind.LootRunner)
                falls.push({ ...fall, age: 0 });
        },
    );
    const shownKey = useRef("");

    useFrame(({ camera, clock }, delta) => {
        const run = findRun(world);
        const fraction = readStepFraction();
        const counts = {
            shade: 0,
            body: 0,
            visor: 0,
            shadow: 0,
            eye: 0,
            loot: 0,
            bar: 0,
        };
        const time = run?.time ?? 0;
        const specials: Label[] = [];
        cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        cameraBack.set(0, 0, 1).applyQuaternion(camera.quaternion);
        const flat = useLook.getState().figures === Figures.Flat;
        readEach(world, placedEnemies, ([enemy], entity) => {
            blendPosition(entity, fraction, at);
            const { radius, kind } = enemy;
            const label = labels[kind];
            if (label) specials.push({ entity, ...label });
            let shrink = 1;
            if (enemy.dying)
                shrink = Math.max(0, 1 - enemy.deathSeconds / 1.15);
            if (shrink <= 0) return;
            placeInstance(meshes.shadow, counts.shadow++, {
                position: spot.set(at.x, 0.06, at.z),
                scale: scale.set(radius * 1.2, radius * 0.9, 1),
                rotation: lieFlat,
            });
            if (!flat && kind === EnemyKind.Summoner) {
                const ready =
                    enemy.summonsMade >= 3
                        ? 0
                        : 1 - Math.max(0, enemy.summonTimer) / 5;
                placeInstance(meshes.eye, counts.eye, {
                    position: visorSpot
                        .copy(at)
                        .addScaledVector(
                            cameraUp,
                            readFigureTop(kind, radius) * 0.93,
                        ),
                    scale: scale.setScalar(u(5 + ready * 6)),
                    rotation: camera.quaternion,
                });
                glowInstance(
                    meshes.eye,
                    counts.eye++,
                    enemy.summonsMade >= 3 ? "#547e77" : "#a8fff0",
                );
            }
            if (kind === EnemyKind.LootRunner) {
                const pulse = 0.7 + Math.sin(clock.elapsedTime * 7) * 0.3;
                placeInstance(meshes.loot, counts.loot, {
                    position: spot.set(at.x, u(20 + pulse * 3), at.z),
                    scale: scale.set(u(18), u(28 + pulse * 6), u(18)),
                });
                tintInstance(meshes.loot, counts.loot++, "#fff4b0");
            } else if (flat) {
                const bob = u(Math.sin(time * 9 + at.x * 0.42) * 2);
                const size = radius * shrink;
                //  The figure's feet, lifted by its bob along the screen's
                //  up, as the source lifted the drawing.
                spot.copy(at).addScaledVector(cameraUp, bob);
                placeInstance(meshes.shade, counts.shade++, {
                    position: spot,
                    scale: scale.setScalar(size),
                    rotation: camera.quaternion,
                });
                spot.addScaledVector(cameraBack, layerStep);
                placeInstance(meshes.body, counts.body, {
                    position: spot,
                    scale: scale.setScalar(size),
                    rotation: camera.quaternion,
                });
                //  A hit's pale flash glows.
                if (enemy.hit > 0)
                    glowInstance(
                        meshes.body,
                        counts.body++,
                        readBodyColor(enemy),
                    );
                else
                    tintInstance(
                        meshes.body,
                        counts.body++,
                        readBodyColor(enemy),
                    );
                spot.addScaledVector(cameraBack, layerStep);
                //  The visor: 0.95 radii wide and four source pixels tall
                //  whatever the enemy's size, its top 1.4 radii up.
                placeInstance(meshes.visor, counts.visor++, {
                    position: visorSpot
                        .copy(spot)
                        .addScaledVector(
                            cameraUp,
                            (1.4 * radius - u(2)) * shrink,
                        )
                        .addScaledVector(cameraRight, 0.025 * size),
                    scale: scale.set(0.95 * size, u(4) * shrink, 1),
                    rotation: camera.quaternion,
                });
                if (kind === EnemyKind.Shooter) {
                    visorSpot.copy(spot).addScaledVector(cameraUp, 1.2 * size);
                    placeInstance(meshes.eye, counts.eye, {
                        position: visorSpot,
                        scale: scale.setScalar(u(6) * shrink),
                        rotation: camera.quaternion,
                    });
                    tintInstance(meshes.eye, counts.eye++, "#493768");
                    visorSpot.addScaledVector(cameraBack, layerStep);
                    placeInstance(meshes.eye, counts.eye, {
                        position: visorSpot,
                        scale: scale.setScalar(u(3) * shrink),
                        rotation: camera.quaternion,
                    });
                    tintInstance(meshes.eye, counts.eye++, "#eddcff");
                }
                if (kind === EnemyKind.Summoner) {
                    const ready =
                        enemy.summonsMade >= 3
                            ? 0
                            : 1 - Math.max(0, enemy.summonTimer) / 5;
                    placeInstance(meshes.eye, counts.eye, {
                        position: visorSpot
                            .copy(at)
                            .addScaledVector(cameraUp, 2.5 * radius),
                        scale: scale.setScalar(u(4 + ready * 5)),
                        rotation: camera.quaternion,
                    });
                    tintInstance(
                        meshes.eye,
                        counts.eye++,
                        enemy.summonsMade >= 3 ? "#547e77" : "#a8fff0",
                    );
                }
            }
            const health = entity.get(HealthTrait);
            const showBar =
                health &&
                health.current > 0 &&
                (enemy.healthBarUntil > time ||
                    kind === EnemyKind.Boss ||
                    kind === EnemyKind.LootRunner);
            if (!showBar) return;
            const wide = u(
                kind === EnemyKind.Boss
                    ? 56
                    : kind === EnemyKind.LootRunner
                      ? 44
                      : 38,
            );
            const share = Math.max(0, health.current / health.maximum);
            const barHeight =
                kind === EnemyKind.LootRunner
                    ? u(52)
                    : readFigureTop(kind, radius) + u(10);
            spot.copy(at).addScaledVector(cameraUp, barHeight);
            placeInstance(meshes.barBack, counts.bar, {
                position: spot,
                scale: scale.set(wide + u(2), u(5), 1),
                rotation: camera.quaternion,
            });
            spot.addScaledVector(cameraRight, (-(1 - share) * wide) / 2);
            placeInstance(meshes.barFill, counts.bar, {
                position: spot,
                scale: scale.set(Math.max(0.001, wide * share), u(3), 1),
                rotation: camera.quaternion,
            });
            tintInstance(
                meshes.barFill,
                counts.bar++,
                kind === EnemyKind.Boss
                    ? "#ff5a4a"
                    : kind === EnemyKind.LootRunner
                      ? "#ffe27a"
                      : "#efb298",
            );
        });
        //  The falls, drawn in the figures' own meshes after the living.
        let live = 0;
        for (const fall of falls) {
            fall.age += delta;
            if (fall.age >= fallSeconds) continue;
            falls[live++] = fall;
            if (counts.body >= capacity) continue;
            const progress = fall.age / fallSeconds;
            const { radius, color } = enemyStats[fall.kind];
            readFallScale(progress, fallScale).multiplyScalar(radius);
            spot.set(fall.x, 0, fall.z);
            placeInstance(meshes.shadow, counts.shadow++, {
                position: visorSpot.set(fall.x, 0.06, fall.z),
                scale: scale.set(
                    radius * 1.2 * (1 - progress),
                    radius * 0.9 * (1 - progress),
                    1,
                ),
                rotation: lieFlat,
            });
            placeInstance(meshes.shade, counts.shade++, {
                position: spot,
                scale: fallScale,
                rotation: camera.quaternion,
            });
            spot.addScaledVector(cameraBack, layerStep);
            placeInstance(meshes.body, counts.body, {
                position: spot,
                scale: fallScale,
                rotation: camera.quaternion,
            });
            if (progress < flashShare)
                glowInstance(meshes.body, counts.body++, "#ffffff");
            else tintInstance(meshes.body, counts.body++, color);
        }
        falls.length = live;
        finishInstances(meshes.shade, counts.shade);
        finishInstances(meshes.body, counts.body);
        finishInstances(meshes.visor, counts.visor);
        finishInstances(meshes.shadow, counts.shadow);
        finishInstances(meshes.eye, counts.eye);
        finishInstances(meshes.loot, counts.loot);
        finishInstances(meshes.barBack, counts.bar);
        finishInstances(meshes.barFill, counts.bar);
        const key = specials.map((special) => special.entity).join();
        if (key !== shownKey.current) {
            shownKey.current = key;
            setShown(specials);
        }
    });

    return (
        <>
            {Object.entries(meshes).map(([name, mesh]) => (
                <primitive key={name} object={mesh} />
            ))}
            {shown.map((label) => (
                <SpecialLabel key={label.entity} label={label} />
            ))}
        </>
    );
}

const labelUp = new Vector3();

interface SpecialLabelProps {
    label: Label;
}

/** An elite's, the boss's or the loot runner's word over its head. */
function SpecialLabel({ label }: SpecialLabelProps) {
    const group = useRef<Group>(null);
    const fraction = useRef(0);
    useFrame(({ camera }) => {
        fraction.current = readStepFraction();
        const { entity } = label;
        if (!group.current || !entity.isAlive()) return;
        const enemy = entity.get(EnemyTrait);
        if (!enemy) return;
        blendPosition(entity, fraction.current, group.current.position);
        labelUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        group.current.position.addScaledVector(
            labelUp,
            enemy.kind === EnemyKind.LootRunner
                ? u(60)
                : readFigureTop(enemy.kind, enemy.radius) + u(20),
        );
    });
    return (
        <group ref={group}>
            <Html center zIndexRange={[5, 0]}>
                <Text
                    as="b"
                    className={`pointer-events-none text-[11px] whitespace-nowrap ${label.className}`}
                >
                    {label.text}
                </Text>
            </Html>
        </group>
    );
}
