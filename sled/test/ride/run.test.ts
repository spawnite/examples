// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    RoundState,
    RoundTrait,
    sendInput,
    startRound,
    stepSeconds,
    TrackMoverTrait,
    type HeadlessGame,
} from "@spawnite/engine/core";
import { levels } from "../../src/levels";
import {
    RunEnd,
    RunTrait,
    stallSeconds,
    stallSpeed,
} from "../../src/ride/course";
import { SlingTrait } from "../../src/ride/sling";
import { frames, layCourse, startRide } from "./rider";

//  The old RunDirector.test, on the engine's round: the run's phases are
//  the round's states, and a crash or a wipeout is the reason it failed.

const games: HeadlessGame[] = [];
afterEach(() => {
    for (const game of games.splice(0)) game.world.destroy();
});

const finishAt = levels[0].finish.at;

async function start() {
    const ride = await startRide();
    games.push(ride.game);
    const { game, rider } = ride;
    layCourse(game.world);
    const round = () => game.world.queryFirst(RoundTrait)?.get(RoundTrait);
    //  Held at `distance` and `speed`: disabled, so the step moves it not
    //  at all, and the course reads it where the test put it.
    const hold = (speed: number, distance = 20) =>
        rider.set(TrackMoverTrait, { enabled: false, speed, distance });
    return { ...ride, round, hold };
}

it("runs ready, then sliding from the sling's fire, then finished over the line", async () => {
    const { game, rider, round } = await start();
    stepSeconds(game, 1);
    expect(round()?.state).toBe(RoundState.Ready);

    sendInput(game, { jump: true });
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Playing);

    rider.set(TrackMoverTrait, { distance: finishAt + 0.5 });
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Won);
    expect(rider.get(TrackMoverTrait)).toMatchObject({
        enabled: false,
        speed: 0,
    });
});

it("starts only from the line, and only once", async () => {
    const { game, rider, round } = await start();
    startRound(game.world);
    rider.set(TrackMoverTrait, { enabled: true, distance: finishAt + 0.5 });
    stepSeconds(game, frames(1));
    startRound(game.world);
    expect(round()?.state).toBe(RoundState.Won);
});

//  A slab at 39 m, and a boulder at 60 m, 2 m left of the centre.
it("wipes out on the first touch of a boulder", async () => {
    const { game, rider, round } = await start();
    startRound(game.world);
    //  Off the sling, which would hold it on the start line's aim.
    rider.set(SlingTrait, { enabled: false });
    rider.set(TrackMoverTrait, { distance: 60, lateral: -2, speed: 8 });
    stepSeconds(game, frames(1));
    expect(round()).toMatchObject({
        state: RoundState.Lost,
        reason: RunEnd.Wiped,
    });
    expect(rider.get(TrackMoverTrait)?.enabled).toBe(false);
});

it("keeps sliding after one slab, and wipes out on a second hit inside the stun", async () => {
    const { game, round, hold } = await start();
    startRound(game.world);
    hold(8, 39);
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Playing);

    hold(8, 30);
    stepSeconds(game, frames(1));
    hold(8, 39);
    stepSeconds(game, frames(1));
    expect(round()).toMatchObject({
        state: RoundState.Lost,
        reason: RunEnd.Wiped,
    });
});

it("is not hit before the launch", async () => {
    const { game, rider, round } = await start();
    rider.set(SlingTrait, { enabled: false });
    rider.set(TrackMoverTrait, { distance: 60, lateral: -2, speed: 8 });
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Ready);
    expect(rider.get(RunTrait)?.stunSeconds).toBe(0);

    //  The same spot once the run is on wipes it out.
    startRound(game.world);
    rider.set(TrackMoverTrait, { distance: 50 });
    stepSeconds(game, frames(1));
    rider.set(TrackMoverTrait, { distance: 60 });
    stepSeconds(game, frames(1));
    expect(round()?.state).toBe(RoundState.Lost);
});

it("runs out of steam once slow for longer than the stall window, not at it", async () => {
    const { game, round, hold } = await start();
    startRound(game.world);
    hold(0);
    stepSeconds(game, stallSeconds);
    expect(round()?.state).toBe(RoundState.Playing);
    stepSeconds(game, 0.1);
    expect(round()).toMatchObject({
        state: RoundState.Lost,
        reason: RunEnd.Crashed,
    });
});

it("forgives a brief near-stop: a fast step starts the window again", async () => {
    const { game, round, hold } = await start();
    startRound(game.world);
    hold(0);
    stepSeconds(game, stallSeconds);
    hold(stallSpeed + 1);
    stepSeconds(game, frames(1));
    hold(0);
    stepSeconds(game, stallSeconds);
    expect(round()?.state).toBe(RoundState.Playing);
});

it("cannot stall before the launch or after the end", async () => {
    const ready = await start();
    ready.hold(0);
    stepSeconds(ready.game, 10);
    expect(ready.round()?.state).toBe(RoundState.Ready);

    const ended = await start();
    startRound(ended.game.world);
    ended.rider.set(TrackMoverTrait, { distance: finishAt + 0.5 });
    stepSeconds(ended.game, frames(1));
    ended.hold(0);
    stepSeconds(ended.game, 10);
    expect(ended.round()?.state).toBe(RoundState.Won);
});
