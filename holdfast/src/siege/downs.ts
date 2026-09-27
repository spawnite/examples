import { createQuery, type Entity, type World } from "koota";
import type { Vector3 } from "three";
import {
    findEntity,
    Hero,
    maxHealthStat,
    Movement,
    readEach,
    readField,
    readStat,
    Transform,
    Wallet,
    type StepOptions,
} from "@spawnite/engine/core";
import { spawnBurst } from "./effects";
import { baseMaxHealth, readWardenStat, WardenStat } from "./stats";
import {
    BurstKind,
    SiegePhase,
    SiegeState,
    Stride,
    WardenTrait,
} from "./traits";
import { queryStandingWardens, queryWardens } from "./wardens";

//  A warden's body through the run. One who runs out of health goes down
//  rather than out: she stays in the room, cannot walk or shoot, and the
//  monsters leave her for the wardens still standing. A teammate standing
//  over her gets her up, and so does holding the wave. On her feet she
//  walks at her stride times her speed, and heals by her own regeneration
//  and by the fire between waves.

/** Seconds a teammate stands over a downed warden to get her up. */
export const reviveSeconds = 3;
/** Metres from a downed warden a teammate stands to get her up. */
const reviveMetres = 2.2;
/** Share of her health a teammate gets her up with. */
const reviveShare = 0.4;
/** Share of her health a held wave gets her up with. */
const heldWaveShare = 0.5;
/** Health a second a warden heals by the fire between waves. */
const fireHealing = 15;
/** Metres from the fire, at the middle of the circle, a warden rests by
 *  it. */
export const fireMetres = 7;

const sieges = createQuery(SiegeState);
const placedWardens = createQuery(Hero, WardenTrait, Transform);

/** The run's phase, where the siege has begun. */
function readPhase(world: World) {
    const siege = findEntity(world, sieges);
    return siege === undefined
        ? undefined
        : readField(siege, SiegeState, "phase");
}

/** Her stride as her speed has it. */
function measureStride(warden: Entity) {
    const stride = warden.get(Stride);
    return (stride?.speed ?? 0) * readWardenStat(warden, WardenStat.Speed);
}

/** Puts her down: no health, no walking, no jumping. */
function layWardenDown(warden: Entity) {
    warden.set(WardenTrait, { down: true, health: 0, reviveSeconds: 0 });
    warden.set(Movement, { speed: 0, jumpHeight: 0 });
}

/** A warden getting up, and the share of her health she gets up with. */
interface Rising {
    warden: Entity;
    share: number;
}

/** Gets her up with `share` of her health, or what she has if more, and
 *  gives her back her stride; a downed warden rises in a burst of light. */
function raiseWarden(world: World, { warden, share }: Rising) {
    const survivor = warden.get(WardenTrait);
    const stride = warden.get(Stride);
    const feet = warden.get(Transform);
    if (!survivor || !stride) return;
    if (survivor.down && feet)
        spawnBurst(world, { kind: BurstKind.Revive, position: feet });
    warden.set(WardenTrait, {
        down: false,
        reviveSeconds: 0,
        health: Math.max(survivor.health, Math.round(survivor.maximum * share)),
    });
    warden.set(Movement, {
        speed: measureStride(warden),
        jumpHeight: stride.jumpHeight,
    });
}

/** Gets every downed warden up with half her health, as a held wave
 *  does. */
export function raiseDownedWardens(world: World) {
    for (const warden of queryWardens(world))
        if (warden.get(WardenTrait)?.down)
            raiseWarden(world, { warden, share: heldWaveShare });
}

/** Starts her afresh for a new run: her greatest health as her stats now
 *  give it, all of it, on her feet, and nothing earned. */
export function restoreWarden(world: World, warden: Entity) {
    const maximum = readStat(warden, maxHealthStat) ?? baseMaxHealth;
    warden.set(WardenTrait, {
        health: maximum,
        maximum,
        kills: 0,
        coinRemainder: 0,
        ready: false,
    });
    raiseWarden(world, { warden, share: 1 });
    if (warden.has(Wallet)) warden.set(Wallet, { coins: 0 });
}

/** How fast the standing warden quickest at it gets a warden at `feet` up:
 *  her revive rate, or 0 where none stands within reach. */
function measureTending(world: World, feet: Vector3) {
    let rate = 0;
    for (const standing of queryStandingWardens(world)) {
        const other = standing.get(Transform);
        if (
            other &&
            Math.hypot(other.x - feet.x, other.z - feet.z) <= reviveMetres
        )
            rate = Math.max(
                rate,
                readWardenStat(standing, WardenStat.ReviveRate),
            );
    }
    return rate;
}

/** One warden, and the step's length. */
interface WardenStep {
    warden: Entity;
    deltaSeconds: number;
}

/** A standing warden: her stride as her speed now gives it, and her
 *  health back by her regeneration, and between waves by the fire. */
function tendStanding(world: World, { warden, deltaSeconds }: WardenStep) {
    const survivor = warden.get(WardenTrait);
    if (!survivor) return;
    if (survivor.health <= 0) {
        layWardenDown(warden);
        return;
    }
    const speed = measureStride(warden);
    if (warden.get(Movement)?.speed !== speed) warden.set(Movement, { speed });
    const feet = warden.get(Transform);
    const resting =
        readPhase(world) === SiegePhase.Breather &&
        feet !== undefined &&
        Math.hypot(feet.x, feet.z) <= fireMetres;
    const healing =
        readWardenStat(warden, WardenStat.Regen) + (resting ? fireHealing : 0);
    if (healing > 0 && survivor.health < survivor.maximum)
        warden.set(WardenTrait, {
            health: Math.min(
                survivor.maximum,
                survivor.health + healing * deltaSeconds,
            ),
        });
}

/** Tends every warden: a standing one's stride and healing, or her fall
 *  once she runs out of health; a downed one's revive, counted up at the
 *  best rate of the teammates standing over her, or back down while none
 *  does, getting her up once it is full. */
export function tendWardens(world: World, { deltaSeconds }: StepOptions) {
    readEach(world, placedWardens, ([survivor, feet], warden) => {
        if (!survivor.down) {
            tendStanding(world, { warden, deltaSeconds });
            return;
        }
        //  A revive counts only while the run is on.
        const phase = readPhase(world);
        if (phase !== SiegePhase.Breather && phase !== SiegePhase.Fight) return;
        const rate = measureTending(world, feet);
        const seconds =
            rate > 0
                ? survivor.reviveSeconds + rate * deltaSeconds
                : Math.max(0, survivor.reviveSeconds - deltaSeconds);
        if (seconds >= reviveSeconds)
            raiseWarden(world, { warden, share: reviveShare });
        else if (seconds !== survivor.reviveSeconds)
            warden.set(WardenTrait, { reviveSeconds: seconds });
    });
}
