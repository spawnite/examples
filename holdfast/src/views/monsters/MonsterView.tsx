import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Entity } from "koota";
import { useTrait, useWorld } from "koota/react";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    Color,
    MathUtils,
    MeshBasicMaterial,
    PlaneGeometry,
    RingGeometry,
    Vector3,
    type Group,
    type Mesh,
} from "three";
import { HealthTrait, Hero, Transform, useEntityRef } from "@spawnite/engine";
import { slamWindUpSeconds } from "../../siege/attacks";
import { reachMetres } from "../../siege/monsters";
import {
    EliteModifier,
    MonsterKind,
    MonsterTrait,
    SlamTrait,
    WardenTrait,
} from "../../siege/traits";
import { monsterSettings } from "../../siege/waves";
import { advanceWalkCycle } from "../walkCycle";
import { dropCorpse } from "./Corpses";
import { MonsterClip, monsterModels } from "./models";
import {
    createMonsterMotion,
    flashSeconds,
    measureProgress,
    riseSeconds,
} from "./motion";
import { createMonsterRig } from "./rig";
import { paintSkin, type SkinLight } from "./skin";
import { SlamView } from "./SlamView";

//  A monster as a page draws it: its kind's model where the stream puts it,
//  climbing out of the ground as it spawns, walking at the pace it covers
//  ground, winding up its strike once a warden is in its reach and swinging
//  at each strike the room counts, flashing at each hit, with a bar over it
//  once it is hurt. When the room takes it away, its body falls. A colossus
//  winds up its slam instead, as the room says, over the ring its slam
//  marks.

const barGeometry = new PlaneGeometry(1, 1);
const barBack = new MeshBasicMaterial({
    color: "#1a0d10",
    transparent: true,
    opacity: 0.7,
    depthTest: false,
});
const barFill = new MeshBasicMaterial({ color: "#ff4d5e", depthTest: false });
/** Metres across a monster's bar, per metre of its radius. */
const barWidthPerRadius = 1.6;
/** Metres past its reach at which a monster starts winding up: the strike
 *  shows before it lands. */
const windUpMetres = 1.2;
/** Share of the strike clip at which its blow lands. */
const blowShare = 0.45;
/** Seconds a flinch takes to come in over the walk, and to hand back. */
const flinchInSeconds = 0.08;
const flinchOutSeconds = 0.2;
/** How fast a strike catches up to the room's blow, as a damping rate. */
const catchUpRate = 10;
/** Share of a hit's flash a colossus shows. */
const colossusFlash = 0.3;

const white = new Color("#ffffff");
//  Written in place each frame.
const light: SkinLight = { flash: 0, threat: 0 };
/** The ring a winding monster marks the ground with, as wide as its reach. */
const warningGeometry = new RingGeometry(0.82, 1, 40);
const apart = new Vector3();

interface MonsterViewProps {
    entity: Entity;
}

function MonsterBody({ entity }: MonsterViewProps) {
    const world = useWorld();
    const monster = useTrait(entity, MonsterTrait);
    const health = useTrait(entity, HealthTrait);
    const kind = monster?.kind ?? MonsterKind.Husk;
    //  Set as it spawns and never changed on a living monster.
    const elite = monster?.elite ?? EliteModifier.None;
    const slamWinding = useTrait(entity, SlamTrait)?.winding ?? false;
    const slammer = kind === MonsterKind.Colossus;
    const { radius, height, cooldown } = monsterSettings[kind];
    const model = monsterModels[kind];
    const gltf = useGLTF(model.url);
    const rig = useMemo(
        () => createMonsterRig(gltf, { kind, elite }),
        [gltf, kind, elite],
    );
    const warning = useMemo(
        () =>
            new MeshBasicMaterial({
                //  Short of full saturation: the dusk look's grading turns a
                //  bright, pure colour black.
                color: rig.skin.tint.clone().lerp(white, 0.35),
                transparent: true,
                opacity: 0,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        [rig],
    );
    useLayoutEffect(() => () => warning.dispose(), [warning]);
    const warningRef = useRef<Mesh>(null);
    const rootRef = useRef<Group | null>(null);
    const bodyRef = useRef<Group>(null);
    const barRef = useRef<Group>(null);
    const fillRef = useRef<Mesh>(null);
    const bindRef = useEntityRef(entity);
    const motion = useMemo(createMonsterMotion, []);

    //  Its walk from the first frame, and its body to the ground when the
    //  room takes it away.
    useLayoutEffect(() => {
        rig.actions[MonsterClip.Walk]?.play();
        return () => {
            rig.object.updateWorldMatrix(true, false);
            const at = rig.object.matrixWorld.clone();
            //  A view that remounts over a living monster, as a development
            //  build does, keeps its rig: only a monster the room took away
            //  leaves a body.
            if (entity.isAlive()) rig.mixer.stopAllAction();
            else {
                rig.object.removeFromParent();
                dropCorpse(rig, at);
            }
        };
    }, [entity, rig]);

    //  A strike or a hit, as the stream reports it, starts its animation on
    //  the next frame; the first values the stream brings start nothing.
    const strikes = monster?.strikes ?? 0;
    const current = health?.current ?? 0;
    const seenRef = useRef({ strikes, current });
    useEffect(() => {
        const seen = seenRef.current;
        if (strikes > seen.strikes) motion.struckAt = Number.NaN;
        if (current < seen.current) motion.hitAt = Number.NaN;
        seen.strikes = strikes;
        seen.current = current;
    }, [strikes, current, motion]);

    useFrame(({ clock, camera }, delta) => {
        const now = clock.elapsedTime;
        const root = rootRef.current;
        const body = bodyRef.current;
        if (!root || !body) return;
        const { actions, mixer, skin, shadow } = rig;
        const walk = actions[MonsterClip.Walk];
        const strike = actions[MonsterClip.Strike];
        const flinch = actions[MonsterClip.Flinch];
        //  A mark the effect left becomes this frame's time.
        if (motion.bornAt === -Infinity) motion.bornAt = now;
        if (Number.isNaN(motion.hitAt)) {
            motion.hitAt = now;
            flinch?.reset().play();
        }
        //  A flinch eases in over the walk and hands back before its clip
        //  ends, so neither edge pops.
        if (flinch?.isRunning())
            flinch.weight = Math.min(
                measureProgress(flinch.time, flinchInSeconds),
                measureProgress(
                    flinch.getClip().duration - flinch.time,
                    flinchOutSeconds,
                ),
            );
        advanceWalkCycle(motion.stride, { object: root, delta });
        //  A colossus winds up while the room says its slam does; the rest
        //  as the nearest standing warden comes near its reach.
        let winding = slamWinding;
        if (!slammer) {
            let nearest = Infinity;
            //  A downed warden draws no blow: the room strikes only the
            //  standing.
            for (const hero of world.query(Hero, Transform)) {
                const at = hero.get(Transform);
                if (!at || hero.get(WardenTrait)?.down) continue;
                nearest = Math.min(
                    nearest,
                    apart.copy(at).sub(root.position).setY(0).length(),
                );
            }
            winding = nearest < radius + reachMetres + windUpMetres;
        }
        if (strike) {
            const duration = strike.getClip().duration;
            if (Number.isNaN(motion.struckAt)) {
                motion.struckAt = now;
                //  The swing lands as the room's blow does: a strike already
                //  showing catches up over a few frames, one not yet showing
                //  starts there.
                const blowAt = duration * blowShare;
                if (strike.isRunning() && strike.weight > 0.05)
                    motion.strikeLag =
                        MathUtils.euclideanModulo(
                            blowAt - strike.time + duration / 2,
                            duration,
                        ) -
                        duration / 2;
                else {
                    strike.reset().play();
                    strike.time = blowAt;
                    motion.strikeLag = 0;
                }
            }
            if (strike.isRunning() && motion.strikeLag !== 0) {
                const step =
                    motion.strikeLag * (1 - Math.exp(-catchUpRate * delta));
                strike.time = MathUtils.euclideanModulo(
                    strike.time + step,
                    duration,
                );
                motion.strikeLag -= step;
                if (Math.abs(motion.strikeLag) < 0.001) motion.strikeLag = 0;
            }
            //  A slam's swing starts with its wind-up and lands with it.
            strike.timeScale = slammer
                ? (duration * blowShare) / slamWindUpSeconds
                : duration / cooldown;
            if (winding && !strike.isRunning()) strike.reset().play();
            strike.weight = MathUtils.damp(
                strike.weight,
                winding ? 1 : 0,
                10,
                delta,
            );
            if (!winding && strike.weight < 0.01) strike.stop();
        }
        if (walk) {
            walk.timeScale =
                Math.max(0.35, motion.stride.speed) / model.walkMetresPerSecond;
            walk.weight = 1 - (strike?.isRunning() ? strike.weight : 0);
        }
        mixer.update(delta);
        const rise = measureProgress(now - motion.bornAt, riseSeconds);
        body.position.y = (rise - 1) * height * rig.size;
        //  Its shadow grows as it climbs out.
        shadow.scale.setScalar(rig.shadowMetres * Math.max(rise, 0.001));
        //  As it winds up it marks the ground round it and throbs in its
        //  eyes' colour; a hit lights it white for a moment.
        const flash = 1 - measureProgress(now - motion.hitAt, flashSeconds);
        const threat = strike?.isRunning()
            ? strike.weight * (0.6 + 0.4 * Math.sin(now * 18))
            : 0;
        warning.opacity = threat * 0.9;
        const ring = warningRef.current;
        if (ring) {
            //  A colossus's slam marks its own ring.
            ring.visible = !slammer && threat > 0.01;
            //  It closes in as the blow comes.
            ring.scale.setScalar(
                (radius + reachMetres) * (1.3 - 0.3 * (strike?.weight ?? 0)),
            );
        }
        //  Every warden shoots the one colossus, so a full flash would hold it
        //  white for the whole fight.
        light.flash = slammer ? flash * colossusFlash : flash;
        light.threat = threat;
        paintSkin(skin, light);
        //  A hit knocks it back a hair.
        body.position.z = flash * 0.12;
        const bar = barRef.current;
        const fill = fillRef.current;
        const maximum = health?.maximum ?? 1;
        if (bar && fill) {
            bar.visible = current < maximum && current > 0;
            bar.quaternion.copy(camera.quaternion);
            const share = Math.max(0, current / maximum);
            fill.scale.x = share;
            fill.position.x = (share - 1) / 2;
        }
    });

    return (
        <group
            ref={(object) => {
                rootRef.current = object;
                bindRef(object);
            }}
        >
            {/*  The models face positive z; the engine's rest facing is
                 negative z. */}
            <group ref={bodyRef} rotation-y={Math.PI}>
                <primitive object={rig.object} scale={rig.scale} />
            </group>
            <primitive object={rig.shadow} position-y={0.03} />
            <mesh
                ref={warningRef}
                geometry={warningGeometry}
                material={warning}
                rotation-x={-Math.PI / 2}
                position-y={0.05}
                visible={false}
            />
            <group
                ref={barRef}
                position-y={height * rig.size + 0.4}
                scale={[radius * barWidthPerRadius, 0.08, 1]}
                visible={false}
            >
                <mesh
                    geometry={barGeometry}
                    material={barBack}
                    renderOrder={10}
                />
                <mesh
                    ref={fillRef}
                    geometry={barGeometry}
                    material={barFill}
                    renderOrder={11}
                />
            </group>
        </group>
    );
}

/** Its own boundary, so a model still loading hides nothing else. A
 *  colossus's slam draws in the world rather than on its body, and before
 *  its model loads. */
export function MonsterView(props: MonsterViewProps) {
    const kind = useTrait(props.entity, MonsterTrait)?.kind;
    return (
        <>
            <Suspense fallback={null}>
                <MonsterBody {...props} />
            </Suspense>
            {kind === MonsterKind.Colossus && (
                <SlamView entity={props.entity} />
            )}
        </>
    );
}
