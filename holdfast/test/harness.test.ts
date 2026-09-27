// @vitest-environment node
import { expect, it } from "vitest";
import {
    createGameWorld,
    Ground,
    Hero,
    mountHeadlessScene,
    RoomSource,
} from "@spawnite/engine";
import { Holdfast } from "../src/scenes/Holdfast";

//  The room mounts the scene on a world of its own, marked as a room's.
it("mounts on a room's world with its ground and no hero of its own", async () => {
    const world = createGameWorld();
    world.add(RoomSource);
    const game = await mountHeadlessScene(Holdfast, world);

    expect(world.query(Ground)).toHaveLength(1);
    expect(world.query(Hero)).toHaveLength(0);
    await game.unmount();
    world.destroy();
});
