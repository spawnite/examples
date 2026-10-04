import { Group, Object3D, Quaternion, Vector3 } from "three";
import { expect, it } from "vitest";
import {
    layBody,
    measureGround,
    readChestRise,
    readHeadRise,
} from "../../../src/views/warden/lying";

//  A downed warden lies on her back along the ground where she fell, her
//  feet toward her aim: on a hillside her body tilts with the slope rather
//  than sinking into it. Her place faces negative z, as a hero does.

/** Ground rising `rise` metres for each metre toward positive z, and
 *  `across` for each toward positive x. */
function slope(rise: number, across = 0) {
    return {
        getPointAt(position: Pick<Vector3, "x" | "z">, target: Vector3) {
            return target.set(
                position.x,
                2 + position.z * rise + position.x * across,
                position.z,
            );
        },
    };
}

/** Her place in the world: at the origin of `ground`, turned `yaw` about
 *  the up axis, with a body inside it at its rest turn. */
function placeWarden(ground: ReturnType<typeof slope>, yaw = 0) {
    const frame = new Group();
    frame.position.copy(ground.getPointAt(new Vector3(), new Vector3()));
    frame.rotation.y = yaw;
    const body = new Object3D();
    body.rotation.y = Math.PI;
    frame.add(body);
    frame.updateMatrixWorld(true);
    return { frame, body, rest: body.quaternion.clone() };
}

const up = new Vector3(0, 1, 0);
const measured = { normal: new Vector3(), lift: 0 };

/** Where her head and chest point once laid, in her place's frame. */
function readBody(body: Object3D) {
    const turn = body.quaternion
        .clone()
        .multiply(new Quaternion().setFromAxisAngle(up, -Math.PI));
    return {
        head: new Vector3(0, 1, 0).applyQuaternion(turn),
        chest: new Vector3(0, 0, -1).applyQuaternion(turn),
    };
}

it("lays her flat on her back on flat ground, her head away from her aim", () => {
    const ground = slope(0);
    const { frame, body, rest } = placeWarden(ground);
    measureGround(ground, frame, measured);

    layBody(body, { rest, ground: measured, down: 1 });

    const { head, chest } = readBody(body);
    expect(head.z).toBeCloseTo(1);
    expect(chest.y).toBeCloseTo(1);
    expect(body.position.y).toBeCloseTo(0.2);
    expect(readChestRise(body, rest)).toBeCloseTo(Math.PI / 2);
    expect(readHeadRise(body, rest)).toBeCloseTo(0);
});

it("tilts her with a hillside that rises behind her, her body along it rather than into it", () => {
    //  A 30% slope, rising toward her head.
    const ground = slope(0.3);
    const { frame, body, rest } = placeWarden(ground);
    measureGround(ground, frame, measured);

    layBody(body, { rest, ground: measured, down: 1 });

    const normal = new Vector3(0, 1, -0.3).normalize();
    const { head, chest } = readBody(body);
    expect(head.dot(normal)).toBeCloseTo(0);
    expect(chest.dot(normal)).toBeCloseTo(1);
    //  Her head rises with the slope, and her chest leans toward her
    //  feet by as much, so level is that much nearer her chest.
    expect(readHeadRise(body, rest)).toBeCloseTo(Math.atan(0.3));
    expect(readChestRise(body, rest)).toBeCloseTo(Math.PI / 2 - Math.atan(0.3));
});

it("reads the slope in her own frame, whichever way she faces, across it too", () => {
    //  The ground rises toward positive x in the world; she faces the
    //  other way, so it rises toward her head, and a little across her.
    const ground = slope(0.1, 0.4);
    const { frame, body, rest } = placeWarden(ground, Math.PI / 2);
    measureGround(ground, frame, measured);

    layBody(body, { rest, ground: measured, down: 1 });

    const worldNormal = new Vector3(-0.4, 1, -0.1).normalize();
    const localNormal = worldNormal
        .clone()
        .applyQuaternion(frame.quaternion.clone().invert());
    expect(measured.normal.dot(localNormal)).toBeCloseTo(1);
    const { chest } = readBody(body);
    expect(chest.dot(localNormal)).toBeCloseTo(1);
    expect(readHeadRise(body, rest)).toBeGreaterThan(0.3);
});

it("stands her at her rest turn when she is up, whatever the slope", () => {
    const ground = slope(0.3, 0.2);
    const { frame, body, rest } = placeWarden(ground);
    measureGround(ground, frame, measured);

    layBody(body, { rest, ground: measured, down: 0 });

    expect(body.quaternion.angleTo(rest)).toBeCloseTo(0);
    expect(body.position.y).toBeCloseTo(0);
    expect(readChestRise(body, rest)).toBeCloseTo(0);
    expect(readHeadRise(body, rest)).toBeCloseTo(Math.PI / 2);
});
