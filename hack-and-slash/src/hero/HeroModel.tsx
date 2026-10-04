import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import type { Entity, TraitRecord } from "koota";
import { TransformTrait, VelocityTrait } from "@spawnite/engine";
import {
    AnimationMixer,
    AnimationUtils,
    FileLoader,
    LoopOnce,
    LoopRepeat,
    Mesh,
    Quaternion,
    Vector3,
    type AnimationAction,
    type AnimationClip,
    type Group,
    type Material,
    type Object3D,
    type SkinnedMesh,
} from "@spawnite/engine/three";
import {
    GLTFLoader,
    type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { gearMotes, kickDust, type GearEffect } from "../combat/motes";
import { dodgeSeconds } from "../combat/systems";
import { HeroCombatTrait } from "../combat/traits";
import {
    glowOf,
    itemDef,
    weaponKinds,
    type EquipSlot,
    type WeaponKind,
} from "../items/items";
import { cueMoves } from "../classes/schema";
import { useDetail } from "../view/graphics";
import {
    applyGear,
    applyLook,
    glowGear,
    type GearGlows,
    buildHeroRig,
    followBones,
    levelHead,
    sizeHead,
    turnBone,
    type HeroRig,
    type ModelGear,
} from "./modelRig";
import { lookColors, type Look } from "./look";
import { fitMove, type MoveName, type Moves } from "./moves";
import { deriveHero, useProgress, type Mods } from "./progress";

const base = import.meta.env.BASE_URL;
/** The creator's bald base, running: her model cut from 106,000 triangles
 *  to 60,000, each corner shared by the triangles that meet there, so she
 *  is skinned at 30,000 points a frame rather than 317,000. From where the
 *  camera watches her, she looks the same. */
export const heroModelUrl = `${base}models/hero/base-running.glb`;
/** The same, cut to 18,000 triangles for low graphics: her face keeps
 *  every vertex its painted face is shaped from, and her body, arms and
 *  legs, which her outfit and armor cover, give up the rest. */
export const heroLowModelUrl = `${base}models/hero/base-running-low.glb`;

//  Both fetched as the game loads: Auto can move her between them in the
//  middle of a fight, and a model still loading would blank the scene.
useLoader.preload(GLTFLoader, heroModelUrl);
useLoader.preload(GLTFLoader, heroLowModelUrl);

/** Her moves beyond the run: from the creator's rigged berserker and
 *  arcane robes, fitted to her as she loads (`moves.ts`). */
export const heroMovesUrl = `${base}models/hero/moves.json`;

/** Metres a second her run and walk clips are drawn for: faster walking
 *  plays them faster, so her feet keep up with the ground. */
const clipSpeed = 2.6;
const walkClipSpeed = 1.2;
/** Metres a second below which she stands; and between which her walk
 *  gives way to her run. */
const standBelow = 0.3;
const walkUntil = 1.6;
const runFrom = 2.6;
/** Seconds after an attack she still walks as in a fight, guard up. */
const fightSeconds = 2.5;
/** Seconds she stands before she fidgets, and between fidgets. */
const fidgetAfter = 7;
/** Seconds a crossbow's shot holds her arm out. */
const aimSeconds = 0.3;
/** Seconds she keeps facing where she attacked. */
const faceAttackSeconds = 0.45;
/** Radians a second her Cyclone whirls her round. */
const spinTurn = 16;
/** The slash's cut, in its frames at 30 a second: from the top of her
 *  windup, across her front from her right, to the blade at her left. It
 *  plays at the pace it was drawn, the blade crossing her front a fifth of
 *  a second after the attack, and faster only when she attacks faster
 *  than it takes. */
const cutFrames = [11, 24] as const;
const cutPace = 1;
/** Seconds a move fades in over, and out over at its end. */
const moveIn = 0.05;
const moveOut = 0.12;
/** The bones above her hips: a move played while she runs turns only
 *  these, so her legs keep running under it. */
const upperBones = /Spine|Neck|Head|Shoulder|Arm|Hand|headfront/;

const modelRight = new Vector3(1, 0, 0);
const modelUp = new Vector3(0, 1, 0);

/** Drawn after the fight's effects, which draw over the ground: a sword's
 *  arc shows on a hillside, and she stands in front of it. A tree in
 *  front of her still hides her, since she is depth tested as ever. */
const overEffects = 20;

//  Written in place each frame.
const parentTurn = new Quaternion();
const facingTurn = new Quaternion();
const leanTurn = new Quaternion();

/** The hero, drawn as the creator's model where her body stands: she is
 *  recoloured from her look, wears her gear, runs as she walks, stands
 *  when she stops, and swings or draws as she attacks. Mounted as the
 *  Player's overlay. */
export function HeroModel({ entity }: { entity: Entity }) {
    const detail = useDetail();
    const low = detail === "low" || detail === "minimum";
    const source = heroSource(
        useLoader(GLTFLoader, low ? heroLowModelUrl : heroModelUrl),
    );
    const moves = useLoader(FileLoader, heroMovesUrl, (loader) =>
        loader.setResponseType("json"),
    ) as unknown as Moves;
    const look = useProgress((state) => state.look);
    const equipped = useProgress((state) => state.equipped);
    const equippedMods = useProgress((state) => state.equippedMods);
    //  Her gear merged up past +7 glows; from its first effect, at +10, it
    //  gives off its effects' motes in place of the glow.
    const { glows, trails } = useMemo(() => {
        const glows: GearGlows = {};
        const trails: Trail[] = [];
        for (const [slot, mods] of Object.entries(equippedMods) as [
            EquipSlot,
            Mods,
        ][]) {
            if (!equipped[slot]) continue;
            const effects = mods.effects ?? [];
            if (effects.length > 0)
                trails.push({
                    slot,
                    effects: [
                        ...new Set(
                            effects.map((effect) => effect.kind as GearEffect),
                        ),
                    ],
                    held: itemDef(equipped[slot]!).weapon,
                });
            else {
                const glow = glowOf(mods.plus ?? 0);
                if (glow) glows[slot] = glow;
            }
        }
        return { glows, trails };
    }, [equipped, equippedMods]);
    const anchor = useRef<Group>(null);

    const { rig, mixer, actions } = useMemo(() => {
        const rig = buildHeroRig(source);
        const mixer = new AnimationMixer(rig.body);
        const clip = source.animations.reduce((a, b) =>
            b.duration > a.duration ? b : a,
        );
        const fitted = (name: MoveName) =>
            fitMove(name, moves[name], rig.skinned, rig.body);
        const cut = AnimationUtils.subclip(
            fitted("slash"),
            "cut",
            cutFrames[0],
            cutFrames[1],
            moves.slash.fps,
        );
        const parry = fitted("parry");
        const actions = heroActions(mixer, rig.body, clip, fitted, cut, parry);
        return { rig, mixer, actions };
    }, [source, moves]);

    //  A development playtest's handle on her rig, to fit gear by eye.
    //  Not in a build.
    useEffect(() => {
        if (import.meta.env.DEV)
            Object.assign(window, {
                bladeboundRig: rig,
                bladeboundProgress: useProgress,
            });
    }, [rig]);

    useEffect(() => {
        const colors = lookColors(look);
        applyLook(rig, { ...colors, face: look.face, style: look.hair });
    }, [rig, look]);

    useEffect(() => {
        applyGear(rig, equipped);
        drawAfterEffects(rig.root);
    }, [rig, equipped]);

    //  The engine draws her body as a capsule beside this overlay: she is
    //  her model, so the capsule hides.
    useLayoutEffect(() => {
        const shown: Mesh[] = [];
        anchor.current?.parent?.children.forEach((child) => {
            if (child instanceof Mesh && child.visible) {
                child.visible = false;
                shown.push(child);
            }
        });
        return () => shown.forEach((mesh) => (mesh.visible = true));
    }, []);

    //  Toward the camera until she first moves: the model faces +z.
    const facing = useRef(0);
    const motion = useRef<Motion>({
        lastAttack: Infinity,
        lastCast: Infinity,
        hurt: false,
        still: 0,
        playing: null,
    });
    useFrame(({ clock }, delta) => {
        if (!entity.isAlive() || !anchor.current) return;
        const combat = entity.get(HeroCombatTrait);
        const velocity = entity.get(VelocityTrait);
        const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
        const attacking = !!combat && combat.sinceAttack < faceAttackSeconds;
        const dodging = !!combat && combat.dodge > 0;
        const spinning = !!combat && combat.spin > 0;
        //  She faces where she attacks, else where she walks. The model
        //  faces +z, so a yaw of atan2(x, z) turns it onto (x, z). The
        //  engine turns the group she hangs in; undo its turn, so she faces
        //  the way chosen here.
        //  Her Cyclone whirls her round, faster than any turn.
        if (spinning) facing.current += delta * spinTurn;
        else if (dodging)
            facing.current = Math.atan2(combat!.dodgeX, combat!.dodgeZ);
        else if (attacking)
            facing.current = Math.atan2(combat!.dirX, combat!.dirZ);
        else if (speed > standBelow && velocity)
            facing.current = Math.atan2(velocity.x, velocity.z);
        anchor.current.parent!.getWorldQuaternion(parentTurn);
        facingTurn.setFromAxisAngle(modelUp, facing.current);
        anchor.current.quaternion
            .copy(parentTurn.invert())
            .multiply(facingTurn);
        //  A dodge: she leans into it, her legs a blur, dust at her feet.
        if (dodging) {
            const through = 1 - combat!.dodge / dodgeSeconds;
            leanTurn.setFromAxisAngle(
                modelRight,
                Math.sin(through * Math.PI) * 0.45,
            );
            anchor.current.quaternion.multiply(leanTurn);
            const at = entity.get(TransformTrait);
            if (at) kickDust(at.x, at.y, at.z, delta);
        }

        move(
            actions,
            motion.current,
            combat,
            dodging ? clipSpeed * 2.2 : speed,
            delta,
        );
        mixer.update(delta);
        sizeHead(rig);
        rig.root.updateMatrixWorld(true);
        levelHead(rig);
        poseCrossbow(rig, combat);
        rig.root.updateMatrixWorld(true);
        followBones(rig);
        rig.uniforms.uHurt.value = (combat?.flash ?? 0) > 0 ? 1 : 0;
        glowGear(rig, glows, clock.elapsedTime);
        trailGear(rig, trails, delta);
    });

    return (
        <group ref={anchor}>
            <primitive object={rig.root} />
            <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
                <circleGeometry args={[0.38, 16]} />
                <meshBasicMaterial
                    color="#000000"
                    transparent
                    opacity={0.3}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}

/** A worn piece with effects: its slot, its effects, and the weapon it is,
 *  if one: a sword gives them off along its blade, a crossbow round her
 *  fist, in her off hand as in her main. */
type Trail = { slot: EquipSlot; effects: GearEffect[]; held?: WeaponKind };

/** Motes a second each effect gives off a weapon, and any other piece. */
const weaponMotes = 28;
const pieceMotes = 14;
/** Metres along a sword from the middle of its grip that its blade runs,
 *  as it is drawn. */
const bladeFrom = 0.3;
const bladeTo = 1.02;

//  Written in place each frame.
const trailPoint = new Vector3();

/** Each worn piece with effects gives off their motes: a sword along its
 *  blade, a crossbow round her fist, a shield from its face, headgear from
 *  her crown, and armor from her body, hands or feet. */
function trailGear(rig: HeroRig, trails: Trail[], delta: number) {
    for (const { slot, effects, held } of trails) {
        for (const effect of effects) {
            let spread: number;
            let rate = pieceMotes;
            if (held) {
                const off = slot === "shield";
                trailPoint.copy(off ? rig.leftGrip : rig.grip);
                if (held === "sword")
                    trailPoint.z +=
                        bladeFrom + Math.random() * (bladeTo - bladeFrom);
                else trailPoint.z += Math.random() * 0.4;
                trailPoint.applyMatrix4(
                    (off ? rig.mounts.offHand : rig.mounts.weapon).group
                        .matrixWorld,
                );
                spread = 0.06;
                rate = weaponMotes;
            } else if (slot === "shield") {
                trailPoint
                    .set(0.11, -0.08, 0.04)
                    .applyMatrix4(rig.mounts.shield.group.matrixWorld);
                spread = 0.3;
            } else if (slot === "head") {
                trailPoint
                    .set(0, 0.55, 0)
                    .applyMatrix4(rig.mounts.head.group.matrixWorld);
                spread = 0.5;
            } else if (slot === "hands") {
                const mount =
                    Math.random() < 0.5 ? rig.mounts.weapon : rig.mounts.shield;
                trailPoint.set(0, 0, 0).applyMatrix4(mount.group.matrixWorld);
                spread = 0.15;
            } else {
                //  Her body, or her feet, from where she stands.
                rig.root.getWorldPosition(trailPoint);
                trailPoint.y += slot === "feet" ? 0.12 : 0.75;
                spread = slot === "feet" ? 0.35 : 0.45;
            }
            gearMotes(
                effect,
                trailPoint.x,
                trailPoint.y,
                trailPoint.z,
                spread,
                rate,
                delta,
            );
        }
    }
}

const sources = new WeakMap<GLTF, Group>();

/** The loaded model as the rig reads it, with its run: once per load, as
 *  every copy shares it. glTF binds a skin in the model's own frame, but
 *  the rig measures her head and hangs her gear in the frame her mesh
 *  stands in, Y-up centimetres, where the creator's file bound it.
 *  Rebinding with the mesh's place as the bind matrix, and each bone's
 *  inverse bind matrix undone by it, draws her exactly the same. */
function heroSource(gltf: GLTF) {
    let source = sources.get(gltf);
    if (source) return source;
    source = gltf.scene;
    source.animations = gltf.animations;
    source.updateMatrixWorld(true);
    const unscene = source.matrixWorld.clone().invert();
    source.traverse((node) => {
        const mesh = node as SkinnedMesh;
        if (!mesh.isSkinnedMesh) return;
        const place = unscene.clone().multiply(mesh.matrixWorld);
        const unplace = place.clone().invert();
        for (const inverse of mesh.skeleton.boneInverses)
            inverse.multiply(unplace);
        mesh.bind(mesh.skeleton, place);
    });
    sources.set(gltf, source);
    return source;
}

/** Sorts her and her gear after the effects: transparent, which draws
 *  after everything solid and in `renderOrder`, but still writing depth. */
function drawAfterEffects(root: Group) {
    root.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        mesh.renderOrder = overEffects;
        for (const material of [mesh.material].flat() as Material[])
            material.transparent = true;
    });
}

type Actions = ReturnType<typeof heroActions>;

/** A move she is making over her walk or stand: its action, its seconds
 *  so far, and how long it lasts at its pace. */
type Playing = { action: AnimationAction; elapsed: number; length: number };

/** What her moves remember between frames: the last attack's and cast's
 *  ages, to see the next begin; whether she was hurt, to see the next hit
 *  land; how long she has stood; and the move she is making. */
type Motion = {
    lastAttack: number;
    lastCast: number;
    hurt: boolean;
    still: number;
    playing: Playing | null;
};

/** Every clip she plays, each as an action on her mixer: the ones she
 *  walks and stands in, looping, and her slash and parry, played once,
 *  each whole for when she stands and above her hips alone for when she
 *  moves. */
function heroActions(
    mixer: AnimationMixer,
    body: Object3D,
    run: AnimationClip,
    fitted: (name: MoveName) => AnimationClip,
    cut: AnimationClip,
    parry: AnimationClip,
) {
    const looping = (clip: AnimationClip) => {
        const action = mixer.clipAction(clip, body);
        action.setLoop(LoopRepeat, Infinity).play();
        action.setEffectiveWeight(0);
        return action;
    };
    const once = (clip: AnimationClip) => {
        const action = mixer.clipAction(clip, body);
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        return action;
    };
    const upper = (clip: AnimationClip) => {
        const above = clip.clone();
        above.name = `${clip.name} above`;
        above.tracks = above.tracks.filter((track) =>
            upperBones.test(track.name.split(".")[0]),
        );
        return above;
    };
    const idle = looping(fitted("idle"));
    idle.setEffectiveWeight(1);
    return {
        run: looping(run),
        walk: looping(fitted("walk")),
        fightWalk: looping(fitted("fightWalk")),
        idle,
        fidget: once(fitted("fidget")),
        slash: once(cut),
        slashAbove: once(upper(cut)),
        parry: once(parry),
        parryAbove: once(upper(parry)),
    };
}

/** Sets each clip's weight for the frame. Her feet: she stands, walks or
 *  runs by her speed, the walk a fighting one while a fight is on. Over
 *  them, a move: a slash as each sword attack begins, or a parry as a hit
 *  lands; or, having stood a while, a fidget. The clips under a move keep
 *  their weights, which make one between them, and the move's is set so it
 *  takes its share: whole while she stands, above her hips while she
 *  moves. */
function move(
    actions: Actions,
    motion: Motion,
    combat: TraitRecord<typeof HeroCombatTrait> | undefined,
    speed: number,
    delta: number,
) {
    const sinceAttack = combat?.sinceAttack ?? Infinity;
    const moving = speed > standBelow;
    //  Her last attack's weapon: with mixed arms, the sword or the
    //  crossbow, whichever she used.
    const sword = weaponKinds[combat?.attackKind ?? 0] === "sword";

    //  Standing, walking and running, eased between.
    const current = 1 - actions.idle.getEffectiveWeight();
    const target = moving ? 1 : 0;
    const going =
        current +
        Math.sign(target - current) *
            Math.min(Math.abs(target - current), delta * 8);
    const running = Math.min(
        1,
        Math.max(0, (speed - walkUntil) / (runFrom - walkUntil)),
    );
    const fighting = sword && sinceAttack < fightSeconds;
    actions.idle.setEffectiveWeight(1 - going);
    actions.run.setEffectiveWeight(going * running);
    actions.walk.setEffectiveWeight(fighting ? 0 : going * (1 - running));
    actions.fightWalk.setEffectiveWeight(fighting ? going * (1 - running) : 0);
    actions.run.timeScale = Math.max(0.6, speed / clipSpeed);
    actions.walk.timeScale = actions.fightWalk.timeScale = Math.max(
        0.6,
        speed / walkClipSpeed,
    );

    //  A move begins: a slash with each sword attack, a parry as a hit
    //  lands on her sword, a fidget after standing a while.
    const attacked = sinceAttack < motion.lastAttack;
    motion.lastAttack = sinceAttack;
    //  A cast's cue: the slash or parry its move names.
    const castAge = combat?.castAge ?? Infinity;
    const cast =
        castAge < motion.lastCast ? cueMoves[combat?.castMove ?? 0] : "none";
    motion.lastCast = castAge;
    const hurt = (combat?.flash ?? 0) > 0;
    const hit = hurt && !motion.hurt;
    motion.hurt = hurt;
    motion.still =
        moving || sinceAttack < fightSeconds ? 0 : motion.still + delta;
    if (cast === "slash")
        begin(motion, moving ? actions.slashAbove : actions.slash, 1);
    else if (cast === "parry")
        begin(motion, moving ? actions.parryAbove : actions.parry, 1);
    else if (attacked && sword) {
        const pace = Math.max(
            cutPace,
            actions.slash.getClip().duration *
                deriveHero(useProgress.getState()).attacksPerSecond,
        );
        begin(motion, moving ? actions.slashAbove : actions.slash, pace);
    } else if (hit && sword && !motion.playing)
        begin(motion, moving ? actions.parryAbove : actions.parry, 1);
    else if (motion.still > fidgetAfter && !motion.playing) {
        motion.still = 0;
        begin(motion, actions.fidget, 1);
    }

    //  The move's share: in, held, and out at its end; a fidget gives way
    //  as soon as she moves.
    const playing = motion.playing;
    if (!playing) return;
    playing.elapsed += delta;
    if (playing.action === actions.fidget && moving)
        playing.length = Math.min(playing.length, playing.elapsed + moveOut);
    const share = Math.max(
        0,
        Math.min(
            1,
            playing.elapsed / moveIn,
            (playing.length - playing.elapsed) / moveOut,
        ),
    );
    if (playing.elapsed >= playing.length) {
        playing.action.stop();
        motion.playing = null;
        return;
    }
    playing.action.setEffectiveWeight(Math.min(share / (1 - share), 50));
}

/** Starts a move from its beginning, ending the one before. */
function begin(motion: Motion, action: AnimationAction, pace: number) {
    motion.playing?.action.stop();
    action.reset();
    action.timeScale = pace;
    action.setEffectiveWeight(0);
    action.play();
    motion.playing = {
        action,
        elapsed: 0,
        length: action.getClip().duration / pace,
    };
}

/** Lays a crossbow's shot over her walk or stand: the arm that loosed it
 *  raised to hold it out ahead of her, then lowered; with one in each
 *  hand, each arm in its turn. Her sword swings in her slash, and rests in
 *  her hand otherwise. */
function poseCrossbow(
    rig: HeroRig,
    combat: TraitRecord<typeof HeroCombatTrait> | undefined,
) {
    if (!combat) return;
    //  A shot from the hand that loosed it, or a cast whose cue raises her
    //  crossbow, from her right.
    const shot =
        weaponKinds[combat.attackKind] === "crossbow"
            ? combat.sinceAttack
            : Infinity;
    const cast =
        cueMoves[combat.castMove] === "aim" ? combat.castAge : Infinity;
    const since = Math.min(shot, cast);
    if (since >= aimSeconds) return;
    const left = since === shot && combat.attackHand === 1;
    const held = 1 - Math.max(0, since - aimSeconds * 0.6) / (aimSeconds * 0.4);
    turnBone(
        rig,
        left ? rig.joints.leftArm : rig.joints.rightArm,
        modelRight,
        -1.45 * held,
    );
    rig.root.updateMatrixWorld(true);
}

/** A townsperson: her model in a look and gear of their own, the low one
 *  as a crowd's is, standing idle and fidgeting now and then, turned each
 *  frame to face the way `facing` gives. */
export function FolkModel({
    look,
    gear,
    facing,
}: {
    look: Look;
    gear: ModelGear;
    facing: () => number;
}) {
    const source = heroSource(useLoader(GLTFLoader, heroLowModelUrl));
    const moves = useLoader(FileLoader, heroMovesUrl, (loader) =>
        loader.setResponseType("json"),
    ) as unknown as Moves;
    const turn = useRef<Group>(null);

    const { rig, mixer, idle, fidget } = useMemo(() => {
        const rig = buildHeroRig(source);
        const mixer = new AnimationMixer(rig.body);
        const fitted = (name: MoveName) =>
            fitMove(name, moves[name], rig.skinned, rig.body);
        const idle = mixer.clipAction(fitted("idle"), rig.body);
        idle.setLoop(LoopRepeat, Infinity).play();
        const fidget = mixer.clipAction(fitted("fidget"), rig.body);
        fidget.setLoop(LoopOnce, 1);
        return { rig, mixer, idle, fidget };
    }, [source, moves]);

    useEffect(() => {
        applyLook(rig, {
            ...lookColors(look),
            face: look.face,
            style: look.hair,
        });
    }, [rig, look]);
    useEffect(() => applyGear(rig, gear), [rig, gear]);

    //  Seconds until the next fidget, a few apart and never in step.
    const [folk] = useState(() => ({
        fidgetIn: 3 + Math.random() * 6,
        facing: 0,
    }));
    useFrame((_, delta) => {
        if (!turn.current) return;
        const aim = facing();
        folk.facing +=
            (aim -
                folk.facing -
                Math.PI * 2 * Math.round((aim - folk.facing) / (Math.PI * 2))) *
            Math.min(1, delta * 4);
        turn.current.rotation.y = folk.facing;
        folk.fidgetIn -= delta;
        if (folk.fidgetIn <= 0) {
            fidget.reset().play();
            folk.fidgetIn = 7 + Math.random() * 8;
        }
        const moving = fidget.isRunning() ? 1 : 0;
        fidget.setEffectiveWeight(moving);
        idle.setEffectiveWeight(1 - moving);
        mixer.update(delta);
        sizeHead(rig);
        rig.root.updateMatrixWorld(true);
        levelHead(rig);
        rig.root.updateMatrixWorld(true);
        followBones(rig);
    });

    return (
        <group ref={turn}>
            <primitive object={rig.root} />
            <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
                <circleGeometry args={[0.38, 16]} />
                <meshBasicMaterial
                    color="#000000"
                    transparent
                    opacity={0.3}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}
