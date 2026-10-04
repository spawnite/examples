import type { RunState } from "./traits";

//  The threat: how much tougher and harder-hitting the enemies are now. It
//  grows with the run's clock, with no cap, and with the soldier's level,
//  so a soldier whose upgrades compound still meets a dangerous field.
//  Every enemy's health at its spawn, and every hit it lands on the hero,
//  reads it. The elites and the boss take only the soldier's level, so the
//  boss at three minutes stays a fight rather than a wall.

/** Seconds of the clock that add one whole enemy health, as the clock
 *  always grew it. */
const healthClockSeconds = 240;
/** Seconds of the clock whose square adds one more whole health: small in
 *  the first minutes, it carries the endless run. */
const healthLateSeconds = 600;
/** Levels the soldier reaches near one minute, which add nothing. */
const freeLevels = 5;
/** The share of health each level past the free ones adds. */
const healthPerLevel = 0.1;
/** The share of the health's growth the enemies' damage takes. */
const damageShare = 0.4;

/** What the threat multiplies: an enemy's health, and its damage. */
export interface Threat {
    health: number;
    damage: number;
}

//  Written in place, once per read.
const threat: Threat = { health: 1, damage: 1 };

/** The threat at the run's clock and the soldier's level, or at the level
 *  alone for an elite or the boss, which `big` says. The record is written
 *  in place, so read it before the next call. */
export function readThreat(
    { time, level }: Pick<RunState, "time" | "level">,
    big = false,
): Readonly<Threat> {
    const clock = big
        ? 1
        : 1 + time / healthClockSeconds + (time / healthLateSeconds) ** 2;
    const levels = 1 + healthPerLevel * Math.max(0, level - freeLevels);
    threat.health = clock * levels;
    threat.damage = 1 + (threat.health - 1) * damageShare;
    return threat;
}
