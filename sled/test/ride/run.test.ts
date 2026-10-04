// @vitest-environment node
import { Vector2 } from "three";
import { expect } from "vitest";
import {
    RoundState,
    RoundTrait,
    sendInput,
    stepSeconds,
    TrackMoverTrait,
} from "@spawnite/engine/core";
import { levels, Track } from "../../src/levels";
import {
    hitRider,
    RunMachine,
    stallSeconds,
    stallSpeed,
} from "../../src/ride/course";
import {
    frames,
    launch,
    layCourse,
    rideToEnd,
    startRide,
    type RideOptions,
} from "./rider";
import { it, type CreateGame } from "@spawnite/engine/testing";

//  The old RunDirector.test, on the run's machine: the rider's run moves
//  from the sling to its end, and hands its end to the engine's round, a
//  crash or a wipeout as the reason it failed.

const finishAt = levels[Track.One].finish.at;

async function start(createGame: CreateGame) {
    const ride = await startRide(createGame);
    const { game, rider } = ride;
    layCourse(ride);
    const round = () => game.world.queryFirst(RoundTrait)?.get(RoundTrait);
    //  Held at `distance` and `speed`: disabled, so the step moves it not
    //  at all, and the course reads it where the test put it.
    const hold = (speed: number, distance = 20) =>
        rider.set(TrackMoverTrait, { enabled: false, speed, distance });
    const run = () => RunMachine.read(rider);
    return { ...ride, round, hold, run, launch: () => launch(ride) };
}

it("runs ready, then sliding from the sling's fire, then finished over the line", async ({
    createGame,
}) => {
    const { game, rider, round } = await start(createGame);
    stepSeconds(game, 1);
    expect(round()?.state).toBe(RoundState.Ready);

    sendInput(game, { jump: true });
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Playing);

    rider.set(TrackMoverTrait, { distance: finishAt + 0.5 });
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Won);
    expect(RunMachine.read(rider).value).toBe("finished");
});

it("starts only from the line, and only once", async ({ createGame }) => {
    const { game, rider, round, launch } = await start(createGame);
    launch();
    rider.set(TrackMoverTrait, { enabled: true, distance: finishAt + 0.5 });
    stepSeconds(game, frames(1));
    launch();
    expect(round()?.state).toBe(RoundState.Won);
});

//  A slab at 39 m, and a boulder at 60 m, 2 m left of the centre.
it("wipes out on the first touch of a boulder", async ({ createGame }) => {
    const { game, rider, round, launch } = await start(createGame);
    launch();
    rider.set(TrackMoverTrait, { distance: 60, lateral: -2, speed: 8 });
    stepSeconds(game, frames(1));
    expect(round()).toMatchObject({
        state: RoundState.Lost,
        reason: "wiped",
    });
    expect(rider.get(TrackMoverTrait)?.enabled).toBe(false);
});

it("keeps sliding after one slab, and wipes out on a second hit inside the stun", async ({
    createGame,
}) => {
    const { game, round, hold, launch } = await start(createGame);
    launch();
    hold(8, 39);
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Playing);

    hold(8, 30);
    stepSeconds(game, frames(1));
    hold(8, 39);
    stepSeconds(game, frames(1));
    expect(round()).toMatchObject({
        state: RoundState.Lost,
        reason: "wiped",
    });
});

it("is not hit before the launch", async ({ createGame }) => {
    const { game, rider, round, run, launch } = await start(createGame);
    //  The slab at 39 m, which the sling's aim down the middle meets.
    rider.set(TrackMoverTrait, { distance: 39, speed: 8 });
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Ready);
    expect(run().value).toBe("aiming");
    expect(rider.get(TrackMoverTrait)?.speed).toBe(8);

    //  The same spot once the run is on stuns it.
    launch();
    rider.set(TrackMoverTrait, { distance: 30 });
    stepSeconds(game, frames(1));
    rider.set(TrackMoverTrait, { distance: 39 });
    stepSeconds(game, frames(1));
    expect(run().value).toBe("stunned");
});

it("runs out of steam once slow for longer than the stall window, not at it", async ({
    createGame,
}) => {
    const { game, round, hold, launch } = await start(createGame);
    launch();
    hold(0);
    stepSeconds(game, stallSeconds);
    expect(round()?.state).toBe(RoundState.Playing);
    stepSeconds(game, 0.1);
    expect(round()).toMatchObject({
        state: RoundState.Lost,
        reason: "crashed",
    });
});

it("forgives a brief near-stop: a fast step starts the window again", async ({
    createGame,
}) => {
    const { game, round, hold, launch } = await start(createGame);
    launch();
    hold(0);
    stepSeconds(game, stallSeconds);
    hold(stallSpeed + 1);
    stepSeconds(game, frames(1));
    hold(0);
    stepSeconds(game, stallSeconds);
    expect(round()?.state).toBe(RoundState.Playing);
});

it("cannot stall before the launch or after the end", async ({
    createGame,
}) => {
    const ready = await start(createGame);
    ready.hold(0);
    stepSeconds(ready.game, 10);
    expect(ready.round()?.state).toBe(RoundState.Ready);

    const ended = await start(createGame);
    ended.launch();
    ended.rider.set(TrackMoverTrait, { distance: finishAt + 0.5 });
    stepSeconds(ended.game, frames(1));
    ended.hold(0);
    stepSeconds(ended.game, 10);
    expect(ended.round()?.state).toBe(RoundState.Won);
});

it("finishes over the line while stunned", async ({ createGame }) => {
    const { game, rider, round, run, launch } = await start(createGame);
    launch();
    hitRider(rider, false);
    expect(run().value).toBe("stunned");
    rider.set(TrackMoverTrait, { distance: finishAt + 0.5 });
    stepSeconds(game, frames(1));
    expect(run().value).toBe("finished");
    expect(round()?.state).toBe(RoundState.Won);
});

it("wipes out on a boulder while stunned", async ({ createGame }) => {
    const { game, rider, round, run, launch } = await start(createGame);
    launch();
    hitRider(rider, false);
    rider.set(TrackMoverTrait, { distance: 60, lateral: -2 });
    stepSeconds(game, frames(1));
    expect(run().value).toBe("wiped");
    expect(round()).toMatchObject({
        state: RoundState.Lost,
        reason: "wiped",
    });
});

it("counts the stall on through a stun", async ({ createGame }) => {
    const { game, rider, round, hold, run, launch } = await start(createGame);
    launch();
    hold(0);
    stepSeconds(game, 1);
    hitRider(rider, false);
    expect(run().value).toBe("stunned");

    stepSeconds(game, stallSeconds - 1);
    expect(round()?.state).toBe(RoundState.Playing);
    stepSeconds(game, frames(1));
    expect(round()).toMatchObject({
        state: RoundState.Lost,
        reason: "crashed",
    });
});

//  The step after the fire each run ends on, the metres it ends at, and the
//  round's clock. The bare Space stalls from 12.9 m, so the slab at 14.5 m
//  hits it well inside its stall, and the stun leaves the stall's count
//  running.
it.for<[string, RideOptions, number, number, RoundState, string, number]>([
    ["a full pull", { full: true }, 732, 66.073, RoundState.Won, "", 12.1833],
    ["a bare Space", {}, 228, 14.741, RoundState.Lost, "crashed", 3.7833],
    [
        "a slow rider hit during its stall",
        { slabAt: 14.5 },
        228,
        13.8379,
        RoundState.Lost,
        "crashed",
        3.7833,
    ],
])(
    "ends %s on the step and at the distance the ride has always timed",
    async (
        [, options, steps, distance, state, reason, elapsed],
        { createGame },
    ) => {
        const ended = await rideToEnd(createGame, options);
        expect(ended.steps).toBe(steps);
        expect(ended.end?.distance).toBeCloseTo(distance, 3);
        expect(ended.round).toMatchObject({ state, reason });
        expect(ended.round?.elapsed).toBeCloseTo(elapsed, 4);
    },
);

//  Past the line the track runs on about 16 m to its end, where the
//  finisher brakes to rest; a rider out of steam brakes to rest too.
it("brakes over the finish line to rest inside the run-out, its steer and jump let go", async ({
    createGame,
}) => {
    const { game, track, end, mover } = await rideToEnd(createGame, {
        full: true,
    });
    expect(end).toMatchObject({ enabled: true, lateral: 0 });
    expect(end?.speed).toBeCloseTo(12.35, 2);

    sendInput(game, { intent: new Vector2(1, 0), jump: true });
    stepSeconds(game, frames(10));
    expect(mover()).toMatchObject({ lateral: 0, height: 0 });
    expect(mover()?.distance).toBeGreaterThan(end?.distance ?? 0);

    let steps = 10;
    while (mover()?.enabled && steps < 600) {
        stepSeconds(game, frames(1));
        steps += 1;
    }
    const rest = mover();
    expect(rest).toMatchObject({ enabled: false, speed: 0 });
    expect((rest?.distance ?? 0) - finishAt).toBeCloseTo(10.73, 2);
    //  12.35 m/s over the line, to rest 10.73 m on in 1.77 s.
    expect(steps / 60).toBeCloseTo(1.77, 2);
    expect(rest?.distance).toBeLessThan(track.length);

    stepSeconds(game, 5);
    expect(mover()?.distance).toBe(rest?.distance);
});

it("slides on to rest out of steam, its steer and jump let go", async ({
    createGame,
}) => {
    const { game, end, mover } = await rideToEnd(createGame);
    expect(end).toMatchObject({ enabled: true, lateral: 0 });
    expect(end?.speed).toBeGreaterThan(0);

    sendInput(game, { intent: new Vector2(1, 0), jump: true });
    stepSeconds(game, frames(10));
    expect(mover()).toMatchObject({ lateral: 0, height: 0 });
    expect(mover()?.distance).toBeGreaterThan(end?.distance ?? 0);

    stepSeconds(game, 5);
    expect(mover()?.speed).toBe(0);
});

it("stays where it wiped out on a boulder", async ({ createGame }) => {
    const { game, rider, launch } = await start(createGame);
    launch();
    rider.set(TrackMoverTrait, {
        enabled: true,
        distance: 60,
        lateral: -2,
        speed: 8,
    });
    stepSeconds(game, frames(1));
    const wiped = rider.get(TrackMoverTrait);
    sendInput(game, { intent: new Vector2(1, 0), jump: true });
    stepSeconds(game, 1);
    expect(rider.get(TrackMoverTrait)).toMatchObject({
        enabled: false,
        speed: 0,
        distance: wiped?.distance,
        lateral: -2,
        height: 0,
    });
});

it("drops to the snow where it wiped out on a boulder at the top of a jump", async ({
    createGame,
}) => {
    const { game, rider, launch } = await start(createGame);
    launch();
    rider.set(TrackMoverTrait, {
        enabled: true,
        distance: 60,
        lateral: -2,
        speed: 8,
        height: 1,
        verticalSpeed: 0,
    });
    stepSeconds(game, frames(1));
    const wiped = rider.get(TrackMoverTrait);
    expect(wiped?.height).toBeGreaterThan(0.9);
    stepSeconds(game, 2);
    expect(rider.get(TrackMoverTrait)).toMatchObject({
        enabled: false,
        speed: 0,
        distance: wiped?.distance,
        height: 0,
    });
});
