// @vitest-environment node
import { Vector3 } from "three";
import { expect } from "vitest";
import { Player, World } from "@spawnite/engine";
import {
    fixedStepSeconds,
    HeroTrait,
    stepSeconds,
    teleportActor,
    TransformTrait,
} from "@spawnite/engine/core";
import { it } from "@spawnite/engine/testing";
import { Platform } from "../../src/components/Platform";

it("holds her on its top when she comes down on it", async ({ scene }) => {
    const game = await scene(() => (
        <World map="meadow">
            <Player position={[-3, 0, 0]} />
            <Platform position={[0, 1, 0]} size={[2, 2, 2]} />
        </World>
    ));
    const hero = game.world.queryFirst(HeroTrait);
    if (!hero) throw new Error("no hero");
    //  Her capsule is made on her first step; then she drops from over it.
    stepSeconds(game, fixedStepSeconds);
    hero.set(TransformTrait, new Vector3(0, 4, 0));
    teleportActor(game.world, hero);

    stepSeconds(game, 2);

    expect(hero.get(TransformTrait)?.y).toBeCloseTo(2, 1);
}, 30_000);
