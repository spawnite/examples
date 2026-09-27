// @vitest-environment node
import { createWorld, type Entity, type World } from "koota";
import { afterEach, expect, it } from "vitest";
import { readWeaponNumber, WeaponNumber, Weapons } from "@spawnite/engine";
import { CardId, pickCard } from "../../src/siege/cards";
import { lanceSettings, lanceWeapon } from "../../src/siege/lance";
import { openSiege } from "./room";
import { declareWardenStats } from "../../src/siege/stats";
import { WardenTrait } from "../../src/siege/traits";

let world: World | undefined;

afterEach(() => {
    world?.destroy();
    world = undefined;
});

/** A warden with every stat at its base and no card. */
function spawnWarden() {
    world = createWorld();
    const warden = world.spawn(WardenTrait);
    declareWardenStats(warden);
    return warden;
}

/** Has her take `id`, as a pick from an offer of one. */
function takeCard(warden: Entity, id: CardId) {
    warden.set(WardenTrait, { offer: [id], taken: "" });
    pickCard(warden, 0);
}

/** The lance's damage, rate and pierce as the room's judge reads them off
 *  her. */
function readLance(warden: Entity) {
    return {
        damage: readWeaponNumber(lanceSettings, warden, WeaponNumber.Damage),
        shotsPerSecond: readWeaponNumber(
            lanceSettings,
            warden,
            WeaponNumber.ShotsPerSecond,
        ),
        pierce: readWeaponNumber(lanceSettings, warden, WeaponNumber.Pierce),
    };
}

it("arms the room's judge with the lance the scene registers", async () => {
    const siege = await openSiege();

    const registered = siege.world.get(Weapons)?.get(lanceWeapon);
    await siege.close();

    expect(registered).toBe(lanceSettings);
});

it("gives the lance no damage and no rate until she takes the Storm Lance", () => {
    const warden = spawnWarden();
    const before = readLance(warden);

    takeCard(warden, CardId.StormLance);

    expect(before).toMatchObject({ damage: 0, shotsPerSecond: 0 });
    const after = readLance(warden);
    expect(after.damage).toBeGreaterThan(30);
    expect(after.shotsPerSecond).toBeGreaterThan(0.5);
    expect(after.shotsPerSecond).toBeLessThan(1);
    expect(after.pierce).toBeGreaterThanOrEqual(8);
});

it("raises the lance with Heavy Rounds and Hair Trigger as it does the blaster", () => {
    const warden = spawnWarden();
    takeCard(warden, CardId.StormLance);
    const before = readLance(warden);
    expect(before.damage).toBeGreaterThan(0);

    takeCard(warden, CardId.HeavyRounds);
    takeCard(warden, CardId.HairTrigger);

    const after = readLance(warden);
    expect(after.damage).toBeCloseTo(before.damage * 1.25, 5);
    expect(after.shotsPerSecond).toBeCloseTo(before.shotsPerSecond * 1.2, 5);
});
