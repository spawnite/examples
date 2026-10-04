// @vitest-environment node
import { expect, it } from "vitest";
import { composePlugins } from "@spawnite/engine/core";
import { plugins } from "../src/game";

it("steps the engine's systems with the bag, the round and the count of runs won", () => {
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
        "inventory.useItems",
        "behaviours.run",
        "resources.regenerate",
        "round.advance",
        "state.advanceMachines",
        "runs.countRunsWon",
        "physics.step",
        "map.restColliders",
    ]);
});
