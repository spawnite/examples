import { MathUtils, Quaternion, Vector3, type Bone } from "three";

//  Written in place on each call.
const shoulder = new Vector3();
const elbow = new Vector3();
const wrist = new Vector3();
const toWrist = new Vector3();
const toElbow = new Vector3();
const elbowBack = new Vector3();
const elbowOut = new Vector3();
const toTarget = new Vector3();
const bendAxis = new Vector3();
const xAxis = new Vector3(1, 0, 0);
const yAxis = new Vector3(0, 1, 0);
const turn = new Quaternion();
const parentTurn = new Quaternion();
const upperStart = new Quaternion();
const lowerStart = new Quaternion();

/** Turns `bone` by `delta`, a turn in world space. */
export function turnInWorld(bone: Bone, delta: Quaternion) {
    bone.parent?.getWorldQuaternion(parentTurn) ?? parentTurn.identity();
    //  Under a parent squashed on one axis, as a hit or a shot squashes the
    //  soldier, the world matrix shears, and the turn read from it is not
    //  of unit length; one that is not scales the bone.
    parentTurn.normalize();
    bone.quaternion.premultiply(parentTurn).premultiply(delta);
    bone.quaternion.premultiply(parentTurn.invert()).normalize();
    bone.updateMatrixWorld(true);
}

/** Turns `bone` so its turn in world space is `worldTurn`. */
export function setWorldTurn(bone: Bone, worldTurn: Quaternion) {
    bone.parent?.getWorldQuaternion(parentTurn) ?? parentTurn.identity();
    //  Normalized for the sheared parent `turnInWorld` explains.
    bone.quaternion
        .copy(parentTurn.normalize().invert())
        .multiply(worldTurn)
        .normalize();
    bone.updateMatrixWorld(true);
}

/** An arm's bones, the point in world space its hand reaches for, and how
 *  much of the reach shows over the arm's pose, from 0 to 1. */
export interface ArmReach {
    upper: Bone;
    lower: Bone;
    hand: Bone;
    target: Vector3;
    weight: number;
    /** The way in world space the elbow points, as Unity's hint and
     *  Unreal's pole target set it; the arm's own bend without it. */
    pole?: Vector3;
}

/** Bends the arm so the hand lands on its target, or reaches straight at
 *  it when it is too far: a two-bone IK, as Unity's TwoBoneIKConstraint
 *  and Unreal's Two Bone IK node solve it. */
export function reachWithArm({
    upper,
    lower,
    hand,
    target,
    weight,
    pole,
}: ArmReach) {
    if (weight <= 0) return;
    upper.updateWorldMatrix(true, true);
    upperStart.copy(upper.quaternion);
    lowerStart.copy(lower.quaternion);
    upper.getWorldPosition(shoulder);
    lower.getWorldPosition(elbow);
    hand.getWorldPosition(wrist);
    const upperLength = elbow.distanceTo(shoulder);
    const lowerLength = wrist.distanceTo(elbow);
    const reach = MathUtils.clamp(
        target.distanceTo(shoulder),
        1e-4,
        upperLength + lowerLength - 1e-4,
    );
    toWrist.subVectors(wrist, shoulder);
    toElbow.subVectors(elbow, shoulder);
    elbowBack.subVectors(shoulder, elbow);
    elbowOut.subVectors(wrist, elbow);
    toTarget.subVectors(target, shoulder);
    //  The angles at the shoulder and the elbow now, and the ones that put
    //  the wrist `reach` from the shoulder, by the law of cosines.
    const shoulderNow = toWrist.angleTo(toElbow);
    const elbowNow = elbowBack.angleTo(elbowOut);
    const shoulderWanted = Math.acos(
        MathUtils.clamp(
            (lowerLength ** 2 - upperLength ** 2 - reach ** 2) /
                (-2 * upperLength * reach),
            -1,
            1,
        ),
    );
    const elbowWanted = Math.acos(
        MathUtils.clamp(
            (reach ** 2 - upperLength ** 2 - lowerLength ** 2) /
                (-2 * upperLength * lowerLength),
            -1,
            1,
        ),
    );
    //  The arm bends in the plane it bends in now; a straight arm bends in
    //  the plane that holds the target.
    bendAxis.crossVectors(toWrist, toElbow);
    if (bendAxis.lengthSq() < 1e-10) bendAxis.crossVectors(toWrist, toTarget);
    if (bendAxis.lengthSq() < 1e-10)
        bendAxis
            .copy(Math.abs(toWrist.x) < 0.9 * toWrist.length() ? xAxis : yAxis)
            .cross(toWrist);
    bendAxis.normalize();
    turnInWorld(
        upper,
        turn.setFromAxisAngle(bendAxis, shoulderWanted - shoulderNow),
    );
    turnInWorld(lower, turn.setFromAxisAngle(bendAxis, elbowWanted - elbowNow));
    //  Then the whole arm swings so the wrist points at the target.
    hand.getWorldPosition(wrist);
    toWrist.subVectors(wrist, shoulder).normalize();
    turnInWorld(upper, turn.setFromUnitVectors(toWrist, toTarget.normalize()));
    //  Then the elbow swings round the line to the target until it points
    //  along the pole, and the forearm swings back to the wrist: two
    //  swings, so neither bone twists about its own length.
    if (pole) {
        lower.getWorldPosition(elbow);
        toElbow.subVectors(elbow, shoulder);
        const along = toElbow.dot(toTarget);
        elbowBack.copy(toElbow).addScaledVector(toTarget, -along);
        elbowOut.copy(pole).addScaledVector(toTarget, -pole.dot(toTarget));
        if (elbowBack.lengthSq() > 1e-10 && elbowOut.lengthSq() > 1e-10) {
            elbowOut
                .setLength(elbowBack.length())
                .addScaledVector(toTarget, along);
            turnInWorld(
                upper,
                turn.setFromUnitVectors(
                    toElbow.normalize(),
                    elbowOut.normalize(),
                ),
            );
            lower.getWorldPosition(elbow);
            hand.getWorldPosition(wrist);
            elbowBack.subVectors(wrist, elbow).normalize();
            elbowOut.subVectors(target, elbow).normalize();
            turnInWorld(lower, turn.setFromUnitVectors(elbowBack, elbowOut));
        }
    }
    if (weight >= 1) return;
    upper.quaternion.slerpQuaternions(upperStart, upper.quaternion, weight);
    lower.quaternion.slerpQuaternions(lowerStart, lower.quaternion, weight);
    upper.updateMatrixWorld(true);
}
