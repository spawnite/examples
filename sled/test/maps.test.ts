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
import { it, type CreateGame } from "@spawnite/engine/testing";
import type { Track as TrackPath } from "@spawnite/engine";
import { buildRun, levelMaps, levels, Track } from "../src/levels";
import { desert, snow } from "../src/maps";
import { rideGravity } from "../src/ride/rider";
import { plugins } from "../src/game";

/** The speed left after a second at 10 m/s on `track`'s lane, `distance`
 *  along, with the air's drag off so the ground's is all there is. */
async function speedAfterASecond(
    createGame: CreateGame,
    track: TrackPath,
    distance: number,
) {
    const game = await createGame({
        plugins,
        scene: (world) => {
            world.spawn(
                TransformTrait,
                AuthorityTrait({ context: RunContext.Client }),
                TrackMoverTrait({
                    distance,
                    lateral: 0,
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

//  The first desert track: loose sand for its first 15 m, packed dune from
//  40 m on.
const desertLevel = Track.Nine;
const runOn = (map: typeof snow) =>
    buildRun(levels[desertLevel].track.points, map).track;

it("draws the first desert track on the desert map, and track 1 on snow", () => {
    expect(levelMaps[desertLevel]).toBe(desert);
    expect(levelMaps[Track.One]).toBe(snow);
});

it("slows the sled more on the desert's sand lane than on snow", async ({
    createGame,
}) => {
    const onSnow = await speedAfterASecond(createGame, runOn(snow), 5);
    const onSand = await speedAfterASecond(
        createGame,
        runOn(levelMaps[desertLevel]),
        5,
    );
    expect(onSand).toBeLessThan(onSnow! - 0.1);
});

it("costs nothing on the desert's packed dune stretch, as on ice", async ({
    createGame,
}) => {
    const sand = runOn(levelMaps[desertLevel]);
    expect(sand.frictionAt(65, 0)).toBe(0);
    expect(await speedAfterASecond(createGame, sand, 65)).toBe(
        await speedAfterASecond(createGame, runOn(snow), 65),
    );
});
