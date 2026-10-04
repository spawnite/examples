import { Color, Vector3 } from "three";
import { emitGlow, emitSparks } from "./EffectPools";

//  A coin taken: a flash of gold that swells, a ring that spreads, and a few
//  gold motes that rise and fall. Warm gold, short of full saturation, and
//  past white for the bloom, sized to the coin: a bright wink, not a burst.

const flashGold = new Color("#ffe6a8").multiplyScalar(1.6);
const ringGold = new Color("#ffd27a").multiplyScalar(1.3);
const moteGold = new Color("#fff0c0").multiplyScalar(2.2);
const upward = new Vector3(0, 1, 0);

/** Pops a coin at `position`, `size` times its full size. */
export function popCoin(position: Vector3, size = 1) {
    emitGlow({
        position,
        color: flashGold,
        seconds: 0.14,
        size: 0.22 * size,
        endSize: 0.5 * size,
    });
    emitGlow({
        position,
        color: ringGold,
        seconds: 0.28,
        size: 0.16 * size,
        endSize: 0.75 * size,
        ring: true,
    });
    emitSparks({
        position,
        color: moteGold,
        count: Math.max(2, Math.round(6 * size)),
        speed: 2.6 * size,
        toward: upward,
        spread: 1.2,
        seconds: 0.5,
        width: 0.045,
        weight: 0.35,
    });
}
