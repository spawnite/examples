// @vitest-environment node
import { expect, it } from "vitest";
import { composePlugins } from "@spawnite/engine/core";
import { plugins } from "../src/game";

it("steps the creatures' flinch and respawn after the engine's rules", () => {
    const names = composePlugins(plugins).entries.map(({ name }) => name);

    expect(names).toEqual([
        "hero.copyClientInput",
        "abilities.approach",
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
        "abilities.cast",
        "weapons.flyProjectiles",
        "npc.converse",
        "npc.runRoutines",
        "state.advanceMachines",
        "creatures.flinchOnHit",
        "physics.step",
        "map.restColliders",
    ]);
});
