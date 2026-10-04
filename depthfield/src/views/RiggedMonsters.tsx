import { useFrame } from "@react-three/fiber";
import { createQuery, type Entity } from "koota";
import { useWorld } from "koota/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
    AnimationMixer,
    Color,
    Euler,
    Group,
    Mesh,
    Quaternion,
    Vector3,
    type AnimationAction,
    type MeshMatcapMaterial,
    type Texture,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { readEach, useModel } from "@spawnite/engine";
import { EnemyKind } from "../rules/data";
import { readHeroPosition } from "../rules/field";
import { EnemyTrait, EnemyPhase, FelledTrait } from "../rules/traits";
import { DeathLook, useLook } from "../store/look";
import { blendPosition, readStepFraction } from "./instances";
import { createModelMaterial } from "./matcap";
import { readLeanTurn, riggedModels, type RiggedMonster } from "./models";
import { liftNeon } from "./neon";
import { useEventRecords } from "./useEventRecords";
import { kickShake } from "./shake";

//  The elites and the boss as rigged Meshy models, each with its own
//  mixer: walking at a stroll and running as it rushes, turned to the
//  soldier or along its dash, and lit white by a hit. The boss's fall
//  flashes and sinks it, spinning, into the floor; an elite's plays the
//  Look panel's death in a copy left where it fell.

const enemies = createQuery(EnemyTrait);

/** Seconds an elite's copy plays its fall. */
const corpseSeconds = 0.6;

/** Metres a second past which a rigged monster runs rather than walks. */
const runPastSpeed = 2.4;

/** The colour each rigged kind is tinted where its file has no texture. */
const tints: Partial<Record<EnemyKind, string>> = {
    [EnemyKind.Elite]: "#f4d56a",
    [EnemyKind.CrimsonElite]: "#ff6f5e",
    [EnemyKind.Boss]: "#ffffff",
};

/** A rigged monster's model as drawn, with its mixer and its clips. */
interface Rig {
    root: Group;
    mixer: AnimationMixer;
    walk: AnimationAction;
    run: AnimationAction;
    materials: MeshMatcapMaterial[];
    /** Each material's colour away from a flash. */
    base: Color;
}

function readRiggedModel(kind: EnemyKind): RiggedMonster {
    const model = riggedModels[kind];
    if (!model) throw new Error(`${kind} has no rigged model.`);
    return model;
}

/** A copy of `kind`'s model, dressed in the matcap. */
function useRig(kind: EnemyKind): Rig {
    const model = readRiggedModel(kind);
    const { scene, animations } = useModel(model.url);
    const rims = useLook((look) => look.rims);
    const rig = useMemo(() => {
        const root = new Group();
        const copy = clone(scene);
        copy.scale.setScalar(model.metres / model.rigMetres);
        root.add(copy);
        const base = new Color(tints[kind] ?? "#ffffff");
        const materials: MeshMatcapMaterial[] = [];
        copy.traverse((node) => {
            if (!(node instanceof Mesh)) return;
            //  A glTF material is a MeshStandardMaterial, whose map is
            //  the file's base colour, when it has one.
            const map = (node.material as { map?: Texture | null }).map;
            const material = createModelMaterial(rims, map ?? null);
            material.color.copy(base);
            node.material = material;
            node.frustumCulled = false;
            materials.push(material);
        });
        const mixer = new AnimationMixer(copy);
        const action = (name: string) => {
            const clip = animations.find((each) => each.name === name);
            if (!clip) throw new Error(`${model.url} has no ${name} clip.`);
            return mixer.clipAction(clip);
        };
        const walk = action("walk").play();
        const run = action("run").play();
        run.weight = 0;
        return { root, mixer, walk, run, materials, base };
    }, [scene, animations, model, kind, rims]);
    useEffect(
        () => () => {
            for (const material of rig.materials) material.dispose();
        },
        [rig],
    );
    return rig;
}

/** Lights every material of `rig` white, or back to its colour. */
function flashRig(rig: Rig, lit: boolean) {
    for (const material of rig.materials)
        if (lit) liftNeon("#ffffff", material.color);
        else material.color.copy(rig.base);
}

//  Written in place each frame.
const at = new Vector3();
const last = new Vector3();
const lean = new Quaternion();
const pose = new Euler(0, 0, 0, "YXZ");

interface LiveMonsterProps {
    entity: Entity;
    kind: EnemyKind;
}

/** A living elite or the boss, following its entity. */
function LiveMonster({ entity, kind }: LiveMonsterProps) {
    const world = useWorld();
    const rig = useRig(kind);
    const state = useRef({ yaw: 0, placed: false });
    useFrame((_, delta) => {
        const enemy = entity.isAlive() ? entity.get(EnemyTrait) : undefined;
        if (!enemy) return;
        last.copy(rig.root.position);
        blendPosition(entity, readStepFraction(), at);
        rig.root.position.copy(at);
        const speed = state.current.placed
            ? last.distanceTo(at) / Math.max(delta, 1e-3)
            : 0;
        state.current.placed = true;
        const running = speed > runPastSpeed;
        rig.run.weight += ((running ? 1 : 0) - rig.run.weight) * 0.2;
        rig.walk.weight = 1 - rig.run.weight;
        rig.walk.timeScale = Math.max(0.4, speed / 1.2);
        rig.run.timeScale = Math.max(0.8, speed / 4);
        const hero = readHeroPosition(world);
        const rushing = enemy.phase === EnemyPhase.RushDash;
        const yaw = rushing
            ? Math.atan2(enemy.dashX, enemy.dashZ)
            : Math.atan2(hero.x - at.x, hero.z - at.z);
        state.current.yaw = yaw;
        //  The boss's fall: a white flash, then down into the floor,
        //  turning, as it bursts apart.
        const falling = enemy.dying
            ? Math.min(1, enemy.deathSeconds / 1.15)
            : 0;
        pose.set(falling * 0.5, yaw + falling * 2.5, 0);
        rig.root.quaternion
            .setFromEuler(pose)
            .premultiply(readLeanTurn(useLook.getState().lean, lean));
        rig.root.position.y = -falling * falling * 2;
        rig.root.scale.setScalar(1 - falling * 0.35);
        flashRig(rig, enemy.hit > 0 || (falling > 0 && falling < 0.3));
        rig.mixer.update(falling > 0 ? delta * 0.3 : delta);
    });
    return <primitive object={rig.root} />;
}

/** An elite's fall, played in a copy where it died. */
interface Corpse {
    id: number;
    kind: EnemyKind;
    x: number;
    z: number;
    yaw: number;
    look: DeathLook;
}

interface FallingMonsterProps {
    corpse: Corpse;
    onDone: (id: number) => void;
}

function FallingMonster({ corpse, onDone }: FallingMonsterProps) {
    const rig = useRig(corpse.kind);
    const age = useRef(0);
    useFrame((_, delta) => {
        age.current += delta;
        const progress = Math.min(1, age.current / corpseSeconds);
        if (progress >= 1) {
            onDone(corpse.id);
            return;
        }
        rig.root.position.set(corpse.x, 0, corpse.z);
        readLeanTurn(useLook.getState().lean, lean);
        if (corpse.look === DeathLook.Tumble) {
            pose.set(-Math.min(1, progress * 2) * 1.45, corpse.yaw, 0);
            rig.root.quaternion.setFromEuler(pose);
            rig.root.position.y = -Math.max(0, progress - 0.6) * 2;
        } else {
            //  A burst, and a shatter's model, squash flat and white.
            pose.set(0, corpse.yaw, 0);
            rig.root.quaternion.setFromEuler(pose).premultiply(lean);
            const squash = Math.min(1, progress / 0.35);
            const flatten = Math.max(0, (progress - 0.35) / 0.65);
            rig.root.scale.set(
                1 + 0.4 * squash + 0.3 * flatten,
                (1 - 0.35 * squash) * (1 - flatten) ** 2,
                1 + 0.4 * squash + 0.3 * flatten,
            );
        }
        flashRig(rig, progress < 0.35);
    });
    return <primitive object={rig.root} />;
}

interface Living {
    entity: Entity;
    kind: EnemyKind;
}

export function RiggedMonsters() {
    const world = useWorld();
    //  Loaded as the field mounts, so the first elite at one minute draws
    //  at once rather than waiting on its file.
    useEffect(() => {
        for (const model of Object.values(riggedModels))
            useModel.preload(model.url);
    }, []);
    const [living, setLiving] = useState<Living[]>([]);
    const [corpses, setCorpses] = useState<Corpse[]>([]);
    const key = useRef("");
    const nextId = useRef(0);
    useEventRecords(
        FelledTrait,
        (entity) => entity.get(FelledTrait)?.list,
        (fall) => {
            if (!riggedModels[fall.kind]) return;
            const hero = readHeroPosition(world);
            const look = useLook.getState();
            const corpse = {
                id: nextId.current++,
                kind: fall.kind,
                x: fall.x,
                z: fall.z,
                yaw: Math.atan2(hero.x - fall.x, hero.z - fall.z),
                look: look.death,
            };
            if (look.shake) kickShake(0.3);
            setCorpses((shown) => [...shown, corpse]);
        },
    );
    useFrame(() => {
        const found: Living[] = [];
        readEach(world, enemies, ([enemy], entity) => {
            if (riggedModels[enemy.kind])
                found.push({ entity, kind: enemy.kind });
        });
        const next = found.map((each) => each.entity).join();
        if (next === key.current) return;
        key.current = next;
        setLiving(found);
    });
    const finish = (id: number) =>
        setCorpses((shown) => shown.filter((corpse) => corpse.id !== id));
    return (
        <>
            {/*  Each its own boundary: a model still loading hides only
                itself, never the rest of the field. */}
            {living.map(({ entity, kind }) => (
                <Suspense key={entity} fallback={null}>
                    <LiveMonster entity={entity} kind={kind} />
                </Suspense>
            ))}
            {corpses.map((corpse) => (
                <Suspense key={corpse.id} fallback={null}>
                    <FallingMonster corpse={corpse} onDone={finish} />
                </Suspense>
            ))}
        </>
    );
}
