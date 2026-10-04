import { WeaponKind, type WeaponSettings } from "@spawnite/engine/core";
import { WardenStat } from "./stats";

//  The Lance: the second weapon, on the right button, that a warden
//  keeps for the run once she takes its card. A slow, heavy beam through
//  up to 13 monsters in a line, judged by the room as the blaster is. Its
//  own damage and rate are nothing: her lance stats, which the card fills,
//  make them, so the room fires nothing that hurts for a warden without
//  it. Her damage and fire rate raise it as they raise the blaster.

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
        damage: [WardenStat.LanceDamage, WardenStat.Damage],
        shotsPerSecond: [WardenStat.LanceRate, WardenStat.FireRate],
        zoneDamage: WardenStat.WeakSpotDamage,
    },
    //  Its 0.75 shots a second, the card's, apply one whole dose of her
    //  elements a second, as the blaster's six do, to every monster in its
    //  line.
    data: { dose: 4 / 3 },
};
