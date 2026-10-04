// @vitest-environment node
import { expect, it } from "vitest";
import {
    createGameWorld,
    GroundTrait,
    HeroTrait,
    mountHeadlessScene,
    RoomSourceTrait,
} from "@spawnite/engine";
import { plugins } from "../src/game";
import { Holdfast } from "../src/scenes/Holdfast";

//  The room mounts the scene on a world of its own, marked as a room's.
it("mounts on a room's world with its ground and no hero of its own", async () => {
    const world = createGameWorld(plugins);
    world.add(RoomSourceTrait);
    const game = await mountHeadlessScene(Holdfast, world);

    expect(world.query(GroundTrait)).toHaveLength(1);
    expect(world.query(HeroTrait)).toHaveLength(0);
    await game.unmount();
    world.destroy();
});
