// @vitest-environment node
import { expect, it } from "vitest";
import { composePlugins } from "@spawnite/engine/core";
import { plugins } from "../src/game";

it("steps the engine's systems with the weapons' projectiles", () => {
    const names = composePlugins(plugins).entries.map(({ name }) => name);

    expect(names).toEqual([
        "hero.copyClientInput",
        "hero.steer",
        "stats.expireModifiers",
        "stats.copyFields",
        "entity.move",
        "entity.blendCorrections",
        "hero.countDown",
        "cooldowns.countDown",
        "behaviours.run",
        "resources.regenerate",
        "weapons.flyProjectiles",
        "state.advanceMachines",
        "physics.step",
        "map.restColliders",
    ]);
});
