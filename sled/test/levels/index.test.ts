// @vitest-environment node
import { afterEach, expect, expectTypeOf, it } from "vitest";
import type { LevelId } from "@spawnite/engine";
import {
    RoundState,
    RoundTrait,
    sendInput,
    stepSeconds,
    TrackMoverTrait,
    type HeadlessGame,
} from "@spawnite/engine/core";
import { levels, type Track } from "../../src/levels";
import { frames, layCourse, startRide } from "../ride/rider";

const tracks = Object.values(levels);
const games: HeadlessGame[] = [];
afterEach(() => {
    for (const game of games.splice(0)) game.world.destroy();
});

it("registers its tracks as the game's levels, so useLevels types each id", () => {
    expectTypeOf<LevelId>().toEqualTypeOf<(typeof Track)[keyof typeof Track]>();
});

it("lists four tracks by the ids the save keeps, levels 2 to 4 with the old game's rocks and coins", () => {
    expect(
        Object.entries(levels).map(([id, { triggers }]) => ({
            id,
            slabs: triggers.slabs?.length ?? 0,
            rocks: triggers.rocks?.length ?? 0,
            boulders: triggers.boulders?.length ?? 0,
            coins: triggers.pickups?.length ?? 0,
        })),
    ).toEqual([
        { id: "level-1", slabs: 1, rocks: 0, boulders: 1, coins: 7 },
        { id: "level-2", slabs: 3, rocks: 0, boulders: 0, coins: 13 },
        { id: "level-3", slabs: 4, rocks: 0, boulders: 1, coins: 13 },
        { id: "level-4", slabs: 0, rocks: 1, boulders: 1, coins: 8 },
    ]);
});

it.each(tracks)("finishes $name over its line", async (level) => {
    const ride = await startRide(level);
    games.push(ride.game);
    layCourse(ride);
    sendInput(ride.game, { jump: true });
    stepSeconds(ride.game, frames(1));

    ride.rider.set(TrackMoverTrait, { distance: level.finish.at + 0.5 });
    stepSeconds(ride.game, frames(1));

    expect(ride.game.world.queryFirst(RoundTrait)?.get(RoundTrait)?.state).toBe(
        RoundState.Won,
    );
});
