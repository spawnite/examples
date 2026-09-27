import type { Entity } from "koota";
import {
    declareStats,
    maxHealthStat,
    resolveStat,
    StatsTrait,
    type StatBase,
} from "@spawnite/engine/core";

//  A warden's numbers, as the engine's stats: each card adds a modifier,
//  and the shots, the coins and the movement read the resolved value. The
//  room owns them and streams them, so a page resolves the same numbers.

export enum WardenStat {
    /** Health one blaster hit takes. */
    Damage = "damage",
    /** Blaster shots a second. */
    FireRate = "fireRate",
    /** Monsters past the first that one shot passes through. */
    Pierce = "pierce",
    /** Shots one pull of the trigger fires, fanned out. */
    Pellets = "pellets",
    /** Times the coins she picks up are worth. */
    CoinValue = "coinValue",
    /** Times her stride's speed. */
    Speed = "speed",
    /** Health a second she heals on her own. */
    Regen = "regen",
    /** Times how fast she gets a downed warden up. */
    ReviveRate = "reviveRate",
    /** Health one lance hit takes: none until she takes the Storm Lance. */
    LanceDamage = "lanceDamage",
    /** Lances a second: none until she takes the Storm Lance. */
    LanceRate = "lanceRate",
}

export const wardenStats: Record<WardenStat, StatBase> = {
    [WardenStat.Damage]: { base: 10, min: 1 },
    [WardenStat.FireRate]: { base: 6, min: 1, max: 20 },
    [WardenStat.Pierce]: { base: 0, min: 0 },
    [WardenStat.Pellets]: { base: 1, min: 1, max: 9 },
    [WardenStat.CoinValue]: { base: 1, min: 1 },
    [WardenStat.Speed]: { base: 1, min: 0.5, max: 2 },
    [WardenStat.Regen]: { base: 0, min: 0 },
    [WardenStat.ReviveRate]: { base: 1, min: 1 },
    [WardenStat.LanceDamage]: { base: 0, min: 0 },
    [WardenStat.LanceRate]: { base: 0, min: 0, max: 4 },
};

/** Her greatest health before any card: the engine's own stat. */
export const baseMaxHealth = 100;

/** Gives a new warden every stat at its base, her greatest health among
 *  them. */
export function declareWardenStats(warden: Entity) {
    declareStats(warden, {
        ...wardenStats,
        [maxHealthStat]: { base: baseMaxHealth, min: 1 },
    });
}

/** A warden's stat, resolved; its base where she has none declared yet. It
 *  reads the stored record rather than copying it, so the room's step may
 *  call it for every shot. */
export function readWardenStat(warden: Entity, name: WardenStat) {
    const stat = warden.get(StatsTrait)?.[name];
    return stat ? resolveStat(stat) : wardenStats[name].base;
}
