// @vitest-environment node
import { expect, it } from "vitest";
import { composePlugins, describeSystem } from "@spawnite/engine/core";
import { plugins } from "../src/game";

const { entries, systems } = composePlugins(plugins);

it("steps the siege around the engine's systems in the order the room ran them", () => {
    const names = entries.map(({ name }) => name);

    expect(names).toEqual([
        "hero.copyClientInput",
        "hero.steer",
        "stats.expireModifiers",
        "stats.copyFields",
        "entity.move",
        "entity.blendCorrections",
        "hero.countDown",
        "siege.adoptWardens",
        "siege.gatherStandingWardens",
        "siege.holdUnattended",
        "siege.readSignals",
        "siege.holdWardenWeapons",
        "siege.applyElementHits",
        "siege.ricochetPellets",
        "siege.dropThunderheads",
        "siege.tendAfflictions",
        "siege.recordDeeds",
        "siege.takeFallenMonsters",
        "siege.sightSpitters",
        "cooldowns.countDown",
        "behaviours.run",
        "resources.regenerate",
        "weapons.flyProjectiles",
        "state.advanceMachines",
        "siege.advanceSiege",
        "siege.faceMonsters",
        "siege.strikeWardens",
        "siege.windUpSlams",
        "siege.spitBolts",
        "siege.flyBolts",
        "siege.tendWardens",
        "siege.tallyMonsters",
        "siege.expireEntities",
        "physics.step",
        "map.restColliders",
    ]);
});

it("gives each system the room runs a line on what it does", () => {
    const undescribed = systems
        .filter((system) => !describeSystem(system))
        .map(({ name }) => name);

    expect(undescribed).toEqual([]);
});

it("names the warden in each system's line, never she or her", () => {
    const gendered = systems
        .map((system) => describeSystem(system) ?? "")
        .filter((line) => /\b(?:she|her)\b/i.test(line));

    expect(gendered).toEqual([]);
});
