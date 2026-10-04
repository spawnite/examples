import { Vector3 } from "three";
import { afterEach, expect } from "vitest";
import {
    fixedStepSeconds,
    HealthTrait,
    HeroTrait,
    stepWorld,
    TransformTrait,
} from "@spawnite/engine";
import { test as it } from "@spawnite/engine/testing";
import { aim } from "../src/combat/aim";
import { plugins } from "../src/game";
import { MonsterTrait } from "../src/monsters/traits";

afterEach(() => {
    aim.pressed = false;
    aim.auto = false;
});

it("takes health off a monster in her sword's reach when she attacks", ({
    createWorld,
}) => {
    const { world } = createWorld(plugins);
    world.spawn(HeroTrait, TransformTrait);
    const near = world.spawn(
        MonsterTrait,
        TransformTrait(new Vector3(1, 0, 0)),
        HealthTrait({ current: 1000, maximum: 1000 }),
    );
    const far = world.spawn(
        MonsterTrait,
        TransformTrait(new Vector3(30, 0, 0)),
        HealthTrait({ current: 1000, maximum: 1000 }),
    );
    const step = () => stepWorld(world, { deltaSeconds: fixedStepSeconds });
    step();
    expect(near.get(HealthTrait)?.current).toBe(1000);

    //  A tap, as a phone sends it: the attack aims itself at the nearest.
    aim.auto = true;
    aim.pressed = true;
    step();

    expect(near.get(HealthTrait)?.current).toBeLessThan(1000);
    expect(far.get(HealthTrait)?.current).toBe(1000);
});
