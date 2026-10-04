// @vitest-environment node
import { Vector2 } from "three";
import { expect } from "vitest";
import { findPlayerHero, stepSeconds, TransformTrait } from "@spawnite/engine";
import { it } from "@spawnite/engine/testing";
import { boundary } from "../../src/rules/data";
import { readRun } from "../../src/rules/field";
import { RunPhase } from "../../src/rules/traits";
import { Field } from "../../src/scenes/Field";
import { plugins } from "../../src/game";

//  The field as a simulate mounts it: headless, the run started on its own,
//  the arena's walls and boxes standing in the physics.

it("starts the run headless and keeps the soldier inside the walls", async ({
    createWorld,
    scene,
}) => {
    const { world } = createWorld(plugins);
    const game = await scene(Field, world);
    stepSeconds(game, 0.1);
    expect(readRun(world).phase).toBe(RunPhase.Playing);
    //  West, along the middle, where no box stands in the way.
    game.input.intent = new Vector2(-1, 0);
    game.input.steering = true;
    stepSeconds(game, 8);
    const hero = findPlayerHero(world)?.get(TransformTrait);
    expect(hero?.x).toBeGreaterThan(-boundary);
    expect(hero?.x).toBeLessThan(-boundary + 2);
});
