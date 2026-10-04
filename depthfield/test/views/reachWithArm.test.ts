import { Bone, Group, Vector3 } from "three";
import { expect, it } from "vitest";
import { reachWithArm } from "../../src/views/reachWithArm";

//  An arm of two 0.3 m bones, held straight out along x, bends its elbow
//  so the hand lands where it is sent.

function buildArm() {
    const shoulder = new Bone();
    const elbow = new Bone();
    const hand = new Bone();
    elbow.position.set(0.3, 0, 0);
    hand.position.set(0.3, 0, 0);
    shoulder.add(elbow);
    elbow.add(hand);
    shoulder.updateMatrixWorld(true);
    return { shoulder, elbow, hand };
}

function readHand(hand: Bone) {
    return hand.getWorldPosition(new Vector3());
}

it("puts the hand on a point within reach", () => {
    const arm = buildArm();
    const target = new Vector3(0.2, 0.3, 0.1);
    reachWithArm({
        upper: arm.shoulder,
        lower: arm.elbow,
        hand: arm.hand,
        target: target,
        weight: 1,
    });
    expect(readHand(arm.hand).distanceTo(target)).toBeLessThan(1e-4);
});

it("reaches straight toward a point too far away", () => {
    const arm = buildArm();
    reachWithArm({
        upper: arm.shoulder,
        lower: arm.elbow,
        hand: arm.hand,
        target: new Vector3(0, 2, 0),
        weight: 1,
    });
    const hand = readHand(arm.hand);
    expect(hand.x).toBeCloseTo(0, 2);
    expect(hand.y).toBeGreaterThan(0.59);
});

it("leaves the arm as it was at no weight", () => {
    const arm = buildArm();
    reachWithArm({
        upper: arm.shoulder,
        lower: arm.elbow,
        hand: arm.hand,
        target: new Vector3(0, 0.4, 0),
        weight: 0,
    });
    expect(readHand(arm.hand).distanceTo(new Vector3(0.6, 0, 0))).toBeLessThan(
        1e-6,
    );
});

it("puts the hand on a point from an arm bent already", () => {
    const arm = buildArm();
    arm.elbow.rotation.set(0.4, 0.9, 0.3);
    arm.shoulder.updateMatrixWorld(true);
    const target = new Vector3(0.1, -0.25, 0.3);
    reachWithArm({
        upper: arm.shoulder,
        lower: arm.elbow,
        hand: arm.hand,
        target: target,
        weight: 1,
    });
    expect(readHand(arm.hand).distanceTo(target)).toBeLessThan(1e-4);
});

it("bends a straight arm toward a point along its own line", () => {
    const arm = buildArm();
    arm.elbow.position.set(0, 0, 0.3);
    arm.hand.position.set(0, 0, 0.3);
    arm.shoulder.updateMatrixWorld(true);
    const target = new Vector3(0, 0, 0.3);
    reachWithArm({
        upper: arm.shoulder,
        lower: arm.elbow,
        hand: arm.hand,
        target,
        weight: 1,
    });
    expect(readHand(arm.hand).distanceTo(target)).toBeLessThan(1e-4);
});

it("keeps the arm's size under a parent squashed on one axis", () => {
    const arm = buildArm();
    const body = new Group();
    body.scale.set(1.1, 0.88, 1.1);
    body.rotation.set(0.6, 0.4, 0);
    body.add(arm.shoulder);
    arm.shoulder.rotation.set(0.3, 0.7, 0.2);
    body.updateMatrixWorld(true);
    const target = new Vector3(0.1, 0.3, 0.2);
    reachWithArm({
        upper: arm.shoulder,
        lower: arm.elbow,
        hand: arm.hand,
        target,
        weight: 1,
    });
    //  A sheared parent stretches each bone by at most its scale, 0.88 to
    //  1.1, and leaves the solve a few centimetres out.
    const elbow = arm.elbow.getWorldPosition(new Vector3());
    const shoulder = arm.shoulder.getWorldPosition(new Vector3());
    expect(elbow.distanceTo(shoulder)).toBeGreaterThan(0.26);
    expect(elbow.distanceTo(shoulder)).toBeLessThan(0.34);
    expect(readHand(arm.hand).distanceTo(elbow)).toBeLessThan(0.34);
    expect(readHand(arm.hand).distanceTo(target)).toBeLessThan(0.08);
    //  Each bone's own turn stays a turn: one longer than 1 scales it.
    expect(arm.shoulder.quaternion.length()).toBeCloseTo(1, 6);
    expect(arm.elbow.quaternion.length()).toBeCloseTo(1, 6);
});

it("points the elbow along the pole and keeps the hand on its target", () => {
    const arm = buildArm();
    arm.elbow.rotation.set(0, 0, 0.6);
    arm.shoulder.updateMatrixWorld(true);
    const target = new Vector3(0.45, 0, 0);
    const pole = new Vector3(0, 0, -1);
    reachWithArm({
        upper: arm.shoulder,
        lower: arm.elbow,
        hand: arm.hand,
        target,
        weight: 1,
        pole,
    });
    expect(readHand(arm.hand).distanceTo(target)).toBeLessThan(1e-4);
    const elbow = arm.elbow.getWorldPosition(new Vector3());
    expect(elbow.z).toBeLessThan(-0.15);
    expect(Math.abs(elbow.y)).toBeLessThan(1e-4);
});
