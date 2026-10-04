// @vitest-environment node
import { Vector2 } from "three";
import { expect } from "vitest";
import {
    fixedStepSeconds,
    HeroTrait,
    JumpTrait,
    sendInput,
    stepSeconds,
    TransformTrait,
} from "@spawnite/engine/core";
import { it } from "@spawnite/engine/testing";
import {
    lastPlatformX,
    platformTops,
    Platforms,
} from "../../src/scenes/Platforms";

it("climbs from the ground to the last platform on jumps alone", async ({
    scene,
}) => {
    const game = await scene(Platforms);
    const hero = game.world.queryFirst(HeroTrait);
    if (!hero) throw new Error("no hero");

    //  A walk right alone stops at the first platform, which stands higher
    //  than her step.
    sendInput(game, { intent: new Vector2(0.4, 0), steering: true });
    stepSeconds(game, 2);
    expect(hero.get(TransformTrait)?.y).toBeLessThan(0.1);

    //  Then a press each time she stands, until she is over the last one.
    for (let step = 0; step < 600; step++) {
        const x = hero.get(TransformTrait)?.x ?? 0;
        if (x > lastPlatformX) break;
        if (hero.get(JumpTrait)?.grounded) sendInput(game, { jump: true });
        stepSeconds(game, fixedStepSeconds);
    }
    sendInput(game, { intent: new Vector2(), steering: false });
    stepSeconds(game, 2);

    expect(platformTops.length).toBeGreaterThanOrEqual(4);
    expect(hero.get(JumpTrait)?.grounded).toBe(true);
    expect(hero.get(TransformTrait)?.y).toBeCloseTo(
        platformTops[platformTops.length - 1],
        1,
    );
}, 30_000);
