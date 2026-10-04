import type { Entity } from "koota";
import {
    declareStats,
    maxHealthStat,
    resolveStat,
    StatsTrait,
    type StatBase,
    type WeaponStats,
} from "@spawnite/engine/core";

//  A warden's numbers, as the engine's stats: each card adds a modifier,
//  and the coins and the movement read the resolved value. Her gun stats
//  start at nothing: each gun lays them on its own numbers, so one card
//  raises every gun that names the stat. The room owns them and streams
//  them, so a page resolves the same numbers.

export enum WardenStat {
    /** Laid on the health each hit of her guns takes. */
    Damage = "damage",
    /** Laid on her guns' shots a second. */
    FireRate = "fireRate",
    /** Laid on the monsters past the first one shot passes through. */
    Pierce = "pierce",
    /** Laid on the shots one pull of the trigger fires, fanned out. */
    Pellets = "pellets",
    /** Laid on the damage of each pellet of a rack gun: the cost of more
     *  pellets, where something that adds them charges one. */
    PelletDamage = "pelletDamage",
    /** Times the coins she picks up are worth. */
    CoinValue = "coinValue",
    /** Times her stride's speed. */
    Speed = "speed",
    /** Health a second she heals on her own. */
    Regen = "regen",
    /** Times how fast she gets a downed warden up. */
    ReviveRate = "reviveRate",
    /** The lance's health a hit, which starts at nothing: none until she
     *  takes the Lance card. */
    LanceDamage = "lanceDamage",
    /** The lance's shots a second, which start at nothing: none until she
     *  takes the Lance card. */
    LanceRate = "lanceRate",
    /** Laid on the damage of the gun from the rack she holds: its upgrade
     *  tiers, which the lance never takes. */
    GunDamage = "gunDamage",
    /** Laid on the pellets of the gun from the rack she holds. */
    GunPellets = "gunPellets",
    /** Laid on the monsters past the first the gun from the rack she holds
     *  passes through. */
    GunPierce = "gunPierce",
    /** Laid on the shots a second of the gun from the rack she holds. */
    GunRate = "gunRate",
    /** Laid on the weak-spot multiplier of every gun she fires and the
     *  lance: a card's +25% turns a weak spot's double into 2.5 times. */
    WeakSpotDamage = "weakSpotDamage",
    /** Laid on the weak-spot multiplier of the gun from the rack she
     *  holds: the rail's top tier. */
    GunWeakSpotDamage = "gunWeakSpotDamage",
    /** Laid on her element's damage alone: its arcs, burns and bursts. */
    ElementPower = "elementPower",
}

/** The stats every gun of the fire's rack lays on its numbers: the cards'
 *  shared ones, and the gun stats its tiers raise, which the lance never
 *  names. */
export const rackGunStats: WeaponStats = {
    damage: [WardenStat.Damage, WardenStat.PelletDamage, WardenStat.GunDamage],
    shotsPerSecond: [WardenStat.FireRate, WardenStat.GunRate],
    pellets: [WardenStat.Pellets, WardenStat.GunPellets],
    pierce: [WardenStat.Pierce, WardenStat.GunPierce],
    zoneDamage: [WardenStat.WeakSpotDamage, WardenStat.GunWeakSpotDamage],
};

export const wardenStats: Record<WardenStat, StatBase> = {
    [WardenStat.Damage]: { base: 0 },
    [WardenStat.FireRate]: { base: 0 },
    [WardenStat.Pierce]: { base: 0 },
    [WardenStat.Pellets]: { base: 0 },
    [WardenStat.PelletDamage]: { base: 0 },
    [WardenStat.CoinValue]: { base: 1, min: 1 },
    [WardenStat.Speed]: { base: 1, min: 0.5, max: 2 },
    [WardenStat.Regen]: { base: 0, min: 0 },
    [WardenStat.ReviveRate]: { base: 1, min: 1 },
    [WardenStat.LanceDamage]: { base: 0 },
    [WardenStat.LanceRate]: { base: 0 },
    [WardenStat.GunDamage]: { base: 0 },
    [WardenStat.GunPellets]: { base: 0 },
    [WardenStat.GunPierce]: { base: 0 },
    [WardenStat.GunRate]: { base: 0 },
    [WardenStat.WeakSpotDamage]: { base: 0 },
    [WardenStat.GunWeakSpotDamage]: { base: 0 },
    [WardenStat.ElementPower]: { base: 0 },
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
