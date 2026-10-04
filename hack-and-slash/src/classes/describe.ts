import { jobRules } from "./catalog";
import {
    modifierStats,
    unlockTexts,
    type ActiveDef,
    type Modifier,
    type SkillDef,
    type Unlock,
} from "./schema";

//  A skill's text, written from its data, so a number changed in a class
//  file or the class editor never leaves its text behind.

const shown = (value: number) => Math.round(value * 100) / 100;

/** A modifier at `rank`, such as "+10% damage". */
export function describeModifier({ stat, perRank }: Modifier, rank: number) {
    const value = shown(perRank * rank);
    const { label, percent } = modifierStats[stat];
    return `${value >= 0 ? "+" : ""}${value}${percent ? "%" : ""} ${label}`;
}

/** What an unlock lets her do. */
export const describeUnlock = (unlock: Unlock) =>
    unlockTexts[unlock].replace(
        "{share}",
        `${Math.round(jobRules.dualShare * 100)}%`,
    );

/** The share of her attack a cast deals at `rank`. */
export const activeDamage = (active: ActiveDef, rank: number) =>
    active.damage + active.damagePerRank * Math.max(0, rank - 1);

/** What casting a skill does at `rank`, in a line. */
export function describeActive(active: ActiveDef, rank: number) {
    const share = `${Math.round(activeDamage(active, rank) * 100)}% of your attack`;
    const what =
        active.action === "volley"
            ? `Looses ${active.count} bolts in a fan, each dealing ${share}`
            : active.shape === "cone"
              ? `Deals ${share} to everything in a ${shown(active.spread * 2)}° wedge ${shown(active.reach)} m ahead`
              : `Deals ${share} to everything within ${shown(active.reach)} m`;
    return `${what} · ${shown(active.cooldown)} s cooldown · ${shown(active.stamina)} stamina`;
}

/** Every line of what a skill does at `rank`: its modifiers, its unlocks
 *  and its cast. */
export function describeSkill(skill: SkillDef, rank: number) {
    return [
        ...skill.modifiers.map((modifier) => describeModifier(modifier, rank)),
        ...skill.unlocks.map(describeUnlock),
        ...(skill.active ? [describeActive(skill.active, rank)] : []),
    ];
}

/** Which weapon a skill works with, as its text says it. */
export const describeWeapon = (skill: SkillDef) =>
    skill.weapon === "any" ? "With any weapon" : `With a ${skill.weapon}`;
