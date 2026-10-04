// @vitest-environment node
import { createElement } from "react";
import { createWorld, type World } from "koota";
import { afterEach, expect } from "vitest";
import { createSaveSession, type SaveSession } from "@spawnite/engine";
import { readStat, RoundState } from "@spawnite/engine/core";
import { it } from "@spawnite/engine/testing";
import { bankCoins, readBank } from "../src/bank";
import { Rider } from "../src/components/Rider";
import { plugins } from "../src/game";
import { buildRun, levelMaps, levels, Track } from "../src/levels";
import { RunTrait } from "../src/ride/course";
import { RideId, RiderId } from "../src/ride/riders";
import { readAimSpan } from "../src/ride/sling";
import { save } from "../src/save";
import { newProgress, readProgress, writeProgress } from "../src/shop";
import { rideToEnd } from "./ride/rider";

const worlds: ReturnType<typeof createWorld>[] = [];
afterEach(() => {
    for (const world of worlds.splice(0)) world.destroy();
});

/** A session on `world`, which the case's fixture owns, or on a world of
 *  its own. */
function openSession(world?: World) {
    if (!world) {
        world = createWorld();
        worlds.push(world);
    }
    const session = createSaveSession(world, {
        save,
        player: () => ({ id: "player" }),
    });
    return { world, session };
}

/** The record the session holds now, as a write would read it. */
function readRecord(session: SaveSession) {
    const read = session.read();
    if (!read?.ok) throw new Error("The save did not read.");
    return read.record;
}

//  What a player who has shopped holds.
const shopped = {
    step: 5,
    riders: [RiderId.Penguin, RiderId.Fox],
    rides: [RideId.Toboggan, RideId.Tin],
    rider: RiderId.Fox,
    ride: RideId.Tin,
};

it("restores the banked coins and what they bought from a save", () => {
    const first = openSession();
    first.session.load(null);
    bankCoins(first.world, 30);
    writeProgress(first.world, shopped);
    const record = JSON.parse(JSON.stringify(readRecord(first.session)));

    const next = openSession();
    expect(next.session.load(record)).toMatchObject({ ok: true });
    expect(readBank(next.world)).toBe(30);
    expect(readProgress(next.world)).toEqual(shopped);
    expect(readRecord(next.session)).toEqual(record);
});

it("banks nothing for a new game, and rides the penguin on the toboggan at no Speed step", () => {
    const { world, session } = openSession();
    session.load(null);
    expect(readBank(world)).toBe(0);
    expect(readProgress(world)).toEqual({
        step: 0,
        riders: [RiderId.Penguin],
        rides: [RideId.Toboggan],
        rider: RiderId.Penguin,
        ride: RideId.Toboggan,
    });
});

it("loads a save from before the shop with its bank and a new player's looks", () => {
    const { world, session } = openSession();
    const loaded = session.load({ game: { version: 1, state: { coins: 30 } } });
    expect(loaded).toMatchObject({ ok: true });
    expect(readBank(world)).toBe(30);
    expect(readProgress(world)).toEqual(newProgress);
});

it("refuses a save whose Speed step is past the last", () => {
    const { world, session } = openSession();
    const loaded = session.load({
        game: { version: 2, state: { coins: 0, ...shopped, step: 26 } },
    });
    expect(loaded).toMatchObject({ ok: false, key: "game" });
    expect(readProgress(world)).toEqual(newProgress);
});

it("spawns the run's rider at the saved Speed step", async ({
    createWorld,
    scene,
}) => {
    const { world, session } = openSession(createWorld(plugins).world);
    session.load({ game: { version: 2, state: { coins: 0, ...shopped } } });
    const level = levels[Track.Two];
    const { track } = buildRun(level.track.points, levelMaps[Track.Two]);
    await scene(
        () =>
            createElement(Rider, {
                track,
                aimSpan: readAimSpan(level.track.points),
            }),
        world,
    );
    const rider = world.queryFirst(RunTrait);
    if (!rider) throw new Error("The scene spawned no rider.");
    //  Step 5 of the curve, as setSpeedStep lays it.
    expect(readStat(rider, "drag")).toBeCloseTo(0.004 / 1.02 ** 10, 9);
    expect(readStat(rider, "downhill")).toBeCloseTo(1.02 ** 5, 9);
});

it("finishes track 2 on a clean full pull at the step track 1's coins buy, and stalls at none", async ({
    createGame,
}) => {
    const ride = (step: number) =>
        rideToEnd(createGame, {
            track: Track.Two,
            full: true,
            clear: true,
            step,
        });
    expect((await ride(shopped.step)).round?.state).toBe(RoundState.Won);
    expect((await ride(0)).round?.state).not.toBe(RoundState.Won);
});

it.each([
    { coins: -1, why: "negative" },
    { coins: 1.5, why: "fractional" },
])("refuses a save whose bank is $why", ({ coins }) => {
    const { world, session } = openSession();
    const loaded = session.load({ game: { version: 1, state: { coins } } });
    expect(loaded).toMatchObject({ ok: false, key: "game" });
    expect(readBank(world)).toBe(0);
});

it("declares the finished tracks", () => {
    expect(save.include).toEqual(["levels"]);
});
