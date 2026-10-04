// @vitest-environment node
import { create } from "@react-three/test-renderer";
import type { World } from "koota";
import { WorldProvider } from "koota/react";
import { expect } from "vitest";
import { emitEvent } from "@spawnite/engine/core";
import { it, type CreateWorld } from "@spawnite/engine/testing";
import { WeaponId } from "../../src/rules/data";
import { Shooter, ShotsTrait, type Shot } from "../../src/rules/traits";
import { useEventRecords } from "../../src/views/useEventRecords";

//  Weapons fire while the view listens: every shot reaches it once, when
//  two fire in one step and when two steps run before the next frame.

const pulse: Shot = {
    weapon: WeaponId.Pulse,
    owner: Shooter.Hero,
    toX: 1,
    toZ: 0,
};
const laser: Shot = {
    weapon: WeaponId.Laser,
    owner: Shooter.Hero,
    toX: 0,
    toZ: 1,
};

async function listen(createWorld: CreateWorld) {
    const { world } = createWorld([]);
    const heard: Shot[] = [];
    function Listener() {
        useEventRecords(
            ShotsTrait,
            (entity) => entity.get(ShotsTrait)?.list,
            (shot) => heard.push(shot),
        );
        return null;
    }
    const renderer = await create(
        <WorldProvider world={world}>
            <Listener />
        </WorldProvider>,
    );
    return { world, holder: world.spawn(), heard, renderer };
}

function fire(holder: ReturnType<World["spawn"]>, shot: Shot) {
    emitEvent(holder, ShotsTrait, (shots) => {
        shots.list.push(shot);
        return shots;
    });
}

it("hears every shot a step fires, once each", async ({ createWorld }) => {
    const { holder, heard, renderer } = await listen(createWorld);
    fire(holder, pulse);
    fire(holder, laser);
    await renderer.advanceFrames(3, 1 / 60);
    expect(heard).toEqual([pulse, laser]);
    await renderer.unmount();
});

it("hears the shots of two steps that run before one frame", async ({
    createWorld,
}) => {
    const { holder, heard, renderer } = await listen(createWorld);
    fire(holder, pulse);
    //  The next step spends the last one's event before it fires.
    holder.remove(ShotsTrait);
    fire(holder, laser);
    await renderer.advanceFrames(1, 1 / 30);
    expect(heard).toEqual([pulse, laser]);
    await renderer.unmount();
});
