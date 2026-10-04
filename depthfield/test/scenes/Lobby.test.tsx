// @vitest-environment node
import { expect } from "vitest";
import { stepSeconds } from "@spawnite/engine";
import { it } from "@spawnite/engine/testing";
import { Lobby } from "../../src/scenes/Lobby";
import { plugins } from "../../src/game";

//  The lobby as `spawnite simulate --scene lobby` mounts it: headless, in
//  Node, with no page to draw on.

it("mounts headless and steps", async ({ createWorld, scene }) => {
    const { world } = createWorld(plugins);
    const game = await scene(Lobby, world);
    stepSeconds(game, 0.1);
    expect(game.world).toBe(world);
});
