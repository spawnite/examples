// @vitest-environment node
import { expect, expectTypeOf } from "vitest";
import type { LevelId } from "@spawnite/engine";
import {
    RoundState,
    RoundTrait,
    sendInput,
    stepSeconds,
    TrackMoverTrait,
} from "@spawnite/engine/core";
import { levels, type Track } from "../../src/levels";
import { frames, layCourse, startRide } from "../ride/rider";
import { it } from "@spawnite/engine/testing";

const tracks = Object.values(levels);

it("registers its tracks as the game's levels, so useLevels types each id", () => {
    expectTypeOf<LevelId>().toEqualTypeOf<(typeof Track)[keyof typeof Track]>();
});

it("lists twelve tracks by the ids the save keeps, with the old game's rocks and coins", () => {
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
        { id: "level-5", slabs: 0, rocks: 3, boulders: 0, coins: 16 },
        { id: "level-6", slabs: 0, rocks: 0, boulders: 4, coins: 10 },
        { id: "level-7", slabs: 1, rocks: 6, boulders: 1, coins: 26 },
        { id: "level-8", slabs: 0, rocks: 12, boulders: 1, coins: 60 },
        { id: "level-9", slabs: 0, rocks: 6, boulders: 14, coins: 35 },
        { id: "level-10", slabs: 1, rocks: 6, boulders: 12, coins: 35 },
        { id: "level-11", slabs: 0, rocks: 13, boulders: 6, coins: 52 },
        { id: "level-12", slabs: 4, rocks: 11, boulders: 6, coins: 59 },
    ]);
});

it.for(tracks)(
    "finishes $name over its line",
    async (level, { createGame }) => {
        const ride = await startRide(createGame, level);
        layCourse(ride);
        sendInput(ride.game, { jump: true });
        stepSeconds(ride.game, frames(1));

        ride.rider.set(TrackMoverTrait, { distance: level.finish.at + 0.5 });
        stepSeconds(ride.game, frames(1));

        expect(
            ride.game.world.queryFirst(RoundTrait)?.get(RoundTrait)?.state,
        ).toBe(RoundState.Won);
    },
);
