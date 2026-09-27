// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import { Vector3 } from "three";
import { beforeAll, expect, it } from "vitest";
import {
    Collider,
    createGameWorld,
    createGroundSurface,
    fixedStepSeconds,
    Ground,
    Hero,
    loadRapier,
    moveActorsThroughPhysics,
    Transform,
    Velocity,
} from "@spawnite/engine";
import { UnstuckButton } from "../../src/hud/UnstuckButton";

beforeAll(loadRapier);

it("shows the button only while she is stuck, and takes it away once she is freed", () => {
    const world = createGameWorld();
    const surface = createGroundSurface();
    world.spawn(Ground({ surface }));
    const floor = surface.getHeightAt({ x: 0, z: 0 });
    const hero = world.spawn(
        Hero,
        Transform(new Vector3(0.2, floor, 0.1)),
        Velocity,
    );
    const step = () =>
        act(() => moveActorsThroughPhysics(world, fixedStepSeconds));
    const button = () => screen.queryByRole("button", { name: "Unstuck" });
    const { unmount } = render(
        <WorldProvider world={world}>
            <UnstuckButton />
        </WorldProvider>,
    );
    try {
        step();
        const onSpawn = button();
        hero.set(Velocity, new Vector3(3, 0, 0));
        for (let at = 0; at < 10; at++) step();
        const whileWalking = button();
        hero.set(Velocity, new Vector3());
        //  A 3 m rock set down round her.
        const { x, z } = hero.get(Transform) ?? { x: 0, z: 0 };
        world.spawn(
            Transform(new Vector3(x, floor + 1, z)),
            Collider({ size: new Vector3(3, 3, 3) }),
        );
        step();
        const stuck = button();
        if (stuck) fireEvent.click(stuck);
        step();
        const freed = hero.get(Transform);

        expect(onSpawn).toBeNull();
        expect(whileWalking).toBeNull();
        expect(stuck).not.toBeNull();
        expect(
            Math.max(
                Math.abs((freed?.x ?? 0) - x),
                Math.abs((freed?.z ?? 0) - z),
            ),
        ).toBeGreaterThan(1.5);
        expect(button()).toBeNull();
    } finally {
        unmount();
        world.destroy();
    }
});
