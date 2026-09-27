// @vitest-environment node
import { Vector2 } from "three";
import { expect, it } from "vitest";
import { mountHeadlessScene } from "@spawnite/engine";
import {
    fixedStepSeconds,
    Hero,
    Jump,
    sendInput,
    stepSeconds,
    Transform,
} from "@spawnite/engine/core";
import {
    lastPlatformX,
    platformTops,
    Platforms,
} from "../../src/scenes/Platforms";

it("climbs from the ground to the last platform on jumps alone", async () => {
    const game = await mountHeadlessScene(Platforms);
    const hero = game.world.queryFirst(Hero);
    if (!hero) throw new Error("no hero");

    //  A walk right alone stops at the first platform, which stands higher
    //  than her step.
    sendInput(game, { intent: new Vector2(0.4, 0), steering: true });
    stepSeconds(game, 2);
    expect(hero.get(Transform)?.y).toBeLessThan(0.1);

    //  Then a press each time she stands, until she is over the last one.
    for (let step = 0; step < 600; step++) {
        const x = hero.get(Transform)?.x ?? 0;
        if (x > lastPlatformX) break;
        if (hero.get(Jump)?.grounded) sendInput(game, { jump: true });
        stepSeconds(game, fixedStepSeconds);
    }
    sendInput(game, { intent: new Vector2(), steering: false });
    stepSeconds(game, 2);

    expect(platformTops.length).toBeGreaterThanOrEqual(4);
    expect(hero.get(Jump)?.grounded).toBe(true);
    expect(hero.get(Transform)?.y).toBeCloseTo(
        platformTops[platformTops.length - 1],
        1,
    );
    await game.unmount();
    game.world.destroy();
}, 30_000);
