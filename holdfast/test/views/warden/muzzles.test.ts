import { Group, Object3D, Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import {
    findMuzzle,
    findMuzzleAim,
    holdMuzzle,
    settleMuzzle,
} from "../../../src/views/warden/muzzles";

//  A warden's shot leaves the barrel of the gun her hold draws. Her hold is
//  laid over the clips just before each draw, and the engine's frame loop
//  poses her arm from the clips and updates its world matrices again before
//  the next draw, in whatever order the frame's callbacks run. So the
//  barrel's end a shot reads is where the last draw put it, in her place's
//  frame, whatever the clips did to her arm since.

const hue = 2;
let release: () => void = () => undefined;

afterEach(() => release());

/** Her place in the world, turned about the up axis, with an arm whose
 *  hand holds a gun whose barrel ends half a metre ahead of the hand. */
function holdGun() {
    const place = new Group();
    place.position.set(4, 0.5, -3);
    place.rotation.y = 0.6;
    const arm = new Object3D();
    arm.position.set(0.2, 1.3, 0);
    const muzzle = new Object3D();
    muzzle.position.set(0, 0, -0.5);
    place.add(arm);
    arm.add(muzzle);
    release = holdMuzzle(hue, muzzle);
    return { place, arm, muzzle };
}

/** Lays her hold over the arm and draws her: the hold's last step settles
 *  where her barrel ends. Returns the barrel's end as drawn. */
function drawHold({ place, arm, muzzle }: ReturnType<typeof holdGun>) {
    arm.rotation.set(0, 0, 0);
    place.updateMatrixWorld(true);
    settleMuzzle(hue, place);
    return new Vector3().setFromMatrixPosition(muzzle.matrixWorld);
}

/** Poses her arm as the clips hold it, hanging at her side, and updates
 *  its world matrices, as the engine's frame loop does before a draw. */
function poseClips({ place, arm }: ReturnType<typeof holdGun>) {
    arm.rotation.set(-Math.PI / 2, 0, 0.4);
    place.updateMatrixWorld(true);
}

it("reads the barrel where the hold drew it after the clips pose her arm", () => {
    const gun = holdGun();
    const drawn = drawHold(gun);
    poseClips(gun);

    const found = new Vector3();
    expect(findMuzzle(hue, found)).toBe(true);
    expect(found.distanceTo(drawn)).toBeLessThan(1e-6);
});

it("reads which way the barrel pointed where the hold drew it after the clips pose her arm", () => {
    const gun = holdGun();
    drawHold(gun);
    //  The barrel runs along the muzzle's -z: ahead of her place as drawn.
    const drawn = gun.muzzle.getWorldDirection(new Vector3()).negate();
    poseClips(gun);

    const found = new Vector3();
    expect(findMuzzleAim(hue, found)).toBe(true);
    expect(found.distanceTo(drawn)).toBeLessThan(1e-6);
});

it("carries the drawn barrel with her place as she moves and turns", () => {
    const gun = holdGun();
    drawHold(gun);
    const drawnInPlace = gun.place.worldToLocal(
        new Vector3().setFromMatrixPosition(gun.muzzle.matrixWorld),
    );
    //  Moved and turned since the draw, with no world matrix updated yet.
    gun.place.position.x += 1.5;
    gun.place.rotation.y += 0.3;

    const found = new Vector3();
    findMuzzle(hue, found);
    gun.place.updateMatrixWorld(true);
    const expected = gun.place.localToWorld(drawnInPlace.clone());
    expect(found.distanceTo(expected)).toBeLessThan(1e-6);
});

it("has no barrel to read before her hold has drawn once", () => {
    holdGun();

    expect(findMuzzle(hue, new Vector3())).toBe(false);
});

it("has no barrel to read once her gun is put away", () => {
    const gun = holdGun();
    drawHold(gun);
    release();

    expect(findMuzzle(hue, new Vector3())).toBe(false);
});
