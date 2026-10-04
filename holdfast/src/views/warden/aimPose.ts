import { VRMHumanBoneName, type VRM } from "@pixiv/three-vrm";
import { Quaternion, Vector3, type Object3D } from "three";

//  A two-handed hold on the blaster, laid over whatever the clips did to
//  her upper body. Her spine turns her chest toward her right, the side the
//  camera looks over, so her right shoulder swings back and the gun beside
//  it shows from behind, to the right of her head and hair; her neck and
//  head turn back by as much, so she still looks along her aim, and her
//  hips and legs keep the clips. The right hand holds the grip with the
//  stock at her right shoulder, the left holds under the barrel, both arms
//  bent to reach there, and the barrel points along her aim, turned up or
//  down with it. Worked in the normalized rig's frame, where every bone
//  rests unturned: a VRM 0.x body faces negative z there and rests its
//  right arm along positive x, a VRM 1 body the other way round.

/** Radians her chest turns toward her right, shared across her spine. */
const bodyTwist = Math.PI / 4;
/** Where the grip sits from her right shoulder, and the barrel's
 *  underside from the grip, in metres along her aim: across to her right,
 *  up, and forward. */
const grip = { right: 0.18, up: 0.03, forward: 0.26 };
const foregrip = { right: -0.02, up: 0, forward: 0.26 };
/** Which way each elbow bends: out from her side and down. */
const elbowOut = 0.6;

/** The bones that share her chest's turn, hips up, and the ones that turn
 *  her head back. A rig may leave out the upper chest or the neck. */
const twistBones = [
    VRMHumanBoneName.Spine,
    VRMHumanBoneName.Chest,
    VRMHumanBoneName.UpperChest,
];
const counterBones = [VRMHumanBoneName.Neck, VRMHumanBoneName.Head];

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
const yawTurn = new Quaternion();
const leanTurn = new Quaternion();
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

interface PosedTurn {
    /** The bone's turn as the clips left it. */
    clip: Quaternion;
    /** The turn this pose last wrote over it. */
    posed: Quaternion;
}

/** Each turned bone's two turns, kept from one call to the next: the scene
 *  may draw more than once in a frame, and the clips write a bone again
 *  only once a frame, so a bone still holding the posed turn is turned
 *  from the clip's again rather than twice over. */
const posedTurns = new WeakMap<Object3D, PosedTurn>();

/** Puts back the clip's turn on `node` where the pose's is still on it. */
function restoreClipTurn(node: Object3D) {
    const turn = posedTurns.get(node);
    if (!turn) {
        posedTurns.set(node, {
            clip: node.quaternion.clone(),
            posed: new Quaternion(),
        });
        return;
    }
    if (node.quaternion.equals(turn.posed)) node.quaternion.copy(turn.clip);
    else turn.clip.copy(node.quaternion);
}

/** A turn of some bones: `angle` about the rig's up, and `lean` about its
 *  side, each shared among them. */
interface BoneTurn {
    bones: VRMHumanBoneName[];
    angle: number;
    lean?: number;
}

/** Turns each of `bones` the rig has by an equal share of `angle` about the
 *  rig's up and of `lean` about its side, on top of the clip's turn, so the
 *  last of them ends that far round from where the clip left it. */
function turnBones(vrm: VRM, { bones, angle, lean = 0 }: BoneTurn) {
    const { humanoid } = vrm;
    const root = humanoid.normalizedHumanBonesRoot;
    let count = 0;
    for (const bone of bones) if (humanoid.getNormalizedBoneNode(bone)) count++;
    if (count === 0) return;
    yawTurn.setFromAxisAngle(up, angle / count);
    if (lean !== 0)
        yawTurn.multiply(leanTurn.setFromAxisAngle(lateral, lean / count));
    for (const bone of bones) {
        const node = humanoid.getNormalizedBoneNode(bone);
        if (!node) continue;
        restoreClipTurn(node);
        //  The rig's up, seen from the bone's parent: the parent turned
        //  back, the turn, the parent again.
        measureParentTurn(node, root, parentTurn);
        node.quaternion.premultiply(
            inverse
                .copy(parentTurn)
                .invert()
                .multiply(yawTurn)
                .multiply(parentTurn),
        );
        posedTurns.get(node)?.posed.copy(node.quaternion);
    }
}

/** A point `place` names from `from`, along her aim, into `target`. */
function placePoint(from: Vector3, place: typeof grip, target: Vector3) {
    offset
        .copy(right)
        .multiplyScalar(place.right)
        .addScaledVector(up, place.up)
        .addScaledVector(forward, place.forward)
        .applyQuaternion(pitchTurn);
    return target.copy(from).add(offset);
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
    /** Radians her aim is above her body's level: toward her face, and
     *  below it toward her feet. */
    pitch: number;
    /** Radians her upper body leans forward from her hips, as a warden
     *  who lies down sits up to fire; none when left out. */
    lean?: number;
}

/** Lays the two-handed hold over her upper body. The caller then copies
 *  the rig to the skin and updates the upper body's matrices. */
export function holdBlaster(vrm: VRM, { pitch, lean = 0 }: AimHold) {
    const { humanoid } = vrm;
    const root = humanoid.normalizedHumanBonesRoot;
    const rightUpper = humanoid.getNormalizedBoneNode(rightBones.upper);
    const leftUpper = humanoid.getNormalizedBoneNode(leftBones.upper);
    if (!rightUpper || !leftUpper) return;
    const side = vrm.meta.metaVersion === "0" ? 1 : -1;
    right.set(side, 0, 0);
    forward.set(0, 0, -side);
    pitchTurn.setFromAxisAngle(lateral, side * pitch);
    //  A turn to her right is clockwise seen from above in either version;
    //  a lean forward turns her head toward the way she faces.
    turnBones(vrm, {
        bones: twistBones,
        angle: -bodyTwist,
        lean: -side * lean,
    });
    turnBones(vrm, { bones: counterBones, angle: bodyTwist });
    root.updateWorldMatrix(true, true);
    root.worldToLocal(rightUpper.getWorldPosition(rightShoulder));
    root.worldToLocal(leftUpper.getWorldPosition(leftShoulder));
    placePoint(rightShoulder, grip, gripAt);
    placePoint(gripAt, foregrip, foregripAt);
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
