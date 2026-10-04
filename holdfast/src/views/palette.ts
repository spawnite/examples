import { Element } from "../siege/elements";
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
    //  Charred rock with molten seams: dark enough that its cracks and eyes
    //  carry it, in the fire's colours rather than the brute's red.
    [MonsterKind.Colossus]: {
        eyes: "#ff7a1a",
        rim: "#ff9a4a",
        body: "#6a5a58",
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

/** Each element's colour, on its hits, its marks, its cards and every
 *  word: Storm yellow, Ember orange-red, Frost ice-blue. Each short of full
 *  saturation, so its brightest glow burns toward white under the tone
 *  mapping, as a hot light does. */
export const elementColors: Record<Element, string> = {
    [Element.Storm]: "#ffe45c",
    [Element.Ember]: "#ff6a2b",
    [Element.Frost]: "#8fd8ff",
};

/** An element's colour as the HUD writes it: its text, a card's frame, a
 *  big word's glow, and a badge's fill and edge. */
interface ElementClassNames {
    text: string;
    frame: string;
    glow: string;
    fill: string;
}

/** Each element's classes, written out whole because Tailwind emits only
 *  the classes it reads in the source. */
export const elementClasses: Record<Element, ElementClassNames> = {
    [Element.Storm]: {
        text: "text-yellow-300",
        frame: "border-yellow-300/80 shadow-[0_0_22px_rgb(253_224_71/0.35)] hover:border-yellow-200 hover:shadow-[0_0_0_1px_rgb(254_240_138/0.8),0_0_36px_rgb(253_224_71/0.55)]",
        glow: "[text-shadow:0_0_18px_rgb(253_224_71/0.85),0_3px_0_rgb(0_0_0/0.8)]",
        fill: "bg-yellow-300/15 border-yellow-200/40",
    },
    [Element.Ember]: {
        text: "text-orange-400",
        frame: "border-orange-400/80 shadow-[0_0_22px_rgb(251_146_60/0.35)] hover:border-orange-300 hover:shadow-[0_0_0_1px_rgb(253_186_116/0.8),0_0_36px_rgb(251_146_60/0.55)]",
        glow: "[text-shadow:0_0_18px_rgb(251_113_60/0.85),0_3px_0_rgb(0_0_0/0.8)]",
        fill: "bg-orange-400/15 border-orange-300/40",
    },
    [Element.Frost]: {
        text: "text-sky-300",
        frame: "border-sky-300/80 shadow-[0_0_22px_rgb(125_211_252/0.35)] hover:border-sky-200 hover:shadow-[0_0_0_1px_rgb(186_230_253/0.8),0_0_36px_rgb(125_211_252/0.55)]",
        glow: "[text-shadow:0_0_18px_rgb(125_211_252/0.85),0_3px_0_rgb(0_0_0/0.8)]",
        fill: "bg-sky-300/15 border-sky-200/40",
    },
};
