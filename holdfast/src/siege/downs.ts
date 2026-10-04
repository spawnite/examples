import { createQuery, type Entity, type World } from "koota";
import { findSiege, isLastFall, PhaseMachine } from "./phase";
import type { Vector3 } from "three";
import {
    addStatModifier,
    HeroTrait,
    maxHealthStat,
    MovementTrait,
    readEach,
    readStat,
    removeStatModifiers,
    TransformTrait,
    WalletTrait,
    type StepOptions,
} from "@spawnite/engine/core";
import { countRevive } from "./awards";
import { spawnBurst } from "./effects";
import { measureFireHealing } from "./fire";
import { LifeMachine, LifeTrait, ReadinessMachine } from "./life";
import { baseMaxHealth, readWardenStat, WardenStat } from "./stats";
import { BurstKind, RiseGraceTrait, StrideTrait, WardenTrait } from "./traits";
import { tallyRevive } from "./tally";
import { isConnected, queryStandingWardens, queryWardens } from "./wardens";

//  A warden's body through the run. One who runs out of health goes down
//  rather than out: she stays in the room, cannot walk, shoots at half her
//  rate where she lies, and the monsters leave her for the wardens still
//  standing, as Left 4 Dead's incapacitated survivors and Borderlands'
//  Fight For Your Life keep a downed player in the fight. A teammate
//  standing over her gets her up, and so does holding the wave; a warden
//  alone gets herself up once each boss cycle. On her feet she walks at her
//  stride times her speed, and heals by her own regeneration and by the
//  fire between waves.

/** Seconds a teammate stands over a downed warden to get her up. */
export const reviveSeconds = 3;
/** Seconds a warden alone lies before she gets herself up. */
export const selfReviveSeconds = 5;
/** Seconds after she gets up from a fall in which nothing hurts her: the
 *  monsters crowd a downed warden, and without it every one strikes as she
 *  stands, as Risk of Rain 2's Dio's Best Friend grants a few seconds of
 *  invulnerability after its revive. */
export const riseGraceSeconds = 2;
/** Share of her rate of fire a downed warden keeps. */
const downedFireShare = 0.5;
/** The source of the modifiers that halve a downed warden's rate. */
const downedSource = "downed";
/** Metres from a downed warden a teammate stands to get her up. */
const reviveMetres = 2.2;
/** Share of her health a teammate gets her up with. */
const reviveShare = 0.4;
/** Share of her health a held wave gets her up with. */
const heldWaveShare = 0.5;

const placedWardens = createQuery(
    HeroTrait,
    WardenTrait,
    LifeTrait,
    TransformTrait,
);

const { is } = LifeMachine;

/** Her stride as her speed has it. */
function measureStride(warden: Entity) {
    const stride = warden.get(StrideTrait);
    return (stride?.speed ?? 0) * readWardenStat(warden, WardenStat.Speed);
}

/** Puts her down: no health, no walking, no jumping, and half her rate
 *  with every gun, since each lays her fire rate on its own, which the
 *  room reads off her stats as it judges every shot. */
function layWardenDown(warden: Entity) {
    warden.set(WardenTrait, { health: 0 });
    warden.set(LifeTrait, { revived: 0 });
    LifeMachine.send(warden, "DOWN");
    warden.set(MovementTrait, { speed: 0, jumpHeight: 0 });
    addStatModifier(warden, WardenStat.FireRate, {
        source: downedSource,
        more: downedFireShare - 1,
    });
}

/** A warden getting up, the share of her health she gets up with, and
 *  whether she rises in no burst, as at a run's end. */
interface Rising {
    warden: Entity;
    share: number;
    quiet?: boolean;
}

/** Gets her up with `share` of her health, or what she has if more, and
 *  gives her back her stride and her rate; a downed warden rises in a
 *  burst of light, and in her grace. */
function raiseWarden(world: World, { warden, share, quiet }: Rising) {
    const survivor = warden.get(WardenTrait);
    const stride = warden.get(StrideTrait);
    const feet = warden.get(TransformTrait);
    if (!survivor || !stride) return;
    if (warden.has(is.down) && !quiet) {
        if (feet) spawnBurst(world, { kind: BurstKind.Revive, position: feet });
        if (!warden.has(RiseGraceTrait)) warden.add(RiseGraceTrait);
        warden.set(RiseGraceTrait, { seconds: riseGraceSeconds });
    }
    LifeMachine.send(warden, "RISE");
    warden.set(LifeTrait, { revived: 0 });
    warden.set(WardenTrait, {
        health: Math.max(survivor.health, Math.round(survivor.maximum * share)),
    });
    warden.set(MovementTrait, {
        speed: measureStride(warden),
        jumpHeight: stride.jumpHeight,
    });
    removeStatModifiers(warden, downedSource);
}

/** Gets every downed warden up with half her health, as a held wave
 *  does. */
export function raiseDownedWardens(world: World) {
    for (const warden of queryWardens(world))
        if (warden.has(is.down))
            raiseWarden(world, { warden, share: heldWaveShare });
}

/** Gets her up with all her health for the wait before the next run,
 *  with no burst, keeping what she earned for the run's end screen. */
export function raiseForWait(world: World, warden: Entity) {
    ReadinessMachine.send(warden, "UNREADY");
    raiseWarden(world, { warden, share: 1, quiet: true });
}

/** Starts her afresh for a new run: her greatest health as her stats now
 *  give it, all of it, on her feet, her self-revive in hand, and nothing
 *  earned. */
export function restoreWarden(world: World, warden: Entity) {
    const maximum = readStat(warden, maxHealthStat) ?? baseMaxHealth;
    warden.set(WardenTrait, {
        health: maximum,
        maximum,
        kills: 0,
        coinRemainder: 0,
        selfRevive: true,
    });
    ReadinessMachine.send(warden, "UNREADY");
    raiseWarden(world, { warden, share: 1 });
    if (warden.has(WalletTrait)) warden.set(WalletTrait, { coins: 0 });
}

/** Gives every warden her self-revive back, as a boss cycle ends. */
export function refillSelfRevives(world: World) {
    for (const warden of queryWardens(world))
        if (!warden.get(WardenTrait)?.selfRevive)
            warden.set(WardenTrait, { selfRevive: true });
}

/** The warden who holds the circle alone: the one whose player is
 *  connected, where exactly one is, a teammate whose connection dropped
 *  among those she holds it without. */
export function findLoneWarden(world: World) {
    let lone: Entity | undefined;
    for (const warden of queryWardens(world)) {
        if (!isConnected(warden)) continue;
        if (lone) return undefined;
        lone = warden;
    }
    return lone;
}

/** Whether a warden alone lies down with her self-revive in hand, so the
 *  run waits for her to get up rather than ending. */
export function isGettingUpAlone(world: World) {
    const lone = findLoneWarden(world);
    return (
        lone?.has(is.down) === true &&
        lone.get(WardenTrait)?.selfRevive === true
    );
}

/** The standing warden quickest at getting a warden at `feet` up, and her
 *  revive rate: a rate of 0 and nobody where none stands within reach. */
function measureTending(world: World, feet: Vector3) {
    let rate = 0;
    let reviver: Entity | null = null;
    for (const standing of queryStandingWardens(world)) {
        const other = standing.get(TransformTrait);
        if (
            !other ||
            Math.hypot(other.x - feet.x, other.z - feet.z) > reviveMetres
        )
            continue;
        const own = readWardenStat(standing, WardenStat.ReviveRate);
        if (own > rate) {
            rate = own;
            reviver = standing;
        }
    }
    return { rate, reviver };
}

/** One warden, and the step's length. */
interface WardenStep {
    warden: Entity;
    deltaSeconds: number;
}

/** A standing warden: her stride as her speed now gives it, and her
 *  health back by her regeneration and inside the fire's ring. */
function tendStanding(world: World, { warden, deltaSeconds }: WardenStep) {
    const survivor = warden.get(WardenTrait);
    if (!survivor) return;
    if (survivor.health <= 0) {
        layWardenDown(warden);
        return;
    }
    const speed = measureStride(warden);
    if (warden.get(MovementTrait)?.speed !== speed)
        warden.set(MovementTrait, { speed });
    const feet = warden.get(TransformTrait);
    const healing =
        readWardenStat(warden, WardenStat.Regen) +
        (feet ? measureFireHealing(world, Math.hypot(feet.x, feet.z)) : 0);
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
 *  does, getting her up once it is full. A warden alone counts her own up
 *  over `selfReviveSeconds`, once each boss cycle. */
export function tendWardens(world: World, { deltaSeconds }: StepOptions) {
    readEach(world, placedWardens, ([survivor, life, feet], warden) => {
        if (!warden.has(is.down)) {
            tendStanding(world, { warden, deltaSeconds });
            return;
        }
        //  A revive counts only while the run is on, and not on its last
        //  fall, which the room has already decided.
        const siege = findSiege(world);
        if (
            !siege ||
            !(
                siege.has(PhaseMachine.is.breather) ||
                siege.has(PhaseMachine.is.fight)
            )
        )
            return;
        if (isLastFall(siege)) return;
        const alone = survivor.selfRevive && findLoneWarden(world) === warden;
        const { rate, reviver } = alone
            ? { rate: reviveSeconds / selfReviveSeconds, reviver: null }
            : measureTending(world, feet);
        const seconds =
            rate > 0
                ? life.revived + rate * deltaSeconds
                : Math.max(0, life.revived - deltaSeconds);
        if (seconds >= reviveSeconds) {
            raiseWarden(world, { warden, share: reviveShare });
            if (reviver) countRevive(reviver);
            tallyRevive(world, alone);
            if (alone) warden.set(WardenTrait, { selfRevive: false });
            return;
        }
        if (seconds !== life.revived)
            warden.set(LifeTrait, { revived: seconds });
        LifeMachine.send(warden, rate > 0 ? "TEND" : "LEAVE");
    });
}
