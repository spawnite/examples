import { Matrix4, Quaternion, Vector3, type Bone, type Object3D } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { WeaponId } from "../rules/data";
import { gunLooks, soldierScale } from "./models";
import {
    reachWithArm,
    setWorldTurn,
    turnInWorld,
    type ArmReach,
} from "./reachWithArm";

//  The soldier's two-hand hold on its gun, which the field and the lobby
//  share: the gun in a low ready, its muzzle dipped across the body, or
//  raised with its stock in the right shoulder; the right hand round its
//  pistol grip and the left under its fore grip, each grip measured on the
//  gun in `gunLooks`.
//
//  The rig's hand bones, read from soldier.glb, run +y from the wrist
//  along the fingers with +z out of the palm; the thumb is on the right
//  hand's +x and the left hand's -x. The rig has no finger bones, so each
//  glove is sculpted as a fist closed round a hole its grip passes through.

/** Where the butt of the stock sits, in the soldier's own metres (+z
 *  ahead, -x to its right, up from its feet): against the right hip in
 *  the low ready, in the right shoulder's pocket raised. */
const lowButt = new Vector3(-0.16, 0.52, 0.04);
const readyButt = new Vector3(-0.14, 0.7, 0.06);
/** Radians the muzzle dips below level in the low ready. */
const lowDip = 0.45;
/** Radians the barrel turns in toward the soldier's left, across its
 *  body: well across in the low ready, a little raised, where the cheek
 *  meets the stock. */
const lowCant = 0.4;
const readyCant = 0.12;
/** Radians the chest stands turned to the soldier's right of the way the
 *  gun points, bladed as a shooter stands, which brings the left shoulder
 *  toward the fore grip. */
const bladeRadians = 0.3;
/** Radians the left collarbone swings forward, reaching the left arm
 *  toward the fore grip. */
const collarRadians = 0.45;
/** The share of each arm's length a hand reaches to: past it, the gun
 *  slides back along its line until the hand reaches. */
const reachShare = 0.94;
/** The hole each fist closes round, in its hand bone's own units: its
 *  middle, and its axis, toward the thumb on the right hand and the little
 *  finger on the left; 0.015 in radius. Measured on soldier.glb's gloves
 *  as the sculpt that closed them into fists wrote them, in its hole.json. */
const rightHole = new Vector3(0.0124, 0.094, 0.0359);
const rightHoleAxis = new Vector3(0.964, 0.0502, -0.2611);
const leftHole = new Vector3(-0.014, 0.089, 0.0328);
const leftHoleAxis = new Vector3(0.9726, -0.0828, 0.2173);
/** Radians a pistol grip rakes back from square to the barrel: the right
 *  fist's hole runs up it, from its foot to the bore. */
const rightGripRake = 0.45;
/** How far the left palm turns in, under the fore grip: 0 faces it up,
 *  1 faces it across to the gun's right. */
const leftPalmIn = 0.25;
/** The share of a hand's twist about the forearm the forearm takes, the
 *  wrist the rest: all of it in the forearm pinches the sleeve. */
const forearmTwistShare = 0.5;
/** Where each elbow points, in the soldier's axes: the right out and
 *  down, the left down and a little out, under the gun. */
const rightElbow = new Vector3(-1, -1.2, -0.3);
const leftElbow = new Vector3(0.35, -1, 0);
/** How long a shot's kick lasts, and how far it moves the gun and rocks
 *  the chest at a kick of 1. */
const kickSeconds = 0.16;
const gunKickMetres = 0.12;
const gunKickRadians = 0.35;
const chestKickRadians = 0.4;

/** The axes whose x is `axis` and whose z is `palm` squared to it. */
function readAxes(axis: Vector3, palm: Vector3) {
    const x = axis.clone().normalize();
    const z = palm.clone().addScaledVector(x, -palm.dot(x)).normalize();
    return new Matrix4().makeBasis(x, new Vector3().crossVectors(z, x), z);
}

/** A hand's hold on a grip: the hand bone's turn in the gun's axes, and
 *  the middle of its fist's hole, which sits on the grip. */
interface GripHold {
    turn: Quaternion;
    hole: Vector3;
}

interface GripHoldOptions {
    /** The middle of the fist's hole, in the hand bone's axes. */
    hole: Vector3;
    /** The way the hole runs, in the hand bone's axes. */
    holeAxis: Vector3;
    /** The way the grip runs, in the gun's axes. */
    grip: Vector3;
    /** The way the palm faces, in the gun's axes, as near as the grip lets
     *  it. */
    palm: Vector3;
}

/** The hold that lays a fist's hole along its grip. */
function readGripHold({
    hole,
    holeAxis,
    grip,
    palm,
}: GripHoldOptions): GripHold {
    const inHand = readAxes(holeAxis, new Vector3(0, 0, 1));
    const inGun = readAxes(grip, palm);
    return {
        turn: new Quaternion().setFromRotationMatrix(
            inGun.multiply(inHand.transpose()),
        ),
        hole,
    };
}

/** The right fist's hole runs up the pistol grip, the thumb over the top,
 *  and its palm faces the gun's left, +x, round the grip from its right. */
const rightHold = readGripHold({
    hole: rightHole,
    holeAxis: rightHoleAxis,
    grip: new Vector3(0, Math.cos(rightGripRake), Math.sin(rightGripRake)),
    palm: new Vector3(1, 0, 0),
});
/** The left fist's hole runs along the fore grip, the little finger
 *  toward the stock and the thumb toward the muzzle, and its palm faces up
 *  under it, turned in. */
const leftHold = readGripHold({
    hole: leftHole,
    holeAxis: leftHoleAxis,
    grip: new Vector3(0, 0, -1),
    palm: new Vector3(-leftPalmIn, 1, 0),
});

//  Written in place on each call.
const butt = new Vector3();
const shoulderSpot = new Vector3();
const grip = new Vector3();
const palm = new Vector3();
const toWrist = new Vector3();
const forward = new Vector3();
const chestFront = new Vector3();
const slide = new Vector3();
const axis = new Vector3();
const xAxis = new Vector3(1, 0, 0);
const yAxis = new Vector3(0, 1, 0);
const rootTurn = new Quaternion();
const gunTurn = new Quaternion();
const turn = new Quaternion();
const handTurn = new Quaternion();
const handNow = new Quaternion();
const rightHandTurn = new Quaternion();
const leftHandTurn = new Quaternion();
const scale = new Vector3();

/** A posed body that holds a gun: its root, its chest, its left
 *  collarbone, its arms, and how far an arm reaches, in metres. */
export interface HoldingBody {
    root: Object3D;
    chest: Bone;
    leftCollar: Bone;
    rightArm: ArmReach;
    leftArm: ArmReach;
    armLength: number;
}

/** The bones of the soldier's rig a hold moves, each found by `find`. */
export function readHoldingBody(
    root: Object3D,
    find: (name: string) => Bone | undefined,
    armLength: number,
): HoldingBody {
    const findBone = (name: string) => {
        const found = find(name);
        if (!found) throw new Error(`The soldier's rig has no ${name}.`);
        return found;
    };
    const readArm = (side: string) => ({
        upper: findBone(`${side}Arm`),
        lower: findBone(`${side}ForeArm`),
        hand: findBone(`${side}Hand`),
        target: new Vector3(),
        weight: 0,
        pole: new Vector3(),
    });
    return {
        root,
        chest: findBone("Spine01"),
        leftCollar: findBone("LeftShoulder"),
        rightArm: readArm("Right"),
        leftArm: readArm("Left"),
        armLength,
    };
}

/** How far the soldier's right arm reaches from its shoulder, in metres,
 *  at rest with its rig scaled by `scale`. */
export function measureArmLength(scene: Object3D, scale: number) {
    const copy = clone(scene);
    copy.scale.setScalar(scale);
    copy.updateMatrixWorld(true);
    const [shoulder, elbow, wrist] = [
        "RightArm",
        "RightForeArm",
        "RightHand",
    ].map((name) => {
        const bone = copy.getObjectByName(name);
        if (!bone) throw new Error(`The soldier's rig has no ${name}.`);
        return bone.getWorldPosition(new Vector3());
    });
    return shoulder.distanceTo(elbow) + elbow.distanceTo(wrist);
}

/** How hard `weapon`'s shot kicks the soldier `age` seconds after it, from
 *  its gun's full kick at once to 0 when the kick is over. */
export function readGunKick(weapon: WeaponId, age: number) {
    if (age >= kickSeconds) return 0;
    return gunLooks[weapon].kick * (1 - age / kickSeconds) ** 2;
}

export interface HoldGunOptions {
    body: HoldingBody;
    /** The gun, one unit long and scaled to its length, under a parent
     *  whose axes `facing` is in. */
    gun: Object3D;
    weapon: WeaponId;
    /** How far it is raised, from 0 at the low ready to 1 at the shoulder. */
    ready: number;
    /** How much the hands hold it, from 0 to 1: at 0 it rides the right
     *  hand where the pose puts it, as in a roll. */
    held: number;
    /** The turn its barrel points along when raised, in its parent's axes. */
    facing: Quaternion;
    /** A shot's kick, from 0 to 1: the chest rocks back, and the gun slides
     *  back and lifts. */
    kick: number;
}

/** Writes into `arm`'s target where its wrist goes to hold `gun`'s grip at
 *  `gripSpot` with its fist's hole on it, held as `hold` says, and into
 *  `handWorldTurn` that hand's turn in world space; returns the way from
 *  its shoulder to that wrist, in scratch the next call overwrites. */
function placeWrist(
    arm: ArmReach,
    gun: Object3D,
    gripSpot: Vector3,
    hold: GripHold,
    handWorldTurn: Quaternion,
    rigScale: number,
) {
    gun.localToWorld(grip.copy(gripSpot));
    handWorldTurn.copy(gunTurn).multiply(hold.turn);
    palm.copy(hold.hole)
        .multiplyScalar(rigScale)
        .applyQuaternion(handWorldTurn);
    arm.target.subVectors(grip, palm);
    arm.upper.getWorldPosition(shoulderSpot);
    return toWrist.subVectors(arm.target, shoulderSpot);
}

/** Turns the hand of `arm` to `worldTurn` by `weight`, the forearm taking
 *  the twist about its own length so the wrist does not wring. */
function turnHand(arm: ArmReach, worldTurn: Quaternion, weight: number) {
    const { lower, hand } = arm;
    hand.getWorldQuaternion(handNow).normalize();
    turn.copy(worldTurn).multiply(handNow.invert());
    hand.getWorldPosition(axis).sub(lower.getWorldPosition(grip)).normalize();
    const along = turn.x * axis.x + turn.y * axis.y + turn.z * axis.z;
    turn.set(axis.x * along, axis.y * along, axis.z * along, turn.w);
    if (turn.lengthSq() > 1e-10) {
        turn.normalize().slerp(
            handNow.identity(),
            1 - weight * forearmTwistShare,
        );
        turnInWorld(lower, turn);
    }
    hand.getWorldQuaternion(handNow).normalize();
    setWorldTurn(hand, handTurn.copy(handNow).slerp(worldTurn, weight));
    hand.updateMatrixWorld(true);
}

/** Puts `gun` in `body`'s hands, low or raised along `facing`, and bends
 *  both arms so the hands close on its grips. */
export function holdGunInHands({
    body,
    gun,
    weapon,
    ready,
    held,
    facing,
    kick,
}: HoldGunOptions) {
    const { root, chest, leftCollar, rightArm, leftArm, armLength } = body;
    const space = gun.parent;
    if (!space) return;
    const look = gunLooks[weapon];
    root.getWorldQuaternion(rootTurn).normalize();
    root.getWorldScale(scale);

    //  The chest turns to face the gun's way, bladed to the right, whatever
    //  twist the clip gave it, as an aim offset holds a spine; it rocks back
    //  with a shot's kick, and the left collarbone reaches forward.
    axis.copy(yAxis).applyQuaternion(rootTurn);
    chest.getWorldQuaternion(turn).normalize();
    chestFront.set(0, 0, 1).applyQuaternion(turn);
    chestFront.addScaledVector(axis, -chestFront.dot(axis));
    forward.set(0, 0, 1).applyQuaternion(rootTurn);
    const twist = Math.atan2(
        slide.crossVectors(chestFront, forward).dot(axis),
        chestFront.dot(forward),
    );
    turnInWorld(
        chest,
        turn.setFromAxisAngle(axis, (twist - bladeRadians) * held),
    );
    turnInWorld(leftCollar, turn.setFromAxisAngle(axis, -collarRadians * held));
    if (kick > 0) {
        axis.copy(xAxis).applyQuaternion(rootTurn);
        turnInWorld(
            chest,
            turn.setFromAxisAngle(axis, -kick * chestKickRadians),
        );
    }

    //  The gun: its butt at the hip or the shoulder, its barrel dipped and
    //  turned across the body as it lowers, lifted by the kick.
    gun.quaternion
        .copy(facing)
        .multiply(
            turn.setFromAxisAngle(
                yAxis,
                lowCant + (readyCant - lowCant) * ready,
            ),
        )
        .multiply(
            turn.setFromAxisAngle(
                xAxis,
                lowDip * (1 - ready) - kick * gunKickRadians,
            ),
        );
    forward.set(0, 0, 1).applyQuaternion(gun.quaternion);
    butt.lerpVectors(lowButt, readyButt, ready).divideScalar(soldierScale);
    root.localToWorld(butt);
    space.worldToLocal(butt);
    gun.position.copy(butt).addScaledVector(forward, -kick * gunKickMetres);
    gun.updateMatrixWorld();
    gun.getWorldQuaternion(gunTurn).normalize();

    //  Out of the right hand's reach, as a shooting clip swings the right
    //  shoulder back, the gun comes toward that shoulder; out of the left
    //  hand's, it slides back along its line.
    const reach = armLength * reachShare;
    const rightWrist = placeWrist(
        rightArm,
        gun,
        look.rearGrip,
        rightHold,
        rightHandTurn,
        scale.x,
    );
    const short = rightWrist.length() - reach;
    if (short > 0) {
        slide.copy(rightWrist).setLength(-short);
        space.worldToLocal(slide.add(space.getWorldPosition(grip)));
        gun.position.add(slide);
        gun.updateMatrixWorld();
    }
    const leftWrist = placeWrist(
        leftArm,
        gun,
        look.foreGrip,
        leftHold,
        leftHandTurn,
        scale.x,
    );
    const over = leftWrist.length() - reach;
    if (over > 0) {
        slide.copy(forward).transformDirection(space.matrixWorld);
        const along = Math.max(0.3, leftWrist.normalize().dot(slide));
        gun.position.addScaledVector(forward, -over / along);
        gun.updateMatrixWorld();
        placeWrist(
            leftArm,
            gun,
            look.foreGrip,
            leftHold,
            leftHandTurn,
            scale.x,
        );
    }
    placeWrist(rightArm, gun, look.rearGrip, rightHold, rightHandTurn, scale.x);

    //  In a roll the gun rides the right hand where the pose puts it.
    if (held < 1) {
        rightArm.hand.getWorldPosition(slide).sub(rightArm.target);
        space.worldToLocal(slide.add(space.getWorldPosition(grip)));
        gun.position.addScaledVector(slide, 1 - held);
        gun.updateMatrixWorld();
    }

    rightArm.pole?.copy(rightElbow).applyQuaternion(rootTurn);
    leftArm.pole?.copy(leftElbow).applyQuaternion(rootTurn);
    rightArm.weight = held;
    leftArm.weight = held;
    reachWithArm(rightArm);
    reachWithArm(leftArm);
    turnHand(rightArm, rightHandTurn, held);
    turnHand(leftArm, leftHandTurn, held);
}

/** How far each wrist of `body` stands from where its grip wants it, in
 *  metres: about 0 when the hand holds its grip. */
export function readHandMiss({ rightArm, leftArm }: HoldingBody) {
    return {
        right: rightArm.hand
            .getWorldPosition(new Vector3())
            .distanceTo(rightArm.target),
        left: leftArm.hand
            .getWorldPosition(new Vector3())
            .distanceTo(leftArm.target),
    };
}
