// @vitest-environment node
import { afterAll, expect } from "vitest";
import { RoundState, stepSeconds } from "@spawnite/engine/core";
import { levels, levelSpeedSteps } from "../../src/levels";
import { speedSteps } from "../../src/ride/speed";
import { rideToEnd } from "../ride/rider";
import { it, type CreateGame } from "@spawnite/engine/testing";
import type { LevelId } from "@spawnite/engine";

//  Each track is tuned to the Speed curve: a full pull finishes it at the
//  step its coins expect, and runs out of steam three steps below. The
//  line is a clean one, every rock left out and the rider down the middle,
//  because the slope is the subject here and the steering is not.

/** Steps below the expected one at which a track stalls. */
const stallBelow = 3;
/** Steps above the expected one whose finish must still brake to rest
 *  inside the run-out. */
const restAbove = 5;

/** A clean full pull on track `id` at Speed `step`, to the end of its
 *  round and then on to rest. */
async function rideClean(createGame: CreateGame, id: LevelId, step: number) {
    const ride = await rideToEnd(createGame, {
        track: id,
        full: true,
        clear: true,
        step,
    });
    stepSeconds(ride.game, 5);
    return { ...ride, rest: ride.mover() };
}

//  The finish and stall table, printed once every track has ridden.
const rows: string[] = [];
afterAll(() => {
    console.log(
        [
            "| Track | Expected step | Finish speed at it | Stalls 3 below at | Rests past the line 5 above |",
            "| --- | --- | --- | --- | --- |",
            ...rows,
        ].join("\n"),
    );
});

it.for(
    Object.entries(levels).map(([id, { name }]) => ({
        //  `entries` keys by string; the keys are `levels`' own ids.
        id: id as LevelId,
        name,
    })),
)(
    "finishes $name at its expected Speed step, runs out of steam three below, and rests inside the run-out five above",
    async ({ id, name }, { createGame }) => {
        const expected = levelSpeedSteps[id];
        const finish = levels[id].finish.at;
        const at = await rideClean(createGame, id, expected);
        //  The first track expects no step, so nothing below it can stall.
        const below =
            expected >= stallBelow
                ? await rideClean(createGame, id, expected - stallBelow)
                : undefined;
        const above = await rideClean(
            createGame,
            id,
            Math.min(speedSteps, expected + restAbove),
        );
        rows.push(
            `| ${name} | ${expected} | ${at.end?.speed.toFixed(2)} m/s | ${
                below ? `${below.end?.distance.toFixed(1)} m` : "skipped"
            } | ${((above.rest?.distance ?? 0) - finish).toFixed(1)} m |`,
        );

        expect(at.round?.state, `${name} at step ${expected}`).toBe(
            RoundState.Won,
        );
        if (below) {
            expect(
                below.round,
                `${name} at step ${expected - stallBelow}`,
            ).toMatchObject({ state: RoundState.Lost, reason: "crashed" });
            expect(below.end?.distance).toBeLessThan(finish);
        }
        expect(above.round?.state).toBe(RoundState.Won);
        expect(above.rest).toMatchObject({ enabled: false, speed: 0 });
        expect(above.rest?.distance).toBeLessThan(above.track.length);
    },
);
