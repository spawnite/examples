import { VRMHumanBoneName, type VRM } from "@pixiv/three-vrm";
import { Quaternion, Vector3, type Object3D } from "three";

//  A two-handed hold on the blaster, laid over whatever the clips did to
//  her arms: the right hand at the grip at her right shoulder, where the
//  camera over that shoulder sees the gun past her head and hair, the left
//  under the barrel, both arms bent to reach there, and the whole hold
//  turned up or down with her aim. Worked in the normalized rig's frame, where every
//  bone rests unturned: a VRM 0.x body faces negative z there and rests its
//  right arm along positive x, a VRM 1 body the other way round.

/** Where the grip and the barrel's underside sit, in metres from the
 *  middle between her shoulders: across to her right, up, and forward. */
const grip = { right: 0.24, up: 0.06, forward: 0.2 };
const foregrip = { right: 0.2, up: 0.04, forward: 0.45 };
/** Which way each elbow bends: out from her side and down. */
const elbowOut = 0.6;

const rightBones = {
    upper: VRMHumanBoneName.RightUpperArm,
    lower: VRMHumanBoneName.RightLowerArm,
    hand: VRMHumanBoneName.RightHand,
};
const leftBones = {
    upper: VRMHumanBoneName.LeftUpperArm,
    lower: VRMHumanBoneName.LeftLowerArm,
    hand: VRMHumanBoneName.LeftHand,
};

//  Written in place for each pose.
const right = new Vector3();
const forward = new Vector3();
const up = new Vector3(0, 1, 0);
const lateral = new Vector3(1, 0, 0);
const pitchTurn = new Quaternion();
const handTurn = new Quaternion();
const middle = new Vector3();
const leftShoulder = new Vector3();
const rightShoulder = new Vector3();
const offset = new Vector3();
const gripAt = new Vector3();
const foregripAt = new Vector3();
const pole = new Vector3();
const reach = new Vector3();
const elbow = new Vector3();
const along = new Vector3();
const restAxis = new Vector3();
const leftAxis = new Vector3();
const parentTurn = new Quaternion();
const upperTurn = new Quaternion();
const lowerTurn = new Quaternion();
const inverse = new Quaternion();

interface ArmBones {
    upper: VRMHumanBoneName;
    lower: VRMHumanBoneName;
    hand: VRMHumanBoneName;
}

/** The turn of `node`'s parent from the rig's rest, in the rig's frame. */
function measureParentTurn(node: Object3D, root: Object3D, target: Quaternion) {
    target.identity();
    let parent = node.parent;
    while (parent && parent !== root) {
        target.premultiply(parent.quaternion);
        parent = parent.parent;
    }
    return target;
}

/** A point `place` names from the middle between her shoulders, turned by
 *  her aim, into `target`. */
function placePoint(place: typeof grip, target: Vector3) {
    offset
        .copy(right)
        .multiplyScalar(place.right)
        .addScaledVector(up, place.up)
        .addScaledVector(forward, place.forward)
        .applyQuaternion(pitchTurn);
    return target.copy(middle).add(offset);
}

interface ArmReach {
    vrm: VRM;
    bones: ArmBones;
    shoulder: Vector3;
    target: Vector3;
    /** Along the arm at rest, in the rig's frame. */
    axis: Vector3;
    /** The hand's turn in the rig's frame. */
    hand: Quaternion;
}

/** Bends one arm so its hand reaches `target`, its elbow toward the pole,
 *  and turns the hand to `hand`: two bones solved in closed form. */
function reachArm({ vrm, bones, shoulder, target, axis, hand }: ArmReach) {
    const { humanoid } = vrm;
    const root = humanoid.normalizedHumanBonesRoot;
    const upper = humanoid.getNormalizedBoneNode(bones.upper);
    const lower = humanoid.getNormalizedBoneNode(bones.lower);
    const wrist = humanoid.getNormalizedBoneNode(bones.hand);
    if (!upper || !lower || !wrist) return;
    const upperLength = lower.position.length();
    const lowerLength = wrist.position.length();
    reach.subVectors(target, shoulder);
    const distance = Math.min(
        Math.max(reach.length(), 1e-3),
        upperLength + lowerLength - 1e-3,
    );
    reach.normalize();
    //  How far along the reach the elbow sits, and how far off it.
    const alongReach =
        (upperLength * upperLength -
            lowerLength * lowerLength +
            distance * distance) /
        (2 * distance);
    const offReach = Math.sqrt(
        Math.max(0, upperLength * upperLength - alongReach * alongReach),
    );
    pole.addScaledVector(reach, -pole.dot(reach)).normalize();
    elbow
        .copy(shoulder)
        .addScaledVector(reach, alongReach)
        .addScaledVector(pole, offReach);
    upperTurn.setFromUnitVectors(
        restAxis.copy(axis),
        along.subVectors(elbow, shoulder).normalize(),
    );
    lowerTurn.setFromUnitVectors(
        restAxis.copy(axis),
        along
            .copy(reach)
            .multiplyScalar(distance)
            .add(shoulder)
            .sub(elbow)
            .normalize(),
    );
    measureParentTurn(upper, root, parentTurn);
    upper.quaternion
        .copy(inverse.copy(parentTurn).invert())
        .multiply(upperTurn);
    lower.quaternion.copy(inverse.copy(upperTurn).invert()).multiply(lowerTurn);
    wrist.quaternion.copy(inverse.copy(lowerTurn).invert()).multiply(hand);
}

export interface AimHold {
    /** Radians her aim is above level. */
    pitch: number;
}

/** Lays the two-handed hold over her arms. The caller then copies the rig
 *  to the skin and updates the arms' matrices. */
export function holdBlaster(vrm: VRM, { pitch }: AimHold) {
    const { humanoid } = vrm;
    const root = humanoid.normalizedHumanBonesRoot;
    const rightUpper = humanoid.getNormalizedBoneNode(rightBones.upper);
    const leftUpper = humanoid.getNormalizedBoneNode(leftBones.upper);
    if (!rightUpper || !leftUpper) return;
    const side = vrm.meta.metaVersion === "0" ? 1 : -1;
    right.set(side, 0, 0);
    forward.set(0, 0, -side);
    pitchTurn.setFromAxisAngle(lateral, side * pitch);
    root.updateWorldMatrix(true, true);
    root.worldToLocal(rightUpper.getWorldPosition(rightShoulder));
    root.worldToLocal(leftUpper.getWorldPosition(leftShoulder));
    middle.addVectors(rightShoulder, leftShoulder).multiplyScalar(0.5);
    placePoint(grip, gripAt);
    placePoint(foregrip, foregripAt);
    //  The right hand turns its arm's axis to the barrel; the left, whose
    //  arm rests the other way, turns the same way round.
    handTurn.setFromAxisAngle(up, Math.PI / 2).premultiply(pitchTurn);
    pole.copy(right).multiplyScalar(elbowOut).sub(up);
    reachArm({
        vrm,
        bones: rightBones,
        shoulder: rightShoulder,
        target: gripAt,
        axis: right,
        hand: handTurn,
    });
    handTurn.setFromAxisAngle(up, -Math.PI / 2).premultiply(pitchTurn);
    pole.copy(right).multiplyScalar(-elbowOut).sub(up);
    reachArm({
        vrm,
        bones: leftBones,
        shoulder: leftShoulder,
        target: foregripAt,
        axis: leftAxis.copy(right).negate(),
        hand: handTurn,
    });
}
