import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { getStore, type Entity as KootaEntity } from "koota";
import { useWorld } from "koota/react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
    Anchor,
    Bar,
    Chase,
    Entity,
    findPlayerHero,
    Health,
    Panel,
    PanelVariant,
    Text,
    TransformTrait,
    useBehaviour,
    useEntity,
    useHealth,
    VelocityTrait,
} from "@spawnite/engine";
import {
    Box3,
    BufferGeometry,
    CircleGeometry,
    MeshBasicMaterial,
    RingGeometry,
    Vector3,
    type Group,
    type Mesh,
} from "@spawnite/engine/three";
import { dashWarning, strikeSeconds } from "../combat/boss";
import { gatherAround, trailBehind } from "../combat/motes";
import { monsterKinds, type MonsterKind } from "./kinds";
import { ModelBody, preloadMonsterModel } from "./ModelBody";
import {
    crownParts,
    slimeClock,
    slimeHeight,
    slimeLook,
    slimeModelUrl,
} from "./slimeModel";
import { popSlime } from "./SlimePops";
import { useSpawns, type SpawnArea, type SpawnSlot } from "./spawns";
import {
    attackLands,
    attackLength,
    attackWindup,
    BossStateTrait,
    MonsterBehaviour,
    MonsterMode,
    MonsterStateTrait,
} from "./traits";

//  Fetched as the game loads, so the first slimes stand at once; the far
//  zones' models after.
useLoader.preload(GLTFLoader, slimeModelUrl);
for (const kind of Object.values(monsterKinds) as MonsterKind[])
    if (kind.model) preloadMonsterModel(kind.model);

/** One monster from a spawn slot: it wanders its area, hunts the hero who
 *  comes into it, and lunges at her, drawn as the creator's slime in its
 *  kind's colour, or as its model. */
export function Monster({ slot }: { slot: SpawnSlot }) {
    const kind: MonsterKind = monsterKinds[slot.kind];

    return (
        <Entity position={[slot.x, 0, slot.z]}>
            <Health maximum={kind.health} />
            <Chase
                speed={kind.speed}
                reach={kind.radius + 0.5}
                radius={kind.radius}
                height={Math.max(kind.radius * 2, kind.size * 0.8)}
            />
            <MonsterData
                id={slot.id}
                kind={kind}
                area={slot.area}
                homeX={slot.x}
                homeZ={slot.z}
            />
            {/*  Its own boundary, so the monster hunts while its model
                 loads. */}
            <Suspense fallback={null}>
                {kind.model ? (
                    <ModelBody kind={kind} model={kind.model} slot={slot} />
                ) : (
                    <SlimeBody kind={kind} slot={slot} />
                )}
            </Suspense>
            {kind.model ? (
                //  Over a model, on a point of its own: its bounds, from
                //  its bound pose, stand at no height its run keeps.
                <group position-y={kind.size + (kind.model.hover ?? 0) + 0.2}>
                    <Nameplate kind={kind} />
                </group>
            ) : (
                <Nameplate kind={kind} />
            )}
        </Entity>
    );
}

function MonsterData({
    id,
    kind,
    area,
    homeX,
    homeZ,
}: {
    id: number;
    kind: MonsterKind;
    area: SpawnArea;
    homeX: number;
    homeZ: number;
}) {
    useBehaviour(MonsterBehaviour, {
        slot: id,
        xp: kind.xp,
        damage: kind.damage,
        radius: kind.radius,
        speed: kind.speed,
        areaX: area.x,
        areaZ: area.z,
        areaRadius: area.radius,
        homeX,
        homeZ,
        aggressive: kind.temperament === "aggressive",
        aggroRange: kind.aggroRange,
        boss: !!kind.boss,
    });
    return null;
}

/** Metres the lunge carries the slime toward the hero, and how high it
 *  leaps on the way. */
const lungeReach = 0.7;
const lungeHop = 0.35;
/** The share of a kind's size its body spans across, as the sprite's body
 *  did. */
const bodyShare = 0.85;
/** A hop's length and height, as shares of the kind's size: a small slime
 *  takes quick little hops, a boss slow heavy ones. */
const hopLength = 0.55;
const hopHeight = 0.12;
/** Metres a second below which it sits rather than hops. */
const sitBelow = 0.15;
/** The share of the way to where it should face that it turns a second. */
const turnRate = 10;
/** Seconds before a boss's attack goes off that it leaps, to slam down as
 *  it does; and the share of its size it leaps. */
const leapSeconds = 0.3;
const leapHeight = 0.28;
/** Seconds a hit's wobble is counted for, long past when it has rung out. */
const wobbleSeconds = 2;
/** Where the crown sits on the metre-wide model: its band round the top
 *  of the dome, tipped a little to one side. */
const crownY = slimeHeight - 0.01;
const crownTilt = -0.14;
/** Metres over the dome the crown's points reach, on the same model. */
const crownRise = 0.16;

//  Shared by every monster: the shadow under it and the ring its wind-up
//  draws, each a unit shape scaled to the monster.
const shadowShape = new CircleGeometry(1, 20);
const shadowMaterial = new MeshBasicMaterial({
    color: "#000000",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
});
const warningShape = new RingGeometry(0.85, 1, 28);

/** Nothing to draw, but a point for the nameplate to stand on. The plate
 *  stands on the top of what the entity draws: this holds it at the height
 *  of a hop over the slime, so it stays put as the slime bounces under it
 *  rather than bouncing with it. */
const plateMark = new BufferGeometry();
plateMark.boundingBox = new Box3(new Vector3(), new Vector3());

/** A turn wrapped to within half a turn either way. */
function wrap(angle: number) {
    return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));
}

/** `from` moved toward `to` by at most `step`. */
function approach(from: number, to: number, step: number) {
    return from < to ? Math.min(to, from + step) : Math.max(to, from - step);
}

/** The slime: it breathes as it sits, hops at the pace it moves, and turns
 *  to face its way or the hero it hunts. Its attack shows: it squashes
 *  down, leaning back, trembling and glowing hot over a red ring for the
 *  wind-up, then stretches out in a leap at her and lands squashed. A hit
 *  flashes it white and sets it wobbling, and a knock tips it over; it
 *  pops when it falls. Driven each frame from the fight's state, by
 *  writing to its objects, and never by rendering again. */
function SlimeBody({ kind, slot }: { kind: MonsterKind; slot: SpawnSlot }) {
    const entity = useEntity();
    const world = useWorld();
    const look = slimeLook(useLoader(GLTFLoader, slimeModelUrl), kind.color);
    const crown = kind.boss ? crownParts() : null;
    const shadow = useRef<Mesh>(null);
    const warning = useRef<Mesh>(null);
    const warningMaterial = useRef<MeshBasicMaterial>(null);
    const lunge = useRef<Group>(null);
    const turn = useRef<Group>(null);
    const lean = useRef<Group>(null);
    const body = useRef<Mesh>(null);
    const hero = useRef<KootaEntity | undefined>(undefined);
    //  What carries over from frame to frame: the way it faces, how far
    //  through a hop it is and how much it is hopping, the hit flash last
    //  seen, and the seconds since a hit set it wobbling.
    const [motion] = useState(() => ({
        facing: 0,
        hop: 0,
        hopping: 0,
        flash: 0,
        wobble: wobbleSeconds,
    }));
    const width = kind.size * bodyShare;
    const beat = entity.id() * 1.7;
    const plateHeight =
        width * (crown ? slimeHeight + crownRise : slimeHeight) +
        hopHeight * kind.size;

    //  Gone because it fell, rather than because the wilds were left: it
    //  pops where it last stood.
    useEffect(() => {
        const drawn = body.current;
        return () => {
            const now = useSpawns.getState().slots[slot.id];
            const fell =
                !!now && (!now.alive || now.generation !== slot.generation);
            if (drawn && fell) popSlime(look, drawn.matrixWorld);
        };
    }, [look, slot.id, slot.generation]);

    useFrame(({ clock }, delta) => {
        if (
            !entity.isAlive() ||
            !shadow.current ||
            !warning.current ||
            !warningMaterial.current ||
            !lunge.current ||
            !turn.current ||
            !lean.current ||
            !body.current
        )
            return;
        slimeClock.value = clock.elapsedTime;
        //  Read straight from the stores: `get` builds a fresh object each
        //  call, and this runs every frame for every slime. Only once it
        //  has its state: the world has no store for the trait until some
        //  monster does, and a slime can draw before its behaviour adds it.
        const index = entity.id();
        const state = entity.has(MonsterStateTrait)
            ? getStore(world, MonsterStateTrait)
            : null;
        const flash = state ? state.flash[index] : 0;
        const attack = state ? state.attack[index] : -1;
        const knock = state ? state.knockSeconds[index] : 0;
        const lungeX = state ? state.lungeX[index] : 0;
        const lungeZ = state ? state.lungeZ[index] : 0;
        //  A boss's cast: seconds of it left, strike and all; and its dash.
        const boss = entity.has(BossStateTrait)
            ? getStore(world, BossStateTrait)
            : null;
        const casting = boss ? boss.casting[index] : 0;
        const dashIn = boss ? boss.dashIn[index] : -1;
        const dashing = boss ? boss.dashing[index] : 0;
        const element = kind.boss?.element ?? "moss";
        const velocity = entity.get(VelocityTrait);
        const velocityX = velocity?.x ?? 0;
        const velocityZ = velocity?.z ?? 0;
        const speed = Math.hypot(velocityX, velocityZ);
        const attacking = attack >= 0;
        const knocked = knock > 0;

        //  It faces its lunge, else its way, else the hero it hunts, and
        //  turns quickest for the lunge. The model faces +z, so a yaw of
        //  atan2(x, z) turns it onto (x, z).
        let aim = motion.facing;
        let rate = turnRate;
        if (attacking) {
            aim = Math.atan2(lungeX, lungeZ);
            rate = turnRate * 2;
        } else if (!knocked && speed > sitBelow)
            aim = Math.atan2(velocityX, velocityZ);
        else if (!knocked && state && state.mode[index] === MonsterMode.Hunt) {
            if (!hero.current?.isAlive()) hero.current = findPlayerHero(world);
            const heroAt = hero.current?.get(TransformTrait);
            const at = entity.get(TransformTrait);
            if (heroAt && at)
                aim = Math.atan2(heroAt.x - at.x, heroAt.z - at.z);
        }
        //  A boss faces the way it casts or dashes, whatever the hero does.
        if (boss && casting > 0) {
            aim = Math.atan2(boss.castX[index], boss.castZ[index]);
            rate = turnRate;
        } else if (boss && (dashIn >= 0 || dashing > 0)) {
            aim = Math.atan2(boss.dashX[index], boss.dashZ[index]);
            rate = turnRate * 2;
        }
        motion.facing += wrap(aim - motion.facing) * Math.min(1, delta * rate);

        //  Hops at the pace it moves, squashed on the ground and stretched
        //  in the air; it breathes as it sits.
        const hopping = !attacking && !knocked && speed > sitBelow;
        motion.hopping = approach(motion.hopping, hopping ? 1 : 0, delta * 5);
        if (hopping)
            motion.hop =
                (motion.hop + (speed * delta) / (hopLength * kind.size)) % 1;
        else if (motion.hopping === 0) motion.hop = 0;
        let lift =
            Math.sin(motion.hop * Math.PI) *
            hopHeight *
            kind.size *
            motion.hopping;
        const bounce =
            Math.cos(motion.hop * Math.PI * 2) * 0.1 * motion.hopping;
        const breath =
            Math.sin(clock.elapsedTime * 2.4 + beat) *
            0.035 *
            (1 - motion.hopping);
        let tall = (1 - bounce) * (1 + breath);
        let wide = (1 + bounce * 0.6) * (1 - breath * 0.5);
        let deep = wide;
        let pitch = 0;
        let roll = 0;
        let shake = 0;
        let forward = 0;

        if (attacking && attack < attackWindup) {
            //  Gathers itself: squashes down and leans back, trembling
            //  harder as the wind-up runs out.
            const wound = attack / attackWindup;
            const eased = wound * wound * (3 - 2 * wound);
            tall *= 1 - 0.3 * eased;
            wide *= 1 + 0.2 * eased;
            deep = wide;
            pitch = -0.25 * eased;
            shake = Math.sin(attack * 90) * 0.035 * eased;
        } else if (attacking && attack < attackLands) {
            //  Leaps, stretched out toward her.
            const leap = (attack - attackWindup) / (attackLands - attackWindup);
            forward = leap;
            lift = Math.sin(leap * Math.PI) * lungeHop;
            tall = 1.08;
            wide = 0.82;
            deep = 1.3;
            pitch = 0.3;
        } else if (attacking) {
            //  Lands squashed and slides back to where it leapt from.
            const back = Math.min(
                1,
                (attack - attackLands) / (attackLength - attackLands),
            );
            forward = 1 - back;
            tall = 0.78 + 0.22 * back;
            wide = 1.14 - 0.14 * back;
            deep = wide;
            pitch = 0.3 * (1 - back) ** 2;
        }

        if (knocked && state) {
            //  Knocked back, its top tips away from the blow.
            const pushX = state.knockX[index];
            const pushZ = state.knockZ[index];
            const push = Math.hypot(pushX, pushZ);
            if (push > 1e-3) {
                const tip = (Math.min(1, knock / 0.14) * 0.3) / push;
                const sin = Math.sin(motion.facing);
                const cos = Math.cos(motion.facing);
                pitch += (pushX * sin + pushZ * cos) * tip;
                roll -= (pushX * cos - pushZ * sin) * tip;
            }
        }

        //  A boss casting stands where it is: it gathers itself, squashing
        //  and trembling hotter as its element draws in round it, leaps as
        //  the warning runs out, and slams down as its attack goes off. A
        //  dash gathers the same way, then streaks along, leaving a wake.
        let hot = false;
        if (boss && casting > 0) {
            const left = casting - strikeSeconds;
            if (left > leapSeconds) {
                const gathering = Math.max(
                    0.01,
                    boss.castLength[index] - leapSeconds,
                );
                const charge = Math.min(
                    1,
                    1 - (left - leapSeconds) / gathering,
                );
                const eased = charge * charge * (3 - 2 * charge);
                tall *= 1 - 0.22 * eased;
                wide *= 1 + 0.16 * eased;
                deep = wide;
                shake = Math.sin(clock.elapsedTime * 70) * 0.03 * eased;
                hot = true;
                const at = entity.get(TransformTrait);
                if (at)
                    gatherAround(
                        at.x,
                        at.y,
                        at.z,
                        kind.radius,
                        element,
                        0.3 + eased,
                        delta,
                    );
            } else if (left > 0) {
                const leap = 1 - left / leapSeconds;
                lift = Math.sin((leap * Math.PI) / 2) * kind.size * leapHeight;
                tall = 1.22;
                wide = 0.86;
                deep = wide;
                hot = true;
            } else {
                const strike = 1 - casting / strikeSeconds;
                const back = Math.max(0, (strike - 0.3) / 0.7);
                const eased = 1 - (1 - back) ** 2;
                tall = 0.62 + 0.38 * eased;
                wide = 1.38 - 0.38 * eased;
                deep = wide;
            }
        } else if (boss && dashIn >= 0) {
            const charge = 1 - dashIn / dashWarning;
            tall *= 1 - 0.2 * charge;
            wide *= 1 + 0.12 * charge;
            deep = wide;
            pitch = -0.2 * charge;
            hot = true;
        } else if (boss && dashing > 0) {
            tall = 0.85;
            wide = 0.9;
            deep = 1.35;
            pitch = 0.25;
            const at = entity.get(TransformTrait);
            if (at) trailBehind(at.x, at.y, at.z, kind.radius, element, delta);
        }

        //  A new hit sets it wobbling, which rings out in a moment. A boss
        //  is heavier and wobbles less.
        if (flash > motion.flash + 1e-4) motion.wobble = 0;
        motion.flash = flash;
        motion.wobble = Math.min(wobbleSeconds, motion.wobble + delta);
        const wobble =
            Math.exp(-motion.wobble * 9) *
            Math.cos(motion.wobble * 32) *
            (kind.boss ? 0.14 : 0.28);
        tall *= 1 - wobble;
        wide *= 1 + wobble * 0.6;
        deep *= 1 + wobble * 0.6;

        const worn =
            flash > 0
                ? look.hurt
                : hot || (attacking && attack < attackLands)
                  ? look.windUp
                  : look.rest;
        if (body.current.material !== worn) body.current.material = worn;
        lunge.current.position.set(
            lungeX * forward * lungeReach,
            lift,
            lungeZ * forward * lungeReach,
        );
        turn.current.rotation.y = motion.facing;
        lean.current.rotation.set(pitch, 0, roll);
        lean.current.position.x = shake * width;
        body.current.scale.set(width * wide, width * tall, width * deep);
        //  Its shadow shrinks a little as it leaves the ground.
        shadow.current.scale.setScalar(
            kind.radius * 1.1 * (1 - Math.min(0.35, lift / width)),
        );

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
            <mesh
                geometry={plateMark}
                position-y={plateHeight}
                visible={false}
            />
            <group ref={lunge}>
                <group ref={turn}>
                    <group ref={lean}>
                        <mesh
                            ref={body}
                            geometry={look.geometry}
                            material={look.rest}
                            scale={width}
                        >
                            {crown && (
                                <mesh
                                    geometry={crown.geometry}
                                    material={crown.material}
                                    position-y={crownY}
                                    rotation-z={crownTilt}
                                />
                            )}
                        </mesh>
                    </group>
                </group>
            </group>
        </>
    );
}

function Nameplate({ kind }: { kind: MonsterKind }) {
    const health = useHealth(useEntity());
    if (!health) return null;

    return (
        <Panel
            anchor={Anchor.Above}
            maxDistance={30}
            variant={PanelVariant.Bare}
        >
            {/*  Red names hunt on sight, as in most MMOs; white ones are
                 passive until hit; a boss's is gold. */}
            <Text
                size="xs"
                className={
                    kind.boss
                        ? "font-bold text-amber-300"
                        : kind.temperament === "aggressive"
                          ? "text-red-400"
                          : ""
                }
            >
                {kind.boss ? "BOSS · " : ""}
                {kind.name} · Lv {kind.level}
            </Text>
            <Bar
                label={`${kind.name} health`}
                value={health.current}
                maximum={health.maximum}
                className={kind.boss ? "h-2 w-32" : "h-1.5 w-20"}
            />
        </Panel>
    );
}
