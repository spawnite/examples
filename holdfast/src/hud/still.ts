import { useSettings } from "@spawnite/engine";

/** Whether the player asked for less motion, in the game's settings or,
 *  until she sets it there, her device's: a card then lands with its
 *  chime and no flight, and a count jumps rather than ticks. */
export function isStill() {
    return (
        useSettings.getState().reducedMotion ??
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
        false
    );
}
