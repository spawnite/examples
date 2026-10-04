import { readCameraShakeScale, useSettings } from "@spawnite/engine";

//  The camera's shake: a kick from whatever hits hard, a hit on the
//  soldier or a big kill, fading in a fraction of a second. The camera
//  reads it each frame, and the Look panel turns it off. The player's
//  Screen shake setting scales it, as it scales the engine's own shake.

let strength = 0;

/** Shakes the camera by up to `metres`, unless it already shakes more. */
export function kickShake(metres: number) {
    strength = Math.max(strength, metres);
}

/** The shake's size this frame, after `delta` seconds of fading, at the
 *  player's share of it. */
export function readShake(delta: number) {
    strength *= Math.exp(-delta * 12);
    if (strength < 0.002) strength = 0;
    return strength * readCameraShakeScale(useSettings.getState());
}
