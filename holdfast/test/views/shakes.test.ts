import { createWorld, type World } from "koota";
import { CameraShakeTrait, CameraTrait } from "@spawnite/engine/core";
import { afterEach, beforeEach, expect, it } from "vitest";
import { GunId } from "../../src/siege/guns";
import { StrikeKind } from "../../src/siege/traits";
import {
    readStrikeShake,
    shakeCap,
    shakeView,
    shotShakeCap,
    teammateShakeShare,
} from "../../src/views/shakes";
import { kickCamera } from "../../src/weapons/looks";

//  A late wave lands many moments at once: they stack to a cap and no
//  further, her own shots to less, and a teammate's moment shakes her less
//  than her own.

let world: World;
beforeEach(() => {
    world = createWorld();
    world.spawn(CameraTrait);
});
afterEach(() => world.destroy());

function readTrauma() {
    return (
        world.queryFirst(CameraShakeTrait)?.get(CameraShakeTrait)?.trauma ?? 0
    );
}

it("stacks a heavy wave's moments no higher than the cap", () => {
    for (let moment = 0; moment < 8; moment++)
        shakeView(world, { strength: 0.6 });

    //  0.6 of a whole shake rolls the view 0.86° at most, against 2.4°.
    expect(readTrauma()).toBeCloseTo(shakeCap);
    expect(shakeCap).toBeLessThanOrEqual(0.6);
});

it("holds a held trigger's kicks under the cap for her own shots", () => {
    for (let shot = 0; shot < 10; shot++) kickCamera(world, GunId.Rail);

    expect(readTrauma()).toBeCloseTo(shotShakeCap);
    expect(shotShakeCap).toBeLessThanOrEqual(0.35);
});

it("shakes her less for a teammate's reaction than for her own", () => {
    const own = readStrikeShake(StrikeKind.Blast, true) ?? 0;

    expect(own).toBeGreaterThan(0);
    expect(readStrikeShake(StrikeKind.Blast, false)).toBeCloseTo(
        own * teammateShakeShare,
    );
    expect(teammateShakeShare).toBeLessThan(1);
});
