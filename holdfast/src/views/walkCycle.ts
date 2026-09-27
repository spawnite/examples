import type { Object3D } from "three";
import { Vector3 } from "three";

//  How fast a drawn body moves, measured off where the frame put it: the
//  stream carries no walk cycle, so each page times a body's legs to the
//  ground it covers.

/** A body's walk as its view keeps it between frames. */
export interface WalkCycle {
    /** Where the body stood last frame. */
    last: Vector3;
    /** Its speed over the ground, eased, in metres a second. */
    speed: number;
    /** Whether `last` holds a place yet. */
    placed: boolean;
}

export function createWalkCycle(): WalkCycle {
    return { last: new Vector3(), speed: 0, placed: false };
}

/** One frame of a drawn body: the object the frame placed, and the
 *  frame's seconds. */
export interface WalkFrame {
    object: Object3D;
    delta: number;
}

/** Moves the stride on by a frame of the body's motion. */
export function advanceWalkCycle(
    stride: WalkCycle,
    { object, delta }: WalkFrame,
) {
    const { position } = object;
    if (!stride.placed) {
        stride.last.copy(position);
        stride.placed = true;
        return stride;
    }
    const travelled = Math.hypot(
        position.x - stride.last.x,
        position.z - stride.last.z,
    );
    stride.last.copy(position);
    //  A jump across the map, as a correction or a respawn, is no step.
    const speed = delta > 0 && travelled < 3 ? travelled / delta : 0;
    stride.speed += (speed - stride.speed) * Math.min(1, delta * 10);
    return stride;
}
