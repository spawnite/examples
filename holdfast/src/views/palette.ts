import { EliteModifier, MonsterKind } from "../siege/traits";
import type { MonsterLook } from "./monsters/motion";

//  The game's colours, by what they mark.

/** Each warden's colour, by her hue: her shots, the ring at her feet, her
 *  name. */
const wardenColors = ["#ffb13b", "#3fe0d0", "#ff6fae", "#9be34d"];

/** The same colours as text classes, written out whole because Tailwind
 *  emits only the classes it reads in the source. */
const wardenTextClasses = [
    "text-amber-300",
    "text-teal-300",
    "text-pink-300",
    "text-lime-300",
];

/** A warden's colour for her hue, wrapping past the last. */
export function readWardenColor(hue: number) {
    return wardenColors[hue % wardenColors.length];
}

/** A warden's name's text class for her hue. */
export function readWardenTextClass(hue: number) {
    return wardenTextClasses[hue % wardenTextClasses.length];
}

/** Each kind of monster's colours: its eyes, which its wind-up and its
 *  bursts share, its rim and its body's grade. */
export const monsterLooks: Record<MonsterKind, MonsterLook> = {
    [MonsterKind.Husk]: { eyes: "#ff8a1f", rim: "#ffc090", body: "#c4bcc4" },
    [MonsterKind.Skitter]: { eyes: "#ff2e3b", rim: "#ff9088", body: "#d8c8c8" },
    [MonsterKind.Brute]: { eyes: "#b46bff", rim: "#d0b0ff", body: "#b8a8c0" },
    [MonsterKind.Spitter]: { eyes: "#a6e04a", rim: "#d4f0a0", body: "#b4bca4" },
    [MonsterKind.Colossus]: {
        eyes: "#ffa53a",
        rim: "#ffd488",
        body: "#c8b094",
    },
};

/** The eyes and rim an elite wears over its kind's, in its modifier's
 *  colour. */
const eliteLooks: Record<
    Exclude<EliteModifier, EliteModifier.None>,
    Pick<MonsterLook, "eyes" | "rim">
> = {
    [EliteModifier.Swift]: { eyes: "#4fe0f0", rim: "#a8f0ff" },
    [EliteModifier.Armoured]: { eyes: "#ffc850", rim: "#dde2ea" },
    [EliteModifier.Splitting]: { eyes: "#f060e0", rim: "#ffa8f0" },
};

/** A monster's colours: its kind's, with an elite's eyes and rim over
 *  them. */
export function readMonsterLook(
    kind: MonsterKind,
    elite: EliteModifier,
): MonsterLook {
    const look = monsterLooks[kind];
    return elite === EliteModifier.None
        ? look
        : { ...look, ...eliteLooks[elite] };
}
