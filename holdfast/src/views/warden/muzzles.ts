import type { Object3D, Vector3 } from "three";

//  Where each warden's barrel ends on this page, by her hue, which is
//  unique among the wardens in a room: her shots leave from there, and a
//  shot's line and flash start there.

const muzzles = new Map<number, Object3D>();
/** Page seconds of each warden's last shot, by hue. */
const firedAt = new Map<number, number>();

export function holdMuzzle(hue: number, muzzle: Object3D) {
    muzzles.set(hue, muzzle);
    return () => {
        if (muzzles.get(hue) === muzzle) muzzles.delete(hue);
    };
}

/** Writes the world position of the barrel's end of the warden of `hue`
 *  into `target`, and returns whether she has one drawn. It is where the
 *  last draw put it: her hold is laid over the clips just before a draw,
 *  so a frame's own matrices still hold the clips' arm. */
export function findMuzzle(hue: number, target: Vector3) {
    const muzzle = muzzles.get(hue);
    if (!muzzle) return false;
    target.setFromMatrixPosition(muzzle.matrixWorld);
    return true;
}

/** Marks a shot from the warden of `hue`, which her gun flashes and kicks
 *  for. */
export function markShot(hue: number) {
    firedAt.set(hue, performance.now() / 1000);
}

/** Seconds since the warden of `hue` last fired: Infinity before her
 *  first. */
export function measureSinceShot(hue: number) {
    const at = firedAt.get(hue);
    return at === undefined ? Infinity : performance.now() / 1000 - at;
}
