import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { getStore, type Entity as KootaEntity } from "koota";
import { useWorld } from "koota/react";
import {
    GLTFLoader,
    type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
    findPlayerHero,
    TransformTrait,
    useEntity,
    VelocityTrait,
} from "@spawnite/engine";
import {
    AnimationMixer,
    Box3,
    CircleGeometry,
    Color,
    DataTexture,
    LoopOnce,
    LoopRepeat,
    Mesh,
    MeshBasicMaterial,
    MeshToonMaterial,
    NearestFilter,
    RedFormat,
    RingGeometry,
    type AnimationAction,
    type AnimationClip,
    type Group,
    type Material,
} from "@spawnite/engine/three";
import { dashWarning, strikeSeconds } from "../combat/boss";
import { gatherAround, kickDust, trailBehind } from "../combat/motes";
import type { MonsterKind, MonsterModel } from "./kinds";
import { useSpawns, type SpawnSlot } from "./spawns";
import {
    attackLands,
    attackLength,
    attackWindup,
    BossStateTrait,
    MonsterMode,
    MonsterStateTrait,
} from "./traits";

//  A monster drawn as a rigged model from the platform's kit, the far
//  zones' bats, spiders, husks and brutes: toon-lit as she is, it idles,
//  walks as it roams and runs as it hunts, swings its attack over a red
//  ring, flinches and flashes white when hit, and plays its death where it
//  fell. Driven each frame from the fight's state, by writing to its
//  objects, and never by rendering again.

export const monsterModelUrl = (model: MonsterModel) =>
    `${import.meta.env.BASE_URL}models/monsters/${model.file}.glb`;

/** The kit's files are packed with meshopt. */
const withMeshopt = (loader: GLTFLoader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
};

export function preloadMonsterModel(model: MonsterModel) {
    useLoader.preload(GLTFLoader, monsterModelUrl(model), withMeshopt);
}

/** Seconds a blend between its clips takes. */
const blendRate = 8;
/** Metres a second below which it stands rather than walks. */
const standBelow = 0.15;
/** The share of the way to where it should face that it turns a second. */
const turnRate = 10;
/** Seconds before a boss's area attack goes off that it swings, so the
 *  blow lands as the attack does. */
const castSwing = 0.5;
/** Seconds a fallen monster lies before it sinks, and the sinking. */
const lieSeconds = 1.6;
const sinkSeconds = 0.8;

const shadowShape = new CircleGeometry(1, 20);
const shadowMaterial = new MeshBasicMaterial({
    color: "#000000",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
});
const warningShape = new RingGeometry(0.85, 1, 28);

const hurtGlow = new Color("#ffffff");
const hotGlow = new Color("#ff3a1a");
const noGlow = new Color("#000000");

let bands: DataTexture | null = null;
/** Her three light bands, so a monster shades as she does. */
function toonBands() {
    if (!bands) {
        bands = new DataTexture(
            new Uint8Array([90, 180, 255]),
            3,
            1,
            RedFormat,
        );
        bands.minFilter = NearestFilter;
        bands.magFilter = NearestFilter;
        bands.needsUpdate = true;
    }
    return bands;
}

/** How tall the file stands and where its feet are, in its own units:
 *  measured once a load from its meshes as bound. */
const measured = new WeakMap<GLTF, { height: number; bottom: number }>();
function measure(gltf: GLTF) {
    let found = measured.get(gltf);
    if (!found) {
        const box = new Box3();
        const part = new Box3();
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((object) => {
            if (!(object instanceof Mesh)) return;
            if (!object.geometry.boundingBox)
                object.geometry.computeBoundingBox();
            part.copy(object.geometry.boundingBox!).applyMatrix4(
                object.matrixWorld,
            );
            box.union(part);
        });
        found = { height: box.max.y - box.min.y, bottom: box.min.y };
        measured.set(gltf, found);
    }
    return found;
}

/** The clip whose name is `end` or ends in `|end`, as Blender names them. */
function clipNamed(gltf: GLTF, end: string) {
    return gltf.animations.find(
        (clip) => clip.name === end || clip.name.endsWith(`|${end}`),
    );
}

type Body = {
    root: Group;
    mixer: AnimationMixer;
    materials: MeshToonMaterial[];
    idle: AnimationAction;
    walk: AnimationAction;
    run: AnimationAction | null;
    attack: AnimationAction;
    hit: AnimationAction | null;
    death: AnimationClip | undefined;
};

/** A copy of the model of its own, sized to the kind, its materials toon
 *  ones of its own to flash, and its clips ready. */
function buildBody(gltf: GLTF, kind: MonsterKind, model: MonsterModel): Body {
    const root = cloneSkinned(gltf.scene) as Group;
    const materials: MeshToonMaterial[] = [];
    const tint = model.tint ? new Color(model.tint) : null;
    const toon = (from: Material) => {
        const old = from as MeshToonMaterial;
        const color = old.color?.clone() ?? new Color("#ffffff");
        if (tint) color.lerp(tint, 0.5);
        const made = new MeshToonMaterial({
            map: old.map ?? null,
            color,
            gradientMap: toonBands(),
        });
        materials.push(made);
        return made;
    };
    root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.material = Array.isArray(object.material)
            ? object.material.map(toon)
            : toon(object.material);
        object.castShadow = true;
        //  A bound pose's box does not follow the run: never culled.
        object.frustumCulled = false;
    });
    const { height, bottom } = measure(gltf);
    const scale = kind.size / height;
    root.scale.setScalar(scale);
    root.position.y = -bottom * scale + (model.hover ?? 0);
    //  Where a flier bobs from.
    root.userData.base = root.position.y;

    const mixer = new AnimationMixer(root);
    const looping = (name: string | undefined) => {
        const clip = name ? clipNamed(gltf, name) : undefined;
        if (!clip) return null;
        const action = mixer.clipAction(clip);
        action.setLoop(LoopRepeat, Infinity).play();
        action.setEffectiveWeight(0);
        return action;
    };
    const once = (name: string | undefined) => {
        const clip = name ? clipNamed(gltf, name) : undefined;
        if (!clip) return null;
        const action = mixer.clipAction(clip);
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        return action;
    };
    //  A flinch lets go when it ends, rather than holding its last frame.
    const flinch = (name: string | undefined) => {
        const action = once(name);
        if (action) action.clampWhenFinished = false;
        return action;
    };
    const idle = looping(model.clips.idle)!;
    idle.setEffectiveWeight(1);
    return {
        root,
        mixer,
        materials,
        idle,
        walk: looping(model.clips.walk) ?? idle,
        run: looping(model.clips.run),
        attack: once(model.clips.attack)!,
        hit: flinch(model.clips.hit),
        death: clipNamed(gltf, model.clips.death),
    };
}

/** A turn wrapped to within half a turn either way. */
function wrap(angle: number) {
    return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));
}

/** `from` moved toward `to` by at most `step`. */
function approach(from: number, to: number, step: number) {
    return from < to ? Math.min(to, from + step) : Math.max(to, from - step);
}

export function ModelBody({
    kind,
    model,
    slot,
}: {
    kind: MonsterKind;
    model: MonsterModel;
    slot: SpawnSlot;
}) {
    const entity = useEntity();
    const world = useWorld();
    const gltf = useLoader(GLTFLoader, monsterModelUrl(model), withMeshopt);
    const body = useMemo(
        () => buildBody(gltf, kind, model),
        [gltf, kind, model],
    );
    const turn = useRef<Group>(null);
    const lean = useRef<Group>(null);
    const shadow = useRef<Mesh>(null);
    const warning = useRef<Mesh>(null);
    const warningMaterial = useRef<MeshBasicMaterial>(null);
    const hero = useRef<KootaEntity | undefined>(undefined);
    //  What carries over from frame to frame: the way it faces, the last
    //  attack and hit flash seen, and whether it is swinging a cast.
    const [motion] = useState(() => ({
        facing: 0,
        attack: -1,
        flash: 0,
        swinging: false,
        glow: noGlow,
    }));

    //  Hung in its turning group here rather than drawn by React, so that
    //  as it falls it is handed, where it stands, to the falls, which play
    //  its death; gone for another reason, it is let go.
    useLayoutEffect(() => {
        const holder = lean.current;
        if (!holder) return;
        holder.add(body.root);
        return () => {
            const now = useSpawns.getState().slots[slot.id];
            const fell =
                !!now && (!now.alive || now.generation !== slot.generation);
            if (fell && fallsRoot && body.death) fall(body);
            else {
                body.root.removeFromParent();
                body.materials.forEach((material) => material.dispose());
            }
        };
    }, [body, slot.id, slot.generation]);

    useFrame(({ clock }, delta) => {
        if (
            !entity.isAlive() ||
            !turn.current ||
            !lean.current ||
            !shadow.current ||
            !warning.current ||
            !warningMaterial.current
        )
            return;
        const index = entity.id();
        const state = entity.has(MonsterStateTrait)
            ? getStore(world, MonsterStateTrait)
            : null;
        const flash = state ? state.flash[index] : 0;
        const attack = state ? state.attack[index] : -1;
        const knock = state ? state.knockSeconds[index] : 0;
        const hunting = !!state && state.mode[index] === MonsterMode.Hunt;
        const boss = entity.has(BossStateTrait)
            ? getStore(world, BossStateTrait)
            : null;
        const casting = boss ? boss.casting[index] : 0;
        const dashIn = boss ? boss.dashIn[index] : -1;
        const dashing = boss ? boss.dashing[index] : 0;
        const element = kind.boss?.element ?? "moss";
        const velocity = entity.get(VelocityTrait);
        const speed = Math.hypot(velocity?.x ?? 0, velocity?.z ?? 0);
        const attacking = attack >= 0;
        const knocked = knock > 0;

        //  It faces its attack, else its way, else the hero it hunts; a
        //  boss the way it casts or dashes. The model faces +z.
        let aim = motion.facing;
        let rate = turnRate;
        if (attacking && state) {
            aim = Math.atan2(state.lungeX[index], state.lungeZ[index]);
            rate = turnRate * 2;
        } else if (!knocked && speed > standBelow && velocity)
            aim = Math.atan2(velocity.x, velocity.z);
        else if (!knocked && hunting) {
            if (!hero.current?.isAlive()) hero.current = findPlayerHero(world);
            const heroAt = hero.current?.get(TransformTrait);
            const at = entity.get(TransformTrait);
            if (heroAt && at)
                aim = Math.atan2(heroAt.x - at.x, heroAt.z - at.z);
        }
        if (boss && casting > 0)
            aim = Math.atan2(boss.castX[index], boss.castZ[index]);
        else if (boss && (dashIn >= 0 || dashing > 0)) {
            aim = Math.atan2(boss.dashX[index], boss.dashZ[index]);
            rate = turnRate * 2;
        }
        motion.facing += wrap(aim - motion.facing) * Math.min(1, delta * rate);

        //  Its swing: each attack plays the clip across the attack's length,
        //  so the blow lands as the hit does; a boss swings as its area
        //  attack goes off.
        let swing = false;
        if (attacking && (motion.attack < 0 || attack < motion.attack)) {
            const clip = body.attack.getClip();
            body.attack
                .reset()
                .setEffectiveTimeScale(clip.duration / attackLength)
                .play();
        }
        if (attacking) swing = true;
        motion.attack = attack;
        const castLeft = casting - strikeSeconds;
        if (boss && casting > 0 && castLeft <= castSwing) {
            if (!motion.swinging) {
                const clip = body.attack.getClip();
                body.attack
                    .reset()
                    .setEffectiveTimeScale(
                        clip.duration / (castSwing + strikeSeconds),
                    )
                    .play();
                motion.swinging = true;
            }
            swing = true;
        } else motion.swinging = false;

        //  A new hit makes it flinch, if it has a flinch and is not swinging.
        if (flash > motion.flash + 1e-4 && body.hit && !swing)
            body.hit.reset().setEffectiveWeight(1).play();
        motion.flash = flash;

        //  Its feet: it stands, walks as it roams, or runs as it hunts, at
        //  the pace it moves; a dash is a sprint.
        const moving = speed > standBelow && !knocked;
        const running = moving && !!body.run && (hunting || dashing > 0);
        const pace = running
            ? (model.runPace ?? model.walkPace)
            : model.walkPace;
        const step = Math.min(1, delta * blendRate);
        const under = swing ? 0 : 1;
        const flinch = body.hit?.isRunning()
            ? body.hit.getEffectiveWeight()
            : 0;
        const feet = under * (1 - flinch);
        body.idle.setEffectiveWeight(
            approach(body.idle.getEffectiveWeight(), moving ? 0 : feet, step),
        );
        if (body.walk !== body.idle) {
            body.walk.setEffectiveWeight(
                approach(
                    body.walk.getEffectiveWeight(),
                    moving && !running ? feet : 0,
                    step,
                ),
            );
            body.walk.setEffectiveTimeScale(
                Math.min(2.2, Math.max(0.6, speed / model.walkPace)),
            );
        }
        if (body.run) {
            body.run.setEffectiveWeight(
                approach(
                    body.run.getEffectiveWeight(),
                    running ? feet : 0,
                    step,
                ),
            );
            body.run.setEffectiveTimeScale(
                Math.min(2.2, Math.max(0.6, speed / pace)),
            );
        }
        body.attack.setEffectiveWeight(
            approach(body.attack.getEffectiveWeight(), swing ? 1 : 0, step * 2),
        );
        body.mixer.update(delta);

        //  A boss gathers its element and trembles hot through a warning,
        //  and leaves a wake as it dashes.
        let hot = attacking && attack < attackLands;
        let shake = 0;
        const at = entity.get(TransformTrait);
        if (boss && casting > 0 && castLeft > castSwing) {
            const gathering = Math.max(
                0.01,
                boss.castLength[index] - castSwing - strikeSeconds,
            );
            const charge = Math.min(1, 1 - (castLeft - castSwing) / gathering);
            shake = Math.sin(clock.elapsedTime * 70) * 0.04 * charge;
            hot = true;
            if (at)
                gatherAround(
                    at.x,
                    at.y,
                    at.z,
                    kind.radius,
                    element,
                    0.3 + charge,
                    delta,
                );
        } else if (boss && dashIn >= 0) {
            shake =
                Math.sin(clock.elapsedTime * 70) *
                0.04 *
                (1 - dashIn / dashWarning);
            hot = true;
        } else if (boss && dashing > 0 && at) {
            trailBehind(at.x, at.y, at.z, kind.radius, element, delta);
        } else if (running && at && !model.hover)
            kickDust(at.x, at.y, at.z, delta * 0.3);

        //  Knocked back, it tips away from the blow.
        let pitch = 0;
        let roll = 0;
        if (knocked && state) {
            const pushX = state.knockX[index];
            const pushZ = state.knockZ[index];
            const push = Math.hypot(pushX, pushZ);
            if (push > 1e-3) {
                const tip = (Math.min(1, knock / 0.14) * 0.18) / push;
                const sin = Math.sin(motion.facing);
                const cos = Math.cos(motion.facing);
                pitch -= (pushX * sin + pushZ * cos) * tip;
                roll += (pushX * cos - pushZ * sin) * tip;
            }
        }
        turn.current.rotation.y = motion.facing;
        lean.current.rotation.set(pitch, 0, roll);
        lean.current.position.x = shake * kind.size;
        //  A bat bobs as it flies.
        if (model.hover)
            body.root.position.y =
                body.root.userData.base +
                Math.sin(clock.elapsedTime * 5 + index) * 0.08;

        const glow = flash > 0 ? hurtGlow : hot ? hotGlow : noGlow;
        if (glow !== motion.glow) {
            motion.glow = glow;
            for (const material of body.materials) {
                material.emissive.copy(glow);
                material.emissiveIntensity = glow === hurtGlow ? 0.7 : 0.45;
            }
        }

        //  The warning ring grows red under it through the wind-up.
        const warned = attacking && attack < attackLands;
        warning.current.visible = warned;
        if (warned) {
            const grown = Math.min(1, attack / attackWindup);
            warning.current.scale.setScalar(kind.radius * (1 + grown * 0.8));
            warningMaterial.current.opacity = 0.35 + 0.45 * grown;
        }
    });

    return (
        <>
            <mesh
                ref={shadow}
                geometry={shadowShape}
                material={shadowMaterial}
                rotation-x={-Math.PI / 2}
                position-y={0.03}
                scale={kind.radius * 1.1}
            />
            <mesh
                ref={warning}
                geometry={warningShape}
                rotation-x={-Math.PI / 2}
                position-y={0.05}
                visible={false}
            >
                <meshBasicMaterial
                    ref={warningMaterial}
                    color="#ff3030"
                    transparent
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <group ref={turn}>
                <group ref={lean} />
            </group>
        </>
    );
}

//  The fallen: each plays its death where it fell, lies a moment, and
//  sinks into the ground. Its Entity is gone by then, so it is held here.

type Fallen = { body: Body; age: number; length: number };
const fallen: Fallen[] = [];
let fallsRoot: Group | null = null;

function fall(body: Body) {
    fallsRoot!.attach(body.root);
    body.mixer.stopAllAction();
    const dying = body.mixer.clipAction(body.death!);
    dying.setLoop(LoopOnce, 1);
    dying.clampWhenFinished = true;
    dying.reset().setEffectiveWeight(1).play();
    for (const material of body.materials) {
        material.emissive.copy(noGlow);
        material.transparent = true;
        material.needsUpdate = true;
    }
    fallen.push({ body, age: 0, length: body.death!.duration + lieSeconds });
}

function letGo(body: Body) {
    body.root.removeFromParent();
    body.materials.forEach((material) => material.dispose());
}

/** Where the fallen lie. Mounted once, beside the monsters. */
export function ModelFalls() {
    const root = useRef<Group>(null);

    useLayoutEffect(() => {
        fallsRoot = root.current;
        return () => {
            fallsRoot = null;
            fallen.splice(0).forEach(({ body }) => letGo(body));
        };
    }, []);

    useFrame((_, delta) => {
        for (let index = fallen.length - 1; index >= 0; index--) {
            const one = fallen[index];
            one.age += delta;
            one.body.mixer.update(delta);
            const sinking = (one.age - one.length) / sinkSeconds;
            if (sinking > 0) {
                one.body.root.position.y -= delta * 0.6;
                for (const material of one.body.materials)
                    material.opacity = Math.max(0, 1 - sinking);
            }
            if (sinking >= 1) {
                letGo(one.body);
                fallen.splice(index, 1);
            }
        }
    });

    return <group ref={root} />;
}
