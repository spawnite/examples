import type { Entity } from "koota";
import {
    addStatModifier,
    removeStatModifiers,
    WeaponKind,
    type StatModifier,
    type WeaponSettings,
} from "@spawnite/engine/core";
import { blasterSettings } from "./blaster";
import { rackGunStats, WardenStat } from "./stats";
import { WardenGunTrait } from "./traits";

//  The guns of the fire's rack: a warden holds one, the blaster from the
//  start, and buys the scattergun or the rail once her coins meet its
//  price. Each gun is the shape her element takes: one target at a time, a
//  cone, or a line. Every gun lays her element at the same strength a
//  second, so a pull's dose is a second's over its pulls a second, shared
//  among its pellets. Three upgrade tiers each add that gun's own perk, as
//  Call of Duty Zombies' Pack-a-Punch reworks the gun in hand; a new gun
//  keeps her tier less one.

export enum GunId {
    Blaster = "blaster",
    Scattergun = "scattergun",
    Rail = "rail",
}

export const gunList: readonly GunId[] = [
    GunId.Blaster,
    GunId.Scattergun,
    GunId.Rail,
];

/** Her gun's upgrade tier at most. */
export const topTier = 3;

/** One modifier a perk adds, and the stat it goes on. */
interface PerkModifier {
    stat: WardenStat;
    modifier: Omit<StatModifier, "source">;
}

/** What one upgrade tier adds to a gun. */
export interface GunPerk {
    title: string;
    text: string;
    modifiers: PerkModifier[];
    /** Times each of its pellets that hits bounces on to the next monster,
     *  from this tier on. */
    ricochets?: number;
}

export interface Gun {
    title: string;
    /** What it does, in a line, for the rack. */
    text: string;
    /** Coins it costs at the rack. */
    price: number;
    settings: WeaponSettings;
    /** The perk each tier adds, the first tier's first. */
    perks: readonly [GunPerk, GunPerk, GunPerk];
}

/** Metres a ricochet reaches from the monster a pellet hit. */
export const ricochetMetres = 6;
/** Share of its pellet's damage a ricochet deals. */
export const ricochetShare = 0.5;

export const guns: Record<GunId, Gun> = {
    [GunId.Blaster]: {
        title: "Blaster",
        text: "Rapid fire, one target at a time.",
        price: 20,
        settings: blasterSettings,
        perks: [
            {
                title: "Hot Barrel",
                text: "Fire a quarter faster.",
                modifiers: [
                    { stat: WardenStat.GunRate, modifier: { percent: 0.25 } },
                ],
            },
            {
                title: "Twin Bolts",
                text: "Two bolts a shot, each 30% weaker.",
                modifiers: [
                    { stat: WardenStat.GunPellets, modifier: { flat: 1 } },
                    { stat: WardenStat.GunDamage, modifier: { more: -0.3 } },
                ],
            },
            {
                title: "Drill Bolts",
                text: "Bolts pass through two more monsters.",
                modifiers: [
                    { stat: WardenStat.GunPierce, modifier: { flat: 2 } },
                ],
            },
        ],
    },
    [GunId.Scattergun]: {
        title: "Scattergun",
        text: "Close range: a wide cone of pellets.",
        price: 80,
        settings: {
            kind: WeaponKind.Instant,
            damage: 14,
            range: 16,
            shotsPerSecond: 1,
            pellets: 5,
            spread: 0.09,
            pierce: 0,
            stats: rackGunStats,
            //  One pull a second lays a whole dose, a fifth with each
            //  pellet.
            data: { dose: 1 },
        },
        perks: [
            {
                title: "Buckshot",
                text: "Two more pellets a shot.",
                modifiers: [
                    { stat: WardenStat.GunPellets, modifier: { flat: 2 } },
                ],
            },
            {
                title: "Ricochet",
                text: "A pellet that hits bounces to the next monster.",
                modifiers: [],
                ricochets: 1,
            },
            {
                title: "Wild Ricochet",
                text: "Pellets bounce twice.",
                modifiers: [],
                ricochets: 2,
            },
        ],
    },
    [GunId.Rail]: {
        title: "Rail",
        text: "Slow and heavy: one shot pierces a line.",
        price: 80,
        settings: {
            kind: WeaponKind.Instant,
            damage: 55,
            range: 70,
            shotsPerSecond: 1,
            pellets: 1,
            spread: 0.1,
            //  Through five monsters, and a line of them with its tiers.
            pierce: 4,
            stats: rackGunStats,
            //  One shot a second lays a whole dose.
            data: { dose: 1 },
        },
        perks: [
            {
                title: "Long Rail",
                text: "Through four more monsters.",
                modifiers: [
                    { stat: WardenStat.GunPierce, modifier: { flat: 4 } },
                ],
            },
            {
                title: "Deep Rail",
                text: "Through eight more: a whole line.",
                modifiers: [
                    { stat: WardenStat.GunPierce, modifier: { flat: 8 } },
                ],
            },
            //  Each monster on the line is judged at its own zone, so a
            //  line of heads is the rail's jackpot: half as much again on
            //  every weak spot's double.
            {
                title: "Deadeye",
                text: "Weak spots on its line take triple.",
                modifiers: [
                    {
                        stat: WardenStat.GunWeakSpotDamage,
                        modifier: { more: 0.5 },
                    },
                ],
            },
        ],
    },
};

/** Coins each tier costs, the first tier's first: one, two and three and
 *  a half of a warden's average wave, 40 coins. */
export const upgradePrices: readonly number[] = [40, 80, 140];

export function isGunId(id: string): id is GunId {
    return (gunList as readonly string[]).includes(id);
}

/** The gun a warden holds and its tier: the blaster at none where she has
 *  bought nothing. */
export function readGun(warden: Entity) {
    const held = warden.get(WardenGunTrait);
    const gun = held && isGunId(held.gun) ? held.gun : GunId.Blaster;
    return { gun, tier: held?.tier ?? 0, bought: held?.bought ?? 0 };
}

/** What her next tier costs, or undefined at the top. */
export function readUpgradePrice(tier: number) {
    return upgradePrices[tier];
}

/** The tier a new gun keeps of the one she holds: one less, since
 *  switching for next wave's brutes costs something without erasing what
 *  she built. */
export function keepTier(tier: number) {
    return Math.max(0, tier - 1);
}

/** Times each pellet of `gun` bounces at `tier`. */
export function readRicochets(gun: GunId, tier: number) {
    let ricochets = 0;
    for (let index = 0; index < tier; index++)
        ricochets = guns[gun].perks[index].ricochets ?? ricochets;
    return ricochets;
}

/** The source of the modifiers her gun's tiers add. */
const tierSource = "gun";

/** Puts `gun` at `tier` in her hands: her tier's perks on her gun stats in
 *  place of the last gun's, and the weapons the room takes her shots from.
 *  The lance, where her card gave it, stays in her other hand. `bought`
 *  counts her purchases this run, one more for a gun or a tier she buys and
 *  none where a new run hands her the blaster. */
export function holdGun(warden: Entity, gun: GunId, tier: number, bought = 0) {
    removeStatModifiers(warden, tierSource);
    for (let index = 0; index < tier; index++)
        for (const { stat, modifier } of guns[gun].perks[index].modifiers)
            addStatModifier(warden, stat, { ...modifier, source: tierSource });
    if (warden.has(WardenGunTrait))
        warden.set(WardenGunTrait, { gun, tier, bought });
    else warden.add(WardenGunTrait({ gun, tier, bought }));
}
