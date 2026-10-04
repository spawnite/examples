import { createWorld, type World } from "koota";
import { CameraShakeTrait, CameraTrait } from "@spawnite/engine/core";
import { afterEach, expect, it } from "vitest";
import { GunId } from "../../src/siege/guns";
import { lanceWeapon } from "../../src/siege/lance";
import { kickCamera, readShotLook } from "../../src/weapons/looks";

//  Each gun kicks its warden's own camera and pushes back what it hits as
//  hard as it is heavy: the rail the most, and the blaster's rapid fire
//  not at all and barely.

let world: World | undefined;
afterEach(() => world?.destroy());

/** How much shake a camera holds after one shot of `weapon`. */
function kickOnce(weapon: string) {
    world?.destroy();
    world = createWorld();
    world.spawn(CameraTrait);
    kickCamera(world, weapon);
    return (
        world.queryFirst(CameraShakeTrait)?.get(CameraShakeTrait)?.trauma ?? 0
    );
}

it("kicks her camera for the rail more than for the scattergun, and not for the blaster", () => {
    const rail = kickOnce(GunId.Rail);
    const scattergun = kickOnce(GunId.Scattergun);
    const blaster = kickOnce(GunId.Blaster);

    expect(scattergun).toBeGreaterThan(0);
    expect(rail).toBeGreaterThan(scattergun);
    expect(blaster).toBe(0);
});

it("keeps a shot's kick small", () => {
    expect(kickOnce(GunId.Rail)).toBeLessThanOrEqual(0.6);
});

it("pushes a monster back farther and longer the heavier the gun", () => {
    const blaster = readShotLook(GunId.Blaster).knock;
    const scattergun = readShotLook(GunId.Scattergun).knock;
    const rail = readShotLook(GunId.Rail).knock;

    expect(scattergun.metres).toBeGreaterThan(blaster.metres);
    expect(rail.metres).toBeGreaterThan(scattergun.metres);
    expect(rail.seconds).toBeGreaterThan(blaster.seconds);
    expect(readShotLook(lanceWeapon).knock.metres).toBeGreaterThan(
        blaster.metres,
    );
});
