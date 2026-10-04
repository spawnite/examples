// @vitest-environment node
import { Vector2 } from "three";
import { expect } from "vitest";
import { sendInput, stepSeconds, TrackMoverTrait } from "@spawnite/engine/core";
import { hitRider } from "../../src/ride/course";
import {
    addIdle,
    addTurn,
    createRiderPose,
    readRiderPose,
    RigTrait,
} from "../../src/ride/rig";
import { releaseSling } from "../../src/ride/sling";
import { frames, startRide } from "./rider";
import { it } from "@spawnite/engine/testing";

/** The impact pulse's decay a step: 7/s over a sixtieth of a second. */
const stepDecay = Math.exp(-7 / 60);

it("rises into a jump, stretched at takeoff and squashed on landing", async ({
    createGame,
}) => {
    const { game, rider } = await startRide(createGame);
    const rig = () => rider.get(RigTrait);
    const mover = () => rider.get(TrackMoverTrait);
    releaseSling(rider);
    rider.set(TrackMoverTrait, { speed: 10 });
    stepSeconds(game, frames(30));
    expect(rig()).toMatchObject({ air: 0, impact: 0 });

    sendInput(game, { jump: true });
    stepSeconds(game, frames(1));
    sendInput(game, { jump: false });
    expect(mover()?.height).toBeGreaterThan(0);
    //  Takeoff: the pulse is +1, a step decayed.
    expect(rig()?.impact).toBeCloseTo(stepDecay);

    stepSeconds(game, frames(10));
    expect(rig()?.impact).toBeCloseTo(stepDecay ** 11);
    //  The arms' rise ramps over the first 0.45 s in the air.
    expect(rig()?.air).toBeCloseTo((mover()?.airSeconds ?? 0) / 0.45);
    expect(rig()?.air).toBeGreaterThan(0);
    expect(rig()?.air).toBeLessThan(1);

    //  A metre's jump is half a second in the air: 0.47 s in, still up.
    stepSeconds(game, frames(18));
    expect(mover()?.height).toBeGreaterThan(0);
    expect(rig()?.air).toBe(1);

    //  Landing: the pulse turns to -1, and decays to nothing.
    let steps = 0;
    while ((mover()?.height ?? 0) > 0 && steps++ < 120)
        stepSeconds(game, frames(1));
    expect(mover()?.height).toBe(0);
    expect(rig()?.air).toBe(0);
    expect(rig()?.impact).toBeCloseTo(-stepDecay);
    stepSeconds(game, frames(30));
    expect(rig()?.impact).toBeCloseTo(-(stepDecay ** 31));
    game.world.destroy();
});

it("leans into a turn: the inside arm drops and swings back, the outside lifts, the head leads", async ({
    createGame,
}) => {
    const { game, rider } = await startRide(createGame);
    releaseSling(rider);
    sendInput(game, { intent: new Vector2(1, 0), steering: true });
    stepSeconds(game, frames(30));
    expect(rider.get(TrackMoverTrait)?.steer).toBe(1);

    const pose = readRiderPose(rider);
    //  Turning right, the right arm is the inside one.
    expect(pose.roll).toBeCloseTo(0.18);
    expect(pose.headYaw).toBeCloseTo(0.3);
    expect(pose.armLeft.open - pose.armRight.open).toBeCloseTo(0.9 + 0.35);
    expect(pose.armRight.back - pose.armLeft.back).toBeCloseTo(0.6);
    game.world.destroy();
});

it("tucks with speed and braces back on the sling", async ({ createGame }) => {
    const { game, rider } = await startRide(createGame);
    const { pitch: atRest } = readRiderPose(rider);
    expect(atRest).toBeCloseTo(0.06);

    //  A full pull leans the body back 0.25 rad.
    sendInput(game, { intent: new Vector2(0, -1) });
    stepSeconds(game, 3);
    sendInput(game, { intent: new Vector2(0, 0) });
    expect(readRiderPose(rider).pitch).toBeCloseTo(0.06 - 0.25, 2);

    //  At full speed, 18 m/s, the tuck is 0.06 + 0.22 rad.
    releaseSling(rider);
    rider.set(TrackMoverTrait, { enabled: false, speed: 18 });
    stepSeconds(game, 2);
    expect(rider.get(RigTrait)?.speed).toBeCloseTo(1);
    expect(readRiderPose(rider).pitch).toBeCloseTo(0.06 + 0.22);
    game.world.destroy();
});

it("flinches on a hit, and flails and wobbles while stunned", async ({
    createGame,
}) => {
    const { game, rider } = await startRide(createGame);
    releaseSling(rider);
    //  Held at a speed whose arms are fully spread, so only the hit moves
    //  them.
    rider.set(TrackMoverTrait, { enabled: false, speed: 10 });
    stepSeconds(game, 1);
    const before = readRiderPose(rider);

    hitRider(rider, false);
    stepSeconds(game, frames(1));
    //  A hard squash, decaying like a landing's.
    expect(rider.get(RigTrait)?.impact).toBeCloseTo(-1.4 * stepDecay);
    //  The arms fly up 1.1 rad and the head is thrown back 0.5, fading
    //  over the 0.8 s stun.
    const hit = readRiderPose(rider);
    expect(hit.armLeft.open - before.armLeft.open).toBeCloseTo(1.1, 1);
    expect(hit.armRight.open - before.armRight.open).toBeCloseTo(1.1, 1);
    expect(hit.headPitch - before.headPitch).toBeCloseTo(-0.5, 1);

    //  The flail is over with the stun.
    stepSeconds(game, 1);
    const after = readRiderPose(rider);
    expect(after.roll).toBe(0);
    expect(after.headPitch).toBeGreaterThan(before.headPitch - 0.1);
    game.world.destroy();
});

it("breathes and glances about while idle, and holds a glance before turning back", () => {
    const at = (seconds: number) => addIdle(createRiderPose(), seconds);
    //  A breath swells the body up and draws it in across, a few percent.
    expect(at(0.8).up).toBeCloseTo(1.025);
    expect(at(0.8).across).toBeCloseTo(0.9875);
    //  A quarter of the 7 s glance looks one way, three quarters the other,
    //  and the look is held most of the way through each half.
    expect(at(1.75).headYaw).toBeCloseTo(0.45, 2);
    expect(at(5.25).headYaw).toBeCloseTo(-0.45, 2);
    expect(at(1).headYaw).toBeGreaterThan(0.4);
});

it("turns once round on show in 0.6 s, eased, and ends facing as it began", () => {
    const at = (seconds: number) => addTurn(createRiderPose(), seconds).yaw;
    expect(at(-1)).toBe(0);
    expect(at(0)).toBe(0);
    //  Eased: slow off the mark, half round at half time, done at 0.6 s.
    expect(at(0.06)).toBeLessThan(0.1 * 2 * Math.PI);
    expect(at(0.3)).toBeCloseTo(Math.PI);
    expect(at(0.6)).toBeCloseTo(2 * Math.PI);
    expect(at(5)).toBeCloseTo(2 * Math.PI);
});
