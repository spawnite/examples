import { useFrame } from "@react-three/fiber";
import { createQuery } from "koota";
import { useWorld } from "koota/react";
import { useEffect, useMemo } from "react";
import {
    Euler,
    InstancedMesh,
    Mesh,
    Quaternion,
    TetrahedronGeometry,
    Vector3,
    type BufferGeometry,
    type Object3D,
} from "three";
import { readEach, useModel } from "@spawnite/engine";
import { enemyStats, EnemyKind } from "../rules/data";
import { readHeroPosition } from "../rules/field";
import { EnemyTrait, EnemyPhase, FelledTrait } from "../rules/traits";
import { DeathLook, useLook } from "../store/look";
import { readBodyColor } from "./enemyColors";
import { findRun } from "./findRun";
import { useEventRecords } from "./useEventRecords";
import {
    blendPosition,
    finishInstances,
    glowInstance,
    placeInstance,
    readStepFraction,
    tintInstance,
} from "./instances";
import { createModelMaterial } from "./matcap";
import { readLeanTurn, swarmHeights, swarmModels } from "./models";

//  The swarm as Meshy models: one instanced mesh for each kind, every
//  copy facing the soldier, waddling as it walks and leaning into its
//  stride, squashed by a hit and lit white by its flash. A kill plays
//  the Look panel's death: a burst flat into the floor, a tumble away
//  from the soldier, or a shatter into shards of its colour.

/** Room for every enemy the cap allows, the summons and the specials. */
const capacity = 220;
const shardsPerFall = 14;
const shardCapacity = 600;

const placedEnemies = createQuery(EnemyTrait);

const swarmKinds = Object.keys(swarmModels) as EnemyKind[];

/** Seconds each death look plays. */
const fallSeconds: Record<DeathLook, number> = {
    [DeathLook.Burst]: 0.32,
    [DeathLook.Tumble]: 0.55,
    [DeathLook.Shatter]: 0.7,
};

/** A swarm kill on the field: where it fell, which way the soldier
 *  pushed it, the death it plays and how long it has played. */
interface SwarmFall {
    x: number;
    z: number;
    kind: EnemyKind;
    awayX: number;
    awayZ: number;
    yaw: number;
    look: DeathLook;
    age: number;
    /** The angle a shatter's first shard flies out at. */
    spin: number;
}

/** The first mesh's geometry in a loaded model. */
function findGeometry(scene: Object3D) {
    let geometry: BufferGeometry | null = null;
    scene.traverse((node) => {
        if (!geometry && node instanceof Mesh) geometry = node.geometry;
    });
    if (!geometry) throw new Error("A swarm model holds no mesh.");
    return geometry;
}

function makeMesh(geometry: BufferGeometry, rim: boolean, count: number) {
    const mesh = new InstancedMesh(geometry, createModelMaterial(rim), count);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
}

//  Written in place each frame.
const at = new Vector3();
const scale = new Vector3();
const turn = new Quaternion();
const lean = new Quaternion();
const pose = new Euler(0, 0, 0, "YXZ");
const spot = new Vector3();

/** The soldier's heading from (x, z), as a turn about y from +z. */
function readYawToHero(hero: Vector3, x: number, z: number) {
    return Math.atan2(hero.x - x, hero.z - z);
}

export function SwarmModels() {
    const world = useWorld();
    const rims = useLook((look) => look.rims);
    const models = useModel(swarmKinds.map((kind) => swarmModels[kind]!));
    const meshes = useMemo(
        () =>
            new Map(
                swarmKinds.map((kind, index) => [
                    kind,
                    makeMesh(findGeometry(models[index].scene), rims, capacity),
                ]),
            ),
        [models, rims],
    );
    const shards = useMemo(
        () => makeMesh(new TetrahedronGeometry(1), rims, shardCapacity),
        [rims],
    );
    useEffect(
        () => () => {
            for (const mesh of [...meshes.values(), shards])
                mesh.material.dispose();
            shards.geometry.dispose();
        },
        [meshes, shards],
    );
    const falls = useMemo<SwarmFall[]>(() => [], []);
    useEventRecords(
        FelledTrait,
        (entity) => entity.get(FelledTrait)?.list,
        (fall) => {
            if (!swarmModels[fall.kind]) return;
            const hero = readHeroPosition(world);
            const dx = fall.x - hero.x;
            const dz = fall.z - hero.z;
            const length = Math.hypot(dx, dz) || 1;
            falls.push({
                ...fall,
                awayX: dx / length,
                awayZ: dz / length,
                yaw: readYawToHero(hero, fall.x, fall.z),
                look: useLook.getState().death,
                age: 0,
                spin: Math.random() * Math.PI * 2,
            });
        },
    );

    useFrame((_, delta) => {
        const counts = new Map(swarmKinds.map((kind) => [kind, 0]));
        let shardCount = 0;
        const run = findRun(world);
        const time = run?.time ?? 0;
        const fraction = readStepFraction();
        const hero = readHeroPosition(world);
        readLeanTurn(useLook.getState().lean, lean);
        readEach(world, placedEnemies, ([enemy], entity) => {
            const mesh = meshes.get(enemy.kind);
            if (!mesh) return;
            blendPosition(entity, fraction, at);
            const height = swarmHeights[enemy.kind]! * enemy.radius;
            const charging =
                enemy.kind === EnemyKind.Tank &&
                enemy.phase === EnemyPhase.Charge;
            const pace = enemy.kind === EnemyKind.Runner ? 15 : 9;
            const stride = time * pace + at.x * 0.42;
            const bob = Math.abs(Math.sin(stride)) * 0.05 * height;
            pose.set(
                charging ? 0.4 : 0.12,
                readYawToHero(hero, at.x, at.z),
                Math.sin(stride) * 0.14,
            );
            turn.setFromEuler(pose).premultiply(lean);
            const squash = enemy.hit > 0 ? 1 : 0;
            scale.set(
                height * (1 + squash * 0.15),
                height * (1 - squash * 0.12),
                height * (1 + squash * 0.15),
            );
            const index = counts.get(enemy.kind)!;
            counts.set(enemy.kind, index + 1);
            placeInstance(mesh, index, {
                position: spot.set(at.x, bob, at.z),
                scale,
                rotation: turn,
            });
            if (enemy.hit > 0) glowInstance(mesh, index, readBodyColor(enemy));
            else tintInstance(mesh, index, readBodyColor(enemy));
        });
        let live = 0;
        for (const fall of falls) {
            fall.age += delta;
            const seconds = fallSeconds[fall.look];
            if (fall.age >= seconds) continue;
            falls[live++] = fall;
            const progress = fall.age / seconds;
            const { radius, color } = enemyStats[fall.kind];
            const height = swarmHeights[fall.kind]! * radius;
            const mesh = meshes.get(fall.kind)!;
            if (fall.look === DeathLook.Shatter) {
                for (let shard = 0; shard < shardsPerFall; shard++) {
                    if (shardCount >= shardCapacity) break;
                    const angle =
                        fall.spin + (shard / shardsPerFall) * Math.PI * 2;
                    const out = (2.2 + (shard % 3) * 0.9) * fall.age;
                    const rise =
                        height * 0.5 +
                        (3 + (shard % 4)) * fall.age -
                        9.8 * fall.age * fall.age;
                    pose.set(fall.age * 9 + shard, fall.age * 7, shard);
                    turn.setFromEuler(pose);
                    placeInstance(shards, shardCount, {
                        position: spot.set(
                            fall.x + Math.cos(angle) * out,
                            Math.max(0.04, rise),
                            fall.z + Math.sin(angle) * out,
                        ),
                        scale: scale.setScalar(
                            height * 0.1 * (1 - progress * 0.7),
                        ),
                        rotation: turn,
                    });
                    if (progress < 0.2)
                        glowInstance(shards, shardCount++, "#ffffff");
                    else glowInstance(shards, shardCount++, color);
                }
                continue;
            }
            const index = counts.get(fall.kind)!;
            if (index >= capacity) continue;
            counts.set(fall.kind, index + 1);
            if (fall.look === DeathLook.Burst) {
                const flash = 0.35;
                const squash = Math.min(1, progress / flash);
                const flatten = Math.max(0, (progress - flash) / (1 - flash));
                scale.set(
                    height * (1 + 0.4 * squash + 0.3 * flatten),
                    height * (1 - 0.35 * squash) * (1 - flatten) ** 2,
                    height * (1 + 0.4 * squash + 0.3 * flatten),
                );
                pose.set(0, fall.yaw, 0);
                turn.setFromEuler(pose).premultiply(lean);
                placeInstance(mesh, index, {
                    position: spot.set(fall.x, 0, fall.z),
                    scale,
                    rotation: turn,
                });
                if (progress < flash) glowInstance(mesh, index, "#ffffff");
                else tintInstance(mesh, index, color);
                continue;
            }
            //  A tumble: thrown back from the soldier, falling onto its
            //  back as it slides, then sinking into the floor.
            const slide = 3.2 * fall.age * (1 - progress * 0.5);
            const sink = Math.max(0, (progress - 0.6) / 0.4);
            pose.set(-Math.min(1, progress * 2.2) * 1.45, fall.yaw, 0);
            turn.setFromEuler(pose);
            placeInstance(mesh, index, {
                position: spot.set(
                    fall.x + fall.awayX * slide,
                    Math.sin(Math.min(1, progress * 2.2) * Math.PI) *
                        height *
                        0.35 -
                        sink * height * 0.5,
                    fall.z + fall.awayZ * slide,
                ),
                scale: scale.setScalar(height),
                rotation: turn,
            });
            if (progress < 0.15) glowInstance(mesh, index, "#ffffff");
            else tintInstance(mesh, index, color);
        }
        falls.length = live;
        for (const [kind, mesh] of meshes)
            finishInstances(mesh, counts.get(kind)!);
        finishInstances(shards, shardCount);
    });

    return (
        <>
            {[...meshes].map(([kind, mesh]) => (
                <primitive key={kind} object={mesh} />
            ))}
            <primitive object={shards} />
        </>
    );
}
