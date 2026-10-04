// @vitest-environment node
import { expect, it } from "vitest";
import { composePlugins } from "@spawnite/engine/core";
import { plugins } from "../src/game";

it("steps the dash between the input copy and the steer, and the run's rules before the engine's", () => {
    const names = composePlugins(plugins).entries.map(({ name }) => name);

    expect(names).toEqual([
        "hero.copyClientInput",
        "field.takeDashRequest",
        "hero.steer",
        "field.driveHero",
        "stats.expireModifiers",
        "stats.copyFields",
        "entity.move",
        "entity.blendCorrections",
        "hero.countDown",
        "field.advanceRun",
        "field.landBlasts",
        "field.eruptVents",
        "field.sweepBeam",
        "field.moveEnemies",
        "field.flyEnemyShots",
        "field.fireWeapons",
        "field.flyShots",
        "field.collectDrops",
        "field.collectGems",
        "field.playEndings",
        "field.levelUp",
        "cooldowns.countDown",
        "behaviours.run",
        "resources.regenerate",
        "state.advanceMachines",
        "physics.step",
        "map.restColliders",
    ]);
});
