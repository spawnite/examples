// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    RoundState,
    RoundTrait,
    startRound,
    stepSeconds,
    TrackMoverTrait,
    TrackRef,
    TrackTriggerTrait,
    Wallet,
    type HeadlessGame,
    type Track,
} from "@spawnite/engine/core";
import {
    CourseKind,
    CourseTrait,
    hitRider,
    readCourseRegion,
    readRiderVisible,
    RunEnd,
    RunTrait,
    stunSeconds,
    type CourseSpot,
} from "../../src/ride/course";
import { SlingTrait } from "../../src/ride/sling";
import { frames, startRide } from "./rider";

const games: HeadlessGame[] = [];
afterEach(() => {
    for (const game of games.splice(0)) game.world.destroy();
});

//  Level 1's rider, held still on the track so each step places it where
//  the test says, with a spot of the course laid in front of it.
async function start(kind: CourseKind, spot: CourseSpot) {
    const ride = await startRide();
    games.push(ride.game);
    const { game, rider, track } = ride;
    const placed = game.world.spawn(
        CourseTrait({ kind }),
        TrackTriggerTrait(readCourseRegion(kind, spot, track)),
        TrackRef({ track }),
    );
    const place = (
        mover: Partial<{ distance: number; lateral: number; height: number }>,
    ) => {
        rider.set(TrackMoverTrait, mover);
        stepSeconds(game, frames(1));
    };
    const speed = () => rider.get(TrackMoverTrait)?.speed;
    //  Past the sling, which would hold it on the start line's aim.
    rider.set(SlingTrait, { enabled: false });
    rider.set(TrackMoverTrait, { speed: 8 });
    startRound(game.world);
    const round = () => game.world.queryFirst(RoundTrait)?.get(RoundTrait);
    return { game, rider, track, placed, place, speed, round };
}

//  Old Obstacle.test: only entering is a hit, so one rock is one hit
//  however many steps the sled sits in it.
it("hits on entry, not every step inside, and again on re-entry", async () => {
    const { game, place, speed } = await start(CourseKind.Slab, {
        at: 40,
        side: 0,
    });
    place({ distance: 30 });
    expect(speed()).toBe(8);
    place({ distance: 40 });
    place({ distance: 40 });
    place({ distance: 40 });
    //  A hit halves the speed, once.
    expect(speed()).toBe(4);
    place({ distance: 60 });
    stepSeconds(game, 1);
    place({ distance: 40 });
    expect(speed()).toBe(2);
});

//  A second rider, held still where the test places it.
function spawnRider(game: HeadlessGame, track: Track) {
    return game.world.spawn(
        TrackMoverTrait({ speed: 8, enabled: false }),
        TrackRef({ track }),
        RunTrait,
        Wallet,
    );
}

it("hits a second rider entering a rock the first stands in", async () => {
    const { game, track, place, speed } = await start(CourseKind.Slab, {
        at: 40,
        side: 0,
    });
    const second = spawnRider(game, track);
    place({ distance: 40 });
    second.set(TrackMoverTrait, { distance: 40 });
    stepSeconds(game, frames(1));
    expect(speed()).toBe(4);
    expect(second.get(TrackMoverTrait)?.speed).toBe(4);
});

it("pays a coin to the rider that enters it", async () => {
    const { game, rider, track, placed } = await start(CourseKind.Coin, {
        at: 50,
        side: 0,
    });
    const second = spawnRider(game, track);
    second.set(TrackMoverTrait, { distance: 50 });
    stepSeconds(game, frames(1));
    expect(second.get(Wallet)?.coins).toBe(1);
    expect(rider.get(Wallet)?.coins).toBe(0);
    expect(placed.isAlive()).toBe(false);
});

it("is cleared by a jump, and a boulder wipes the run out", async () => {
    const slab = await start(CourseKind.Slab, { at: 40, side: 0 });
    slab.place({ distance: 40, height: 2 });
    expect(slab.speed()).toBe(8);

    const boulder = await start(CourseKind.Boulder, { at: 40, side: 0 });
    boulder.place({ distance: 40, height: 2 });
    expect(boulder.round()).toMatchObject({
        state: RoundState.Lost,
        reason: RunEnd.Wiped,
    });
    expect(boulder.rider.get(TrackMoverTrait)?.enabled).toBe(false);
});

//  Old Stun.test.
it("stuns on a hit, lets go on its own, and a second hit inside wipes out", async () => {
    const { game, rider } = await start(CourseKind.Finish, {
        at: 70,
        side: 0,
    });
    expect(hitRider(rider, false)).toBe(false);
    expect(rider.get(RunTrait)?.stunSeconds).toBe(stunSeconds);
    stepSeconds(game, stunSeconds + 0.1);
    expect(rider.get(RunTrait)?.stunSeconds).toBe(0);

    hitRider(rider, false);
    stepSeconds(game, frames(1));
    expect(hitRider(rider, false)).toBe(true);
});

it("blinks the rider while stunned and leaves it drawn after", () => {
    const seen = new Set<boolean>();
    for (let left = stunSeconds; left > 0; left -= frames(1))
        seen.add(readRiderVisible(left));
    expect(seen).toEqual(new Set([true, false]));
    expect(readRiderVisible(0)).toBe(true);
});

//  Old Coin.test: a coin lifted 1.2 m over a rock pays only the jump.
const lifted = { at: 50, side: 1.5, lift: 1.2 };

it("misses a lifted coin from the snow", async () => {
    const { rider, place } = await start(CourseKind.Coin, lifted);
    place({ distance: 50, lateral: 1.5 });
    expect(rider.get(Wallet)?.coins).toBe(0);
});

it("takes a lifted coin at the apex, once", async () => {
    const { rider, place, placed } = await start(CourseKind.Coin, lifted);
    place({ distance: 50, lateral: 1.5, height: 1 });
    place({ distance: 50, lateral: 1.5, height: 1 });
    expect(rider.get(Wallet)?.coins).toBe(1);
    expect(placed.isAlive()).toBe(false);
});

it("takes a coin on the snow and leaves the world", async () => {
    const { rider, place, placed } = await start(CourseKind.Coin, {
        at: 50,
        side: 0,
    });
    place({ distance: 50 });
    expect(rider.get(Wallet)?.coins).toBe(1);
    expect(placed.isAlive()).toBe(false);
});

it("finishes the run across the gate, and stops the sled", async () => {
    const { rider, place, round } = await start(CourseKind.Finish, {
        at: 66,
        side: 0,
    });
    rider.set(TrackMoverTrait, { enabled: true });
    place({ distance: 67, lateral: -5 });
    expect(round()?.state).toBe(RoundState.Won);
    expect(rider.get(TrackMoverTrait)?.enabled).toBe(false);
});
