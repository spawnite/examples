import { Color } from "three";

//  The neon's glow. The field draws past tone mapping, so a colour lifted
//  above white keeps its hue on screen and passes the bloom's threshold,
//  which the flat floor and the figures, left at their own colours, never
//  reach. Only what should glow is lifted: the walls' and boxes' rims, the
//  shots and telegraphs, the orbs, the sparks and a hit's flash.

/** How far above white a glowing colour is lifted. */
export const neonLift = 2.4;

/** The bloom's threshold: a pixel's luminance past which it glows. */
export const glowThreshold = 1;

/** `hex` lifted to glow, written into `out`. */
export function liftNeon(hex: string, out: Color, lift = neonLift) {
    return out.set(hex).multiplyScalar(lift);
}
