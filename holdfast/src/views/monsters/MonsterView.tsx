import { useFrame } from "@react-three/fiber";
import type { Entity } from "koota";
import { useTrait, useWorld } from "koota/react";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, MathUtils, Vector3, type Group } from "three";
import {
    HealthTrait,
    HeroTrait,
    NetworkIdTrait,
    TransformTrait,
    useEntityRef,
    useModel,
} from "@spawnite/engine";
import { slamWindUpSeconds } from "../../siege/attacks";
import { reachMetres } from "../../siege/monsters";
import {
    ElementLookTrait,
    lookSteps,
    EliteModifier,
    MonsterKind,
    MonsterTrait,
    SlamTrait,
} from "../../siege/traits";
import { monsterSettings } from "../../siege/waves";
import { advanceWalkCycle } from "../walkCycle";
import { dropCorpse, isTakenAway, readWelcomes } from "./Corpses";
import { createMark, hideMarks, MarkKind, showMarks } from "./marks";
import { MonsterClip, monsterModels } from "./models";
import {
    createMonsterMotion,
    flashSeconds,
    measureProgress,
    riseSeconds,
    colossusRiseSeconds,
} from "./motion";
import { ElementAura } from "./ElementAura";
import { MonsterBar } from "./MonsterBar";
import { useMonsterBatch } from "./batch";
import { throbCore } from "./core";
import {
    createMonsterRig,
    disposeMonsterRig,
    joinBatch,
    leaveBatch,
    type MonsterBatch,
} from "./rig";
import { paintSkin, type SkinLight } from "./skin";
import { takeStormHit } from "./stormHits";
import { SlamView } from "./SlamView";
import { forgetKnock, lightKnock, measureKnock, takeKnock } from "./knockback";
import { LifeMachine } from "../../siege/life";

//  A monster as a page draws it: its kind's model where the stream puts it,
//  climbing out of the ground as it spawns in play, standing already where
//  the page's welcome found it, walking at the pace it covers
//  ground, winding up its strike once a warden is in its reach and swinging
//  at each strike the room counts, flashing at each hit, with a bar over it
//  once it is hurt. When the room takes it away, its body falls. A colossus
//  winds up its slam instead, as the room says, over the ring its slam
//  marks.

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
/** Share of a hit's flash a colossus's outline shows. Every warden
 *  shoots the one colossus, so its hits come faster than a flash fades:
 *  a flash on its body would hold it white for the whole fight, so its
 *  body keeps its colour and its outline lights. */
const colossusFlash = 0.6;

const white = new Color("#ffffff");
//  Written in place each frame.
const light: SkinLight = { flash: 0, wash: 1, threat: 0, frost: 0 };
/** How much frost a frozen monster's skin wears under its ice. */
const frozenFrost = 0.5;
const apart = new Vector3();
const stormAt = new Vector3();

interface MonsterViewProps {
    entity: Entity;
}

interface MonsterBodyProps extends MonsterViewProps {
    /** Its kind's batch, which draws it; none draws it on its own. */
    batch?: MonsterBatch;
}

function MonsterBody({ entity, batch }: MonsterBodyProps) {
    const world = useWorld();
    const monster = useTrait(entity, MonsterTrait);
    const health = useTrait(entity, HealthTrait);
    const kind = monster?.kind ?? MonsterKind.Husk;
    //  Set as it spawns and never changed on a living monster.
    const elite = monster?.elite ?? EliteModifier.None;
    const size = monster?.size ?? 1;
    const slamWinding = useTrait(entity, SlamTrait)?.winding ?? false;
    //  A frozen monster's clips hold where they stood; the element layer
    //  draws the ice.
    const elementLook = useTrait(entity, ElementLookTrait);
    const frozen = elementLook?.frozen ?? false;
    //  A frozen, marked or burning monster keeps its color under a run of
    //  hits, as a colossus does, so its ice, its element's glow and its
    //  flame still read. A chill's faint haze asks nothing of anyone, so a
    //  chilled one flashes white as any other.
    const keepsColour =
        frozen ||
        (elementLook?.mark ?? "") !== "" ||
        (elementLook?.burn ?? 0) > 0;
    const slammer = kind === MonsterKind.Colossus;
    const { radius, height, cooldown } = monsterSettings[kind];
    const model = monsterModels[kind];
    const gltf = useModel(model.url);
    const rig = useMemo(
        () => createMonsterRig(gltf, { kind, elite, size }, batch),
        [gltf, kind, elite, size, batch],
    );
    //  Short of full saturation, so its brightest part burns toward white
    //  under the tone mapping, as a hot light does.
    const warningColor = useMemo(
        () => rig.skin.tint.clone().lerp(white, 0.35),
        [rig],
    );
    //  The mark the view places over its rig's: the ring its wind-up marks.
    const marks = useMemo(
        () => ({ warning: createMark(MarkKind.Warning) }),
        [],
    );
    useLayoutEffect(() => {
        const own = Object.values(marks);
        showMarks(own);
        return () => hideMarks(own);
    }, [marks]);
    const rootRef = useRef<Group | null>(null);
    const bodyRef = useRef<Group>(null);
    const bindRef = useEntityRef(entity);
    const motion = useMemo(() => createMonsterMotion(entity), [entity]);

    //  Its walk from the first frame, and its body to the ground when the
    //  room takes it away.
    useLayoutEffect(() => {
        joinBatch(rig);
        showMarks(rig.marks);
        rig.actions[MonsterClip.Walk]?.play();
        //  Read now: the entity has no traits left once it is gone.
        const streamed = entity.get(NetworkIdTrait)?.id;
        const welcomes = readWelcomes(world);
        return () => {
            forgetKnock(entity);
            rig.object.updateWorldMatrix(true, false);
            const at = rig.object.matrixWorld.clone();
            //  A view that remounts over a living monster, as a development
            //  build does, keeps its rig: only a monster the room took away
            //  in play leaves a body. One a welcome brought back has a view
            //  of its own again, which stands it up at once, and one a
            //  welcome left out, as a seek does, goes with no fall.
            if (entity.isAlive()) {
                rig.mixer.stopAllAction();
                hideMarks(rig.marks);
                leaveBatch(rig);
            } else if (!isTakenAway(world, streamed, welcomes))
                disposeMonsterRig(rig);
            else {
                rig.object.removeFromParent();
                dropCorpse(rig, { id: streamed, placement: at, welcomes });
            }
        };
    }, [entity, rig, world]);

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

    useFrame(({ clock }, delta) => {
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
            //  The night's boss stands its ground whatever hits it, as
            //  Deep Rock Galactic's Dreadnought does.
            const knock = takeKnock(entity);
            motion.knock = slammer ? lightKnock : knock;
            motion.stormHit = false;
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
            for (const hero of world.query(HeroTrait, TransformTrait)) {
                const at = hero.get(TransformTrait);
                if (!at || hero.has(LifeMachine.is.down)) continue;
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
        mixer.update(frozen ? 0 : delta);
        const rise = measureProgress(
            now - motion.bornAt,
            slammer ? colossusRiseSeconds : riseSeconds,
        );
        body.position.y = (rise - 1) * height * rig.size;
        //  Its shadow grows as it climbs out.
        shadow.scale.setScalar(rig.shadowMetres * Math.max(rise, 0.001));
        //  As it winds up it marks the ground round it and throbs in its
        //  eyes' colour; a hit lights it white for a moment.
        const flash = 1 - measureProgress(now - motion.hitAt, flashSeconds);
        const threat = strike?.isRunning()
            ? strike.weight * (0.6 + 0.4 * Math.sin(now * 18))
            : 0;
        //  Added over what lies under it, so its strength is its colour's.
        marks.warning.color.copy(warningColor).multiplyScalar(threat * 0.9);
        const ring = marks.warning.object;
        //  A colossus's slam marks its own ring.
        ring.visible = !slammer && threat > 0.01;
        //  It closes in as the blow comes.
        ring.scale.setScalar(
            (radius + reachMetres) * (1.3 - 0.3 * (strike?.weight ?? 0)),
        );
        const outlined = slammer || keepsColour;
        light.flash = outlined ? flash * colossusFlash : flash;
        //  A Storm hit lights the outline alone, so the arc reads. The arc
        //  and the hit may reach the page a frame apart, so it is asked
        //  while the flash lasts.
        if (!motion.stormHit && now - motion.hitAt < flashSeconds)
            motion.stormHit = takeStormHit(root.getWorldPosition(stormAt));
        light.wash = outlined || motion.stormHit ? 0 : 1;
        light.threat = threat;
        //  Frost coats it as its chill builds; a frozen one shows its own
        //  colours through the ice, so its coat is half.
        light.frost = frozen
            ? frozenFrost
            : (elementLook?.chill ?? 0) / lookSteps;
        paintSkin(skin, light);
        throbCore(rig.core, now);
        //  A hit knocks it back, the farther the heavier the gun.
        body.position.z = measureKnock(now - motion.hitAt, motion.knock);
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
            <ElementAura
                entity={entity}
                height={height * rig.size}
                radius={radius * rig.size}
            />
            <primitive
                object={marks.warning.object}
                rotation-x={-Math.PI / 2}
                position-y={0.05}
                visible={false}
            />
            <MonsterBar
                height={height * rig.size + 0.4}
                width={radius * rig.size * barWidthPerRadius}
                current={current}
                maximum={health?.maximum ?? 1}
            />
        </group>
    );
}

/** A monster its kind's batch draws. */
function BatchedMonsterBody({
    kind,
    ...props
}: MonsterViewProps & { kind: MonsterKind }) {
    return <MonsterBody {...props} batch={useMonsterBatch(kind)} />;
}

/** Its own boundary, so a model still loading hides nothing else. A
 *  colossus, the night's boss, draws on its own; every other kind in its
 *  kind's batch. A colossus's slam draws in the world rather than on its
 *  body, and before its model loads. */
export function MonsterView(props: MonsterViewProps) {
    const kind = useTrait(props.entity, MonsterTrait)?.kind;
    return (
        <>
            <Suspense fallback={null}>
                {kind === undefined || kind === MonsterKind.Colossus ? (
                    <MonsterBody {...props} />
                ) : (
                    <BatchedMonsterBody {...props} kind={kind} />
                )}
            </Suspense>
            {kind === MonsterKind.Colossus && (
                <SlamView entity={props.entity} />
            )}
        </>
    );
}
