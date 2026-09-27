// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    buildAiTree,
    TrackMoverTrait,
    type HeadlessGame,
} from "@spawnite/engine/core";
import { RunTrait } from "../../src/ride/course";
import { layCourse, startRide } from "../ride/rider";

const games: HeadlessGame[] = [];
afterEach(() => {
    for (const game of games.splice(0)) game.world.destroy();
});

/** The rider at `distance` on level 1's course at the launch speed,
 *  and its AI tree from there. */
async function describeFrom(distance: number) {
    const ride = await startRide();
    games.push(ride.game);
    layCourse(ride.game.world);
    ride.rider.set(TrackMoverTrait, { distance, speed: 7, enabled: true });
    const read = () => buildAiTree({ world: ride.game.world });
    const find = (is: string) => read().find((node) => node.is === is);
    return { ...ride, read, find };
}

it("describes the rider first, the coins and the slab from the start line", async () => {
    const { read, find } = await describeFrom(6);
    const [rider] = read();
    expect(rider).toMatchObject({
        facts: ["on the ground", "in the middle of the lane"],
        actions: ["steer left", "steer right", "jump"],
    });
    expect(find("a coin")).toMatchObject({
        facts: ["right in front of you", "to your right, close"],
        actions: ["collect it"],
    });
    expect(find("a slab across the lane")).toMatchObject({
        facts: ["far ahead", "in your path"],
        actions: ["jump it", "go round it"],
    });
});

it("says the slab is reaching the rider just before it, and where the boulder is", async () => {
    const { game, rider, find } = await describeFrom(37);
    expect(find("a slab across the lane")?.facts).toEqual([
        "reaching you now",
        "in your path",
    ]);
    expect(find("a boulder")).toMatchObject({
        facts: [
            "further ahead",
            "to your left, close",
            "ends the run on a touch",
        ],
        actions: ["go round it"],
    });
    expect(find("the finish line")?.facts).toEqual([
        "far ahead",
        "in your path",
    ]);
    rider.set(RunTrait, { stunSeconds: 0.5 });
    expect(find("a coin")).toBeDefined();
    const [stunned] = buildAiTree({ world: game.world });
    expect(stunned.facts).toContain("stunned");
});
