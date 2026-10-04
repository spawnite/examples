import type { Entity } from "koota";
import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from "three";
import {
    fixedStepSeconds,
    PreviousTransformTrait,
    TransformTrait,
    useTime,
} from "@spawnite/engine";
import { liftNeon } from "./neon";

//  What every view of the field's many things shares: where a thing stands
//  on this frame, blended between the last two steps, and a write of one
//  copy of an instanced mesh.

let seenSteps = -1;
let stepAt = 0;

/** How far the frame stands between the last step and the next, 0 to 1.
 *  ponytail: measured from when this module first saw the step count move,
 *  a step behind the engine's own blend; the engine's frame loop knows the
 *  real fraction and would export it (the pull request's engine gaps). */
export function readStepFraction() {
    const steps = useTime.getState().steps;
    const now = performance.now();
    if (steps !== seenSteps) {
        seenSteps = steps;
        stepAt = now;
    }
    return Math.min(1, (now - stepAt) / (fixedStepSeconds * 1000));
}

/** Writes where `entity` stands this frame into `out`. */
export function blendPosition(entity: Entity, fraction: number, out: Vector3) {
    const current = entity.get(TransformTrait);
    if (!current) return out;
    const previous = entity.get(PreviousTransformTrait);
    return previous
        ? out.lerpVectors(previous, current, fraction)
        : out.copy(current);
}

const matrix = new Matrix4();
const flat = new Quaternion();
const unit = new Vector3(1, 1, 1);

interface Placement {
    position: Vector3;
    scale?: Vector3;
    rotation?: Quaternion;
}

/** Sets copy `index` of `mesh` to stand at a place, scaled and turned. */
export function placeInstance(
    mesh: InstancedMesh,
    index: number,
    { position, scale = unit, rotation = flat }: Placement,
) {
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
}

const color = new Color();

/** Tints copy `index` of `mesh`. */
export function tintInstance(mesh: InstancedMesh, index: number, hex: string) {
    mesh.setColorAt(index, color.set(hex));
}

/** Tints copy `index` of `mesh` in a colour lifted to glow. */
export function glowInstance(mesh: InstancedMesh, index: number, hex: string) {
    mesh.setColorAt(index, liftNeon(hex, color));
}

/** Draws the first `count` copies, marking what changed for the GPU. */
export function finishInstances(mesh: InstancedMesh, count: number) {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** A turn that lays a flat shape, facing up, on the ground. */
export const lieFlat = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -Math.PI / 2,
);
