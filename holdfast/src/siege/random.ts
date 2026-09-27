/** What a draw advances: the siege's seed, or the coins' scatter. */
export interface Seeded {
    seed: number;
}

/** A draw in [0, 1) from `seeded`'s state, which it advances: mulberry32,
 *  small and fast, and the same run from the same seed in every test. */
export function drawRandom(seeded: Seeded) {
    seeded.seed = (seeded.seed + 0x6d2b79f5) | 0;
    let mixed = seeded.seed;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

/** A whole number from 0 up to, not including, `count`. */
export function drawIndex(seeded: Seeded, count: number) {
    return Math.floor(drawRandom(seeded) * count);
}
