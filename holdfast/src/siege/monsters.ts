import { createQuery, Not, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    BodyTrait,
    chaserCollides,
    ChaseTrait,
    CollisionLayer,
    defaultWalkerBody,
    FacingTrait,
    HealthTrait,
    HitZonesTrait,
    InvulnerableTrait,
    positiveY,
    readEach,
    readField,
    TransformTrait,
    VelocityTrait,
    type StepOptions,
    fixedStepSeconds,
} from "@spawnite/engine/core";
import { spawnBurst } from "./effects";
import { tallyHurt } from "./tally";
import {
    BurstKind,
    ClawsTrait,
    EliteModifier,
    FrozenTrait,
    MercyTrait,
    RiseGraceTrait,
    MonsterKind,
    MonsterTrait,
    SlamMachine,
    SlamTrait,
    SpitTrait,
    SpitMachine,
    StandstillTrait,
    WardenTrait,
} from "./traits";
import { monsterSettings, planWave, type WavePlan } from "./waves";
import { measureDrawnSize, readWeakSpot } from "./weakSpots";
import { queryTargetWardens } from "./wardens";

//  The Hollow: spawned by the siege, chasing the nearest warden it may hurt,
//  and striking her once in reach.

/** Monsters block the wardens, so a crowd can close a warden in. */
const monsterCollides = [...chaserCollides, CollisionLayer.Players];
/** Metres past touching within which a monster strikes. */
export const reachMetres = 0.35;
/** Metres inside its reach at which a monster stops, so a warden a step
 *  away is still struck. */
const stopInsideMetres = 0.1;
/** Metres a warden may stand above or below a monster and still be hit:
 *  one standing on another's head is. */
const strikeHeightMetres = 2.5;
/** Metres from a warden's axis at which a monster of `radius` stops
 *  walking at her: inside its reach, so she is still struck a step away. */
export function measureStopMetres(radius: number) {
    return radius + defaultWalkerBody.radius + reachMetres - stopInsideMetres;
}

/** Seconds after a blow in which no monster strikes her: as long as a
 *  full-strength hurt flash takes to fade, so a crowd lands one blow, not
 *  one each. */
export const mercySeconds = 0.5;

export interface MonsterSpawn {
    kind: MonsterKind;
    position: Vector3;
    plan: WavePlan;
    /** What makes it an elite; none when left out. */
    elite?: EliteModifier;
    /** Times its kind's size it stands, its body with it; 1 when left
     *  out. */
    size?: number;
}

/** Times a monster's health and speed each elite modifier gives it. */
interface EliteScale {
    health: number;
    speed: number;
}

const eliteScales: Record<EliteModifier, EliteScale> = {
    [EliteModifier.None]: { health: 1, speed: 1 },
    [EliteModifier.Swift]: { health: 1, speed: 1.45 },
    [EliteModifier.Armoured]: { health: 2.5, speed: 0.85 },
    [EliteModifier.Splitting]: { health: 1.2, speed: 1 },
};

/** Seconds a spitter waits after it rises before its first bolt, so it is
 *  seen before it spits. */
const firstSpitSeconds = 1;

/** Spawns one monster of `kind` at `position`, scaled to its wave and its
 *  elite modifier, at its size, with its weak spot, rising out of a rift
 *  every page draws. A colossus slams rather than claws, and a spitter
 *  spits from where it stops. */
export function spawnMonster(
    world: World,
    {
        kind,
        position,
        plan,
        elite = EliteModifier.None,
        size = 1,
    }: MonsterSpawn,
) {
    const settings = monsterSettings[kind];
    const scale = eliteScales[elite];
    const colossus = kind === MonsterKind.Colossus;
    const spitter = kind === MonsterKind.Spitter;
    const health = Math.round(
        settings.health *
            (colossus ? plan.bossHealth : plan.health) *
            scale.health,
    );
    const speed = settings.speed * plan.speed * scale.speed;
    const radius = settings.radius * size;
    spawnBurst(world, {
        kind: BurstKind.Rift,
        position,
        monster: kind,
        size: radius * 3,
    });
    const monster = world.spawn(
        TransformTrait(position.clone()),
        VelocityTrait,
        FacingTrait,
        BodyTrait({
            radius,
            height: settings.height * size,
            collides: monsterCollides,
        }),
        //  It walks, as a player's walker does, rather than moving along
        //  the navmesh, which leaves out the circle's stones and the
        //  hearth. The wardens it chases are the ones the scene lets it.
        //  A spitter comes on until it sees her, then holds at its range.
        ChaseTrait({
            speed,
            reach: measureStopMetres(radius),
            walks: true,
        }),
        StandstillTrait({ x: position.x, z: position.z }),
        HealthTrait({ current: health, maximum: health }),
        MonsterTrait({
            kind,
            speed,
            damage: Math.round(settings.damage * plan.damage),
            elite,
            size,
        }),
        HitZonesTrait([readWeakSpot(kind, measureDrawnSize(elite, size))]),
    );
    if (colossus) monster.add(SlamTrait, SlamMachine.trait);
    else if (spitter)
        //  Risen in the siege's step, before the attacks: the step counts
        //  toward its first spit, as it always has.
        monster.add(
            SpitTrait,
            SpitMachine.trait({
                state: "cooling",
                cooldown: firstSpitSeconds,
                waited: fixedStepSeconds,
            }),
        );
    else monster.add(ClawsTrait);
    return monster;
}

/** Metres from where a splitting elite fell each skitter rises. */
const splitMetres = 0.7;
//  Written in place for each skitter.
const splitSpot = new Vector3();

/** Where a splitting elite fell, and the wave it fell in. */
export interface MonsterSplit {
    position: Vector3;
    wave: number;
    wardens: number;
}

/** Two skitters rising either side of where a splitting elite fell. */
export function splitMonster(
    world: World,
    { position, wave, wardens }: MonsterSplit,
) {
    const plan = planWave(Math.max(wave, 1), wardens);
    for (let side = -1; side <= 1; side += 2) {
        splitSpot.copy(position);
        splitSpot.x += side * splitMetres;
        spawnMonster(world, {
            kind: MonsterKind.Skitter,
            position: splitSpot,
            plan,
        });
    }
}

/** The standing warden nearest a point, level with the ground, and how
 *  far; null and Infinity where none stands. */
interface NearestWarden {
    warden: Entity | null;
    distance: number;
}

//  Written in place for each monster.
const nearest: NearestWarden = { warden: null, distance: Infinity };

//  A frozen monster turns and strikes nothing, its claws held.
const monsters = createQuery(
    MonsterTrait,
    TransformTrait,
    FacingTrait,
    Not(FrozenTrait),
);
const strikers = createQuery(
    MonsterTrait,
    ClawsTrait,
    TransformTrait,
    Not(FrozenTrait),
);
const wardensInMercy = createQuery(MercyTrait);
const wardensInGrace = createQuery(RiseGraceTrait);

/** Whether a blow spares `warden` now: she got up from a fall moments
 *  ago. */
export function isInRiseGrace(warden: Entity) {
    return (readField(warden, RiseGraceTrait, "seconds") ?? 0) > 0;
}

/** The warden nearest `position` a monster may chase. Written in place:
 *  read it at once. */
export function findNearestWarden(world: World, position: Vector3) {
    nearest.warden = null;
    nearest.distance = Infinity;
    for (const warden of queryTargetWardens(world)) {
        const feet = warden.get(TransformTrait);
        if (!feet) continue;
        const distance = Math.hypot(feet.x - position.x, feet.z - position.z);
        if (distance < nearest.distance) {
            nearest.warden = warden;
            nearest.distance = distance;
        }
    }
    return nearest;
}

/** Metres between the two axes within which `monster` hits `warden`. */
function measureReach(monster: Entity, warden: Entity) {
    const radius =
        readField(monster, BodyTrait, "radius") ?? defaultWalkerBody.radius;
    const heroRadius =
        readField(warden, BodyTrait, "radius") ?? defaultWalkerBody.radius;
    return radius + heroRadius + reachMetres;
}

/** Turns each monster to face the nearest warden it may hurt, the one the
 *  engine's chase walks it at. */
export function faceMonsters(world: World) {
    readEach(world, monsters, ([, position, facing]) => {
        const feet = findNearestWarden(world, position).warden?.get(
            TransformTrait,
        );
        if (!feet) return;
        //  At rest a body points along negative z.
        const yaw = Math.atan2(position.x - feet.x, position.z - feet.z);
        facing.rotation.setFromAxisAngle(positiveY, yaw);
    });
}

/** Each monster within reach of a standing warden hits her once its
 *  cooldown has run out and her breath after the last blow has passed,
 *  counts the strike, and starts both again. An `InvulnerableTrait` warden
 *  loses no health to it, as the engine's damage spares one. */
export function strikeWardens(world: World, { deltaSeconds }: StepOptions) {
    readEach(world, wardensInMercy, ([mercy], warden) => {
        if (mercy.seconds > 0)
            warden.set(MercyTrait, {
                seconds: Math.max(0, mercy.seconds - deltaSeconds),
            });
    });
    readEach(world, wardensInGrace, ([grace], warden) => {
        if (grace.seconds > 0)
            warden.set(RiseGraceTrait, {
                seconds: Math.max(0, grace.seconds - deltaSeconds),
            });
    });
    readEach(world, strikers, ([settings, claws, position], monster) => {
        const cooldown = Math.max(0, claws.cooldown - deltaSeconds);
        const { warden, distance } = findNearestWarden(world, position);
        const feet = warden?.get(TransformTrait);
        const health =
            warden === null
                ? undefined
                : readField(warden, WardenTrait, "health");
        const inReach =
            warden !== null &&
            feet !== undefined &&
            distance <= measureReach(monster, warden) &&
            Math.abs(feet.y - position.y) <= strikeHeightMetres;
        const spared =
            warden !== null &&
            ((readField(warden, MercyTrait, "seconds") ?? 0) > 0 ||
                isInRiseGrace(warden));
        if (
            warden &&
            health !== undefined &&
            inReach &&
            cooldown === 0 &&
            !spared
        ) {
            tallyHurt(world, {
                amount: settings.damage,
                kind: settings.kind,
            });
            if (!warden.has(InvulnerableTrait))
                warden.set(WardenTrait, {
                    health: Math.max(0, health - settings.damage),
                });
            if (!warden.has(MercyTrait)) warden.add(MercyTrait);
            warden.set(MercyTrait, { seconds: mercySeconds });
            monster.set(MonsterTrait, { strikes: settings.strikes + 1 });
            monster.set(ClawsTrait, {
                cooldown: monsterSettings[settings.kind].cooldown,
            });
        } else if (cooldown !== claws.cooldown)
            monster.set(ClawsTrait, { cooldown });
    });
}
