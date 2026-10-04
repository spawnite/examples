import { createQuery, type Entity, type World } from "koota";
import { isPhase, PhaseMachine } from "./phase";
import { findEntity, readField } from "@spawnite/engine/core";
import { readLedger, spendCoins } from "./coins";
import { FireTrait, LedgerTrait, SiegeStateTrait } from "./traits";

//  The fire at the middle of the circle: the team's sink, with no ceiling.
//  Any warden feeds it coins, and each level it rises to widens its ring,
//  which heals every warden inside it, between waves and, once the fire
//  has been fed, during them too, and the fire grows. Vampire Survivors
//  and Brotato spend a run's gold on the run itself the same way; here the
//  whole team shares what it buys.

/** Metres the fire's ring reaches at level 0, and the most it reaches:
 *  inside the cobbled ring, short of the stones. */
export const fireMetres = 7;
const mostFireMetres = 16;
/** Metres each level adds to the ring. */
const levelMetres = 1;
/** Health a second the fire heals between waves, at any level. */
export const breatherHealing = 15;
/** Health a second each level heals during a wave, and the most. */
const levelWaveHealing = 1.5;
const mostWaveHealing = 12;
/** Coins one feed adds. */
export const feedCoins = 10;
/** Coins the first level costs, and each level after it more. */
const firstLevelCoins = 30;
const levelCoinsStep = 20;
/** Metres from the middle within which a warden feeds the fire. */
export const feedMetres = 3.6;

/** Metres the ring reaches at `level`. */
export function measureFireRing(level: number) {
    return Math.min(mostFireMetres, fireMetres + level * levelMetres);
}

/** Health a second the fire heals a warden inside its ring during a wave
 *  at `level`: none until it is fed. */
export function measureWaveHealing(level: number) {
    return Math.min(mostWaveHealing, level * levelWaveHealing);
}

/** Coins the fire takes to rise from `level` to the next. */
export function readLevelCost(level: number) {
    return firstLevelCoins + level * levelCoinsStep;
}

const sieges = createQuery(SiegeStateTrait);

/** The fire's record on the siege, and the siege, where it has begun. */
function findFire(world: World) {
    const siege = findEntity(world, sieges);
    if (!siege) return undefined;
    if (!siege.has(FireTrait))
        siege.add(FireTrait({ level: 0, fuel: 0, next: readLevelCost(0) }));
    return siege;
}

/** Puts the fire back to level 0, as a new run starts. */
export function resetFire(world: World) {
    findFire(world)?.set(FireTrait, {
        level: 0,
        fuel: 0,
        next: readLevelCost(0),
    });
}

/** The fire's level, 0 before the siege has begun. */
export function readFireLevel(world: World) {
    const siege = findFire(world);
    return siege ? (readField(siege, FireTrait, "level") ?? 0) : 0;
}

/** Health a second the fire heals a warden `metres` from the middle now:
 *  its breather's warmth or its wave's, inside its ring, and nothing out of
 *  it or while no run is on. */
export function measureFireHealing(world: World, metres: number) {
    const { is } = PhaseMachine;
    const level = readFireLevel(world);
    if (metres > measureFireRing(level)) return 0;
    if (isPhase(world, is.breather)) return breatherHealing;
    if (isPhase(world, is.fight)) return measureWaveHealing(level);
    return 0;
}

/** Feeds the fire `feedCoins` of `warden`'s coins, raising it a level
 *  each time its fuel reaches the level's cost; false where her wallet
 *  cannot. Where she stands and the phase are the shop's to check. */
export function feedFire(world: World, warden: Entity) {
    const siege = findFire(world);
    const fire = siege?.get(FireTrait);
    if (!siege || !fire || !spendCoins(warden, feedCoins)) return false;
    let { level, fuel } = fire;
    fuel += feedCoins;
    while (fuel >= readLevelCost(level)) {
        fuel -= readLevelCost(level);
        level++;
    }
    siege.set(FireTrait, { level, fuel, next: readLevelCost(level) });
    warden.set(LedgerTrait, { fed: readLedger(warden).fed + feedCoins });
    return true;
}
