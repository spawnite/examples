// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    Authority,
    createHeadlessGame,
    RunContext,
    stepSeconds,
    Transform,
    TrackMoverTrait,
    TrackRef,
    type HeadlessGame,
} from "@spawnite/engine/core";
import { buildRun } from "../../src/levels";
import { rideGravity } from "../../src/ride/rider";
import { systems } from "../../src/systems";

//  The old TrackMover's snow drag, 1.14/s per metre of snow under the
//  sled, on level 1's lane: 6.3 m, with 3 m of shoulder each side.

const games: HeadlessGame[] = [];
afterEach(() => {
    for (const game of games.splice(0)) game.world.destroy();
});

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
async function speedAfterASecond(distance: number, lateral: number) {
    const game = await createHeadlessGame({
        systems,
        scene: (world) => {
            world.spawn(
                Transform,
                Authority({ context: RunContext.Client }),
                TrackMoverTrait({
                    distance,
                    lateral,
                    speed: 10,
                    drag: 0,
                    gravity: rideGravity,
                }),
                TrackRef({ track }),
            );
        },
    });
    games.push(game);
    stepSeconds(game, 1);
    return game.world.queryFirst(TrackMoverTrait)?.get(TrackMoverTrait)?.speed;
}

//  Each step takes `perSecond` / 60 of the speed.
const after = (perSecond: number) => 10 * (1 - perSecond / 60) ** 60;

it("costs the old 0.04/s on a snow lane", async () => {
    expect(track.frictionAt(10, 0)).toBeCloseTo(0.035 * 1.14, 6);
    expect(await speedAfterASecond(10, 0)).toBeCloseTo(after(0.0399), 3);
});

it("costs the old 0.4/s at a shoulder's outer edge", async () => {
    expect(track.frictionAt(10, -shoulderEdge)).toBeCloseTo(0.35 * 1.14, 6);
    expect(await speedAfterASecond(10, shoulderEdge)).toBeCloseTo(
        after(0.399),
        3,
    );
});

it("costs nothing on swept ice", async () => {
    expect(track.frictionAt(70, 0)).toBe(0);
    expect(await speedAfterASecond(70, 0)).toBeCloseTo(10, 6);
});
