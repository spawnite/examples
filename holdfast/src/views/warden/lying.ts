import { Quaternion, Vector3, type Object3D } from "three";
import type { GroundHeight } from "@spawnite/engine";

//  A downed warden lies on her back with her feet toward her aim, along the
//  ground where she fell: on a hillside her body tilts with the slope, so
//  her head and shoulders rest on it rather than sink into it. The slope is
//  read under the length of her body, from her feet to her head, and across
//  her hips, so one bump under her feet does not tip her. Her place faces
//  negative z, as a hero does, so her head lies toward positive z.

/** Metres from her feet to where her head lies, and from her spine to
 *  each side where the slope is read across her. */
const headMetres = 1.4;
const sideMetres = 0.35;
/** Metres her back lies off the ground. */
const backClearance = 0.2;

/** The ground under her, in her place's frame. */
export interface GroundUnder {
    /** The ground's up under her body. */
    normal: Vector3;
    /** Metres from her place up to the ground under her feet: a body that
     *  stands on a slope rests a little off it. */
    lift: number;
}

//  Written in place on each call.
const up = new Vector3(0, 1, 0);
const side = new Vector3(1, 0, 0);
const axis = new Vector3();
const feet = new Vector3();
const head = new Vector3();
const left = new Vector3();
const right = new Vector3();
const along = new Vector3();
const across = new Vector3();
const frameTurn = new Quaternion();
const tilt = new Quaternion();
const lying = new Quaternion();
const turn = new Quaternion();

/** Where the ground at `point`, in `frame`'s frame, lies in the world. */
function readGroundPoint(
    ground: GroundHeight,
    frame: Object3D,
    point: Vector3,
) {
    return ground.getPointAt(frame.localToWorld(point), point);
}

/** Reads the ground under a warden lying in `frame`, her place: its slope
 *  along and across her body, and how far under her place it lies, into
 *  `target`. */
export function measureGround(
    ground: GroundHeight,
    frame: Object3D,
    target: GroundUnder,
) {
    readGroundPoint(ground, frame, feet.set(0, 0, 0));
    readGroundPoint(ground, frame, head.set(0, 0, headMetres));
    readGroundPoint(ground, frame, left.set(-sideMetres, 0, headMetres / 2));
    readGroundPoint(ground, frame, right.set(sideMetres, 0, headMetres / 2));
    along.subVectors(head, feet);
    across.subVectors(right, left);
    target.normal.crossVectors(along, across).normalize();
    if (target.normal.y < 0) target.normal.negate();
    frame.getWorldQuaternion(frameTurn).invert();
    target.normal.applyQuaternion(frameTurn);
    target.lift = feet.y - frame.getWorldPosition(head).y;
    return target;
}

export interface LayBodyOptions {
    /** Her body's turn standing, the one the model rests at. */
    rest: Quaternion;
    /** The ground under her, as `measureGround` reads it. */
    ground: GroundUnder;
    /** How far down she is, from 0 standing to 1 lying. */
    down: number;
}

/** Turns and lifts `body`, which stands at `rest` in her place's frame,
 *  from standing toward lying on her back along the ground, feet toward
 *  her aim: a quarter turn back onto the ground's plane, and the plane's
 *  tilt, each as far as `down`. */
export function layBody(
    body: Object3D,
    { rest, ground, down }: LayBodyOptions,
) {
    tilt.setFromUnitVectors(up, ground.normal);
    turn.identity().slerp(tilt, down);
    lying.setFromAxisAngle(side, (Math.PI / 2) * down);
    body.quaternion.copy(turn).multiply(lying).multiply(rest);
    body.position
        .copy(ground.normal)
        .multiplyScalar(backClearance * down)
        .addScaledVector(up, ground.lift * down);
}

/** Radians above level that `direction`, in the body's own frame at
 *  rest, points once the body is turned. */
function readRise(body: Object3D, rest: Quaternion, direction: Vector3) {
    turn.copy(rest).invert().premultiply(body.quaternion);
    axis.copy(direction).applyQuaternion(turn);
    return Math.asin(Math.min(1, Math.max(-1, axis.y)));
}

/** Radians her chest faces above level, from 0 standing to a quarter
 *  turn lying flat: her aim's level, seen from her body, is that far
 *  toward her feet. */
export function readChestRise(body: Object3D, rest: Quaternion) {
    return readRise(body, rest, axis.set(0, 0, -1));
}

/** Radians her head lies above her feet's level, from a quarter turn
 *  standing to 0 lying flat, and more where the ground rises behind her. */
export function readHeadRise(body: Object3D, rest: Quaternion) {
    return readRise(body, rest, axis.set(0, 1, 0));
}
