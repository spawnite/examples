import { useEffect } from "react";
import { Vector3 } from "three";
import {
    FloatingText,
    useFloatingText,
    type FloatingTextWriter,
} from "@spawnite/engine";

//  The damage a hit does, floating up off the monster it hit and fading:
//  every page shows every warden's hits, since the stream reports each
//  monster's health. A hit on a weak spot floats its own number: gold,
//  larger and slammed in. A burn's second of ticks floats smaller, in
//  Ember's colour, and only a few at once.

/** What `showDamage` floats: where, how much, whether its hit struck a
 *  weak spot, and whether it is a burn's. */
export interface DamagePopInput {
    position: Vector3;
    amount: number;
    critical?: boolean;
    burn?: boolean;
}

/** Seconds a number floats: a weak spot's a little longer. Each matches
 *  its look's animation in styles.css. */
const popSeconds = 0.75;
const criticalPopSeconds = 0.9;
/** The most numbers in the air at once, the oldest giving its place up,
 *  and of those a burn's, past which a new burn's is left out. */
const mostPops = 24;
export const mostBurns = 6;

/** The scene's writer, while `DamageNumbers` is mounted. Kept here, since
 *  a strike's and a shot's numbers are shown from outside React. */
let writer: FloatingTextWriter | undefined;
/** How many burns' numbers are in the air now. */
let burnsShown = 0;
//  Written in place for each number: the pool copies it.
const at = new Vector3();

/** Floats `amount` up from `position`, gold where its hit struck a weak
 *  spot, and in Ember's colour for a burn. */
export function showDamage({
    position,
    amount,
    critical = false,
    burn = false,
}: DamagePopInput) {
    const seconds = critical ? criticalPopSeconds : popSeconds;
    if (burn) {
        if (burnsShown >= mostBurns) return;
        burnsShown++;
        setTimeout(() => burnsShown--, seconds * 1000);
    }
    //  A hair to one side at random, so a burst of hits fans out.
    at.set(
        position.x + (Math.random() - 0.5) * 1.1,
        position.y + Math.random() * 0.6,
        position.z + (Math.random() - 0.5) * 1.1,
    );
    writer?.show({
        at,
        text: String(Math.round(amount)),
        seconds,
        //  The look's animation carries the rise and the fade.
        rise: 0,
        fade: false,
        className: readNumberLook(amount, critical, burn),
    });
}

/** A big hit reads bigger. */
const bigHit = 30;

/** Each number's look: a weak spot's gold and largest, slammed in with a
 *  shake and a warm glow; a big hit's amber; a burn's small and orange;
 *  the rest white. */
export function readNumberLook(
    amount: number,
    critical: boolean,
    burn: boolean,
) {
    if (burn)
        return "animate-damage-pop text-lg text-orange-400 [text-shadow:0_1px_0_rgb(60_15_0/0.95),0_0_6px_rgb(255_90_20/0.7)]";
    if (critical)
        return "animate-crit-pop text-4xl text-amber-300 [text-shadow:0_2px_0_rgb(80_30_0/0.95),0_0_10px_rgb(255_150_20/0.9),0_0_2px_rgb(0_0_0/0.9)]";
    const shadow =
        "[text-shadow:0_2px_0_rgb(0_0_0/0.85),0_0_8px_rgb(0_0_0/0.6)]";
    return amount >= bigHit
        ? `animate-damage-pop text-3xl text-amber-300 ${shadow}`
        : `animate-damage-pop text-2xl text-white ${shadow}`;
}

/** The scene's damage numbers, mounted once beside its views. */
/** The numbers' type. */
export const numberClasses =
    "font-display font-bold whitespace-nowrap font-stretch-condensed";

export function DamageNumbers() {
    const floatingText = useFloatingText();
    useEffect(() => {
        writer = floatingText;
        return () => {
            writer = undefined;
        };
    }, [floatingText]);
    return <FloatingText capacity={mostPops} className={numberClasses} />;
}
