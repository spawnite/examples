// @vitest-environment node
import { expect } from "vitest";
import {
    AuthorityTrait,
    RunContext,
    stepSeconds,
    TransformTrait,
    TrackMoverTrait,
    TrackRefTrait,
} from "@spawnite/engine/core";
import { buildRun } from "../../src/levels";
import { rideGravity } from "../../src/ride/rider";
import { plugins } from "../../src/game";
import { it, type CreateGame } from "@spawnite/engine/testing";

//  The old TrackMover's snow drag, 1.14/s per metre of snow under the
//  sled, on level 1's lane: 6.3 m, with 3 m of shoulder each side.

//  Level, 40 m of snow lane, then 40 m of swept ice from 60 m on.
const { track } = buildRun([
    { x: 0, y: 0, z: 0, width: 6.3, zone: "snow" },
    { x: 0, y: 0, z: -40, width: 6.3, zone: "snow" },
    { x: 0, y: 0, z: -60, width: 6.3, zone: "ice" },
    { x: 0, y: 0, z: -100, width: 6.3, zone: "ice" },
]);
const shoulderEdge = 6.3 / 2 + 3;

/** The speed left after a second at 10 m/s from `distance` and `lateral`,
 *  with the air's drag off so the snow's is all there is. */
async function speedAfterASecond(
    createGame: CreateGame,
    distance: number,
    lateral: number,
) {
    const game = await createGame({
        plugins,
        scene: (world) => {
            world.spawn(
                TransformTrait,
                AuthorityTrait({ context: RunContext.Client }),
                TrackMoverTrait({
                    distance,
                    lateral,
                    speed: 10,
                    drag: 0,
                    gravity: rideGravity,
                }),
                TrackRefTrait({ track }),
            );
        },
    });
    stepSeconds(game, 1);
    return game.world.queryFirst(TrackMoverTrait)?.get(TrackMoverTrait)?.speed;
}

//  Each step takes `perSecond` / 60 of the speed.
const after = (perSecond: number) => 10 * (1 - perSecond / 60) ** 60;

it("costs the old 0.04/s on a snow lane", async ({ createGame }) => {
    expect(track.frictionAt(10, 0)).toBeCloseTo(0.035 * 1.14, 6);
    expect(await speedAfterASecond(createGame, 10, 0)).toBeCloseTo(
        after(0.0399),
        3,
    );
});

it("costs the old 0.4/s at a shoulder's outer edge", async ({ createGame }) => {
    expect(track.frictionAt(10, -shoulderEdge)).toBeCloseTo(0.35 * 1.14, 6);
    expect(await speedAfterASecond(createGame, 10, shoulderEdge)).toBeCloseTo(
        after(0.399),
        3,
    );
});

it("costs nothing on swept ice", async ({ createGame }) => {
    expect(track.frictionAt(70, 0)).toBe(0);
    expect(await speedAfterASecond(createGame, 70, 0)).toBeCloseTo(10, 6);
});
