// @vitest-environment node
import { Vector3 } from "three";
import { expect, it } from "vitest";
import { mountHeadlessScene, Player, World } from "@spawnite/engine";
import {
    fixedStepSeconds,
    Hero,
    stepSeconds,
    teleportActor,
    Transform,
} from "@spawnite/engine/core";
import { Platform } from "../../src/components/Platform";

it("holds her on its top when she comes down on it", async () => {
    const game = await mountHeadlessScene(() => (
        <World map="meadow">
            <Player position={[-3, 0, 0]} />
            <Platform position={[0, 1, 0]} size={[2, 2, 2]} />
        </World>
    ));
    const hero = game.world.queryFirst(Hero);
    if (!hero) throw new Error("no hero");
    //  Her capsule is made on her first step; then she drops from over it.
    stepSeconds(game, fixedStepSeconds);
    hero.set(Transform, new Vector3(0, 4, 0));
    teleportActor(game.world, hero);

    stepSeconds(game, 2);

    expect(hero.get(Transform)?.y).toBeCloseTo(2, 1);
    await game.unmount();
    game.world.destroy();
}, 30_000);
