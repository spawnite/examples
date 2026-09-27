import { WeaponKind, type WeaponSettings } from "@spawnite/engine/core";
import { WardenStat } from "./stats";

//  The Storm Lance: the second weapon, on the right button, that a warden
//  keeps for the run once she takes its card. A slow, heavy beam through
//  up to 13 monsters in a line, judged by the room as the blaster is. Its
//  damage and rate are her lance stats, none until the card gives them, so
//  the room fires nothing that hurts for a warden without it.

export const lanceWeapon = "lance";

/** Metres the lance reaches. */
const lanceRange = 60;
/** Monsters past the first one lance passes through: most of a line a
 *  wave puts in front of her. */
const lancePierce = 12;

export const lanceSettings: WeaponSettings = {
    kind: WeaponKind.Instant,
    damage: 0,
    range: lanceRange,
    shotsPerSecond: 0,
    pierce: lancePierce,
    stats: {
        damage: WardenStat.LanceDamage,
        shotsPerSecond: WardenStat.LanceRate,
    },
};
