import { Color, Vector3 } from "three";
import { emitGlow, emitSparks } from "./EffectPools";

//  A coin taken: a flash of gold that swells, a ring that spreads, and a few
//  gold motes that rise and fall. Warm gold, short of full saturation, and
//  past white for the bloom.

const flashGold = new Color("#ffe6a8").multiplyScalar(2.2);
const ringGold = new Color("#ffd27a").multiplyScalar(1.8);
const moteGold = new Color("#fff0c0").multiplyScalar(2.6);
const upward = new Vector3(0, 1, 0);

export function popCoin(position: Vector3) {
    emitGlow({
        position,
        color: flashGold,
        seconds: 0.16,
        size: 0.35,
        endSize: 0.8,
    });
    emitGlow({
        position,
        color: ringGold,
        seconds: 0.3,
        size: 0.25,
        endSize: 1.2,
        ring: true,
    });
    emitSparks({
        position,
        color: moteGold,
        count: 7,
        speed: 3.2,
        toward: upward,
        spread: 1.2,
        seconds: 0.55,
        width: 0.06,
        weight: 0.35,
    });
}
