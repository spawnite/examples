import { Matrix4, Vector3, type Object3D } from "three";

//  Where each warden's barrel ends on this page, by her hue, which is
//  unique among the wardens in a room: her shots leave from there, and a
//  shot's line and flash start there. Her gun, whichever she holds, names
//  its barrel's end; her hold settles where it drew it.

interface HeldMuzzle {
    /** The barrel's end, in her gun's own frame. */
    muzzle: Object3D;
    /** The object that places her, which the drawn barrel moves with. */
    place: Object3D | null;
    /** Where the last draw put the barrel's end, in `place`'s frame. */
    drawn: Vector3;
    /** Which way the last draw pointed the barrel, in `place`'s frame. */
    pointed: Vector3;
}

const muzzles = new Map<number, HeldMuzzle>();
/** Page seconds of each warden's last shot, by hue. */
const firedAt = new Map<number, number>();

/** Names `muzzle` as the end of the barrel of the gun the warden of `hue`
 *  holds, until the returned function puts it away. */
export function holdMuzzle(hue: number, muzzle: Object3D) {
    const held: HeldMuzzle = {
        muzzle,
        place: null,
        drawn: new Vector3(),
        pointed: new Vector3(0, 0, -1),
    };
    muzzles.set(hue, held);
    return () => {
        if (muzzles.get(hue) === held) muzzles.delete(hue);
    };
}

/** Keeps where the barrel of the warden of `hue` ends as her hold draws it,
 *  in `place`, the object that places her. Her hold calls it once it has
 *  updated her arm's world matrices, just before the draw: the engine's
 *  frame loop poses her arm from the clips again before the next one, so
 *  the muzzle's own matrix holds the clips' arm for part of each frame. */
export function settleMuzzle(hue: number, place: Object3D) {
    const held = muzzles.get(hue);
    if (!held) return;
    held.place = place;
    place.worldToLocal(
        held.drawn.setFromMatrixPosition(held.muzzle.matrixWorld),
    );
    //  The barrel runs along the muzzle's -z.
    held.muzzle
        .getWorldDirection(held.pointed)
        .negate()
        .transformDirection(unplace.copy(place.matrixWorld).invert());
}

//  Written in place as each hold settles.
const unplace = new Matrix4();

/** Writes which way the barrel of the warden of `hue` points, as her hold
 *  last drew it, into `target`, a unit vector in the world, and returns
 *  whether she has one drawn. */
export function findMuzzleAim(hue: number, target: Vector3) {
    const held = muzzles.get(hue);
    if (!held?.place) return false;
    target.copy(held.pointed).transformDirection(held.place.matrixWorld);
    return true;
}

/** Writes the world position of the barrel's end of the warden of `hue`
 *  into `target`, and returns whether she has one drawn. It is where the
 *  last draw put it in her place, carried to where her place stands now,
 *  whatever the clips did to her arm since. */
export function findMuzzle(hue: number, target: Vector3) {
    const held = muzzles.get(hue);
    if (!held?.place) return false;
    held.place.updateWorldMatrix(true, false);
    target.copy(held.drawn).applyMatrix4(held.place.matrixWorld);
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
