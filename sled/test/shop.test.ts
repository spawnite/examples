// @vitest-environment node
import { createWorld } from "koota";
import { afterEach, expect, it } from "vitest";
import { bankCoins, readBank } from "../src/bank";
import { RideId, RiderId } from "../src/ride/riders";
import {
    buyLook,
    buySpeedStep,
    equipLook,
    newProgress,
    readProgress,
    Refusal,
    writeProgress,
} from "../src/shop";

const worlds: ReturnType<typeof createWorld>[] = [];
afterEach(() => {
    for (const world of worlds.splice(0)) world.destroy();
});

/** A world whose bank holds `coins`, at Speed `step`. */
function openShop(coins: number, step = 0) {
    const world = createWorld();
    worlds.push(world);
    bankCoins(world, coins);
    writeProgress(world, { ...newProgress, step });
    return world;
}

it("buys the next Speed step for its tier's price", () => {
    //  Step 6 opens the second tier, at 3 coins a step.
    const world = openShop(10, 5);
    expect(buySpeedStep(world)).toEqual({ ok: true });
    expect(readProgress(world).step).toBe(6);
    expect(readBank(world)).toBe(7);
});

it("refuses a Speed step the bank cannot pay for, and changes nothing", () => {
    const world = openShop(2, 5);
    expect(buySpeedStep(world)).toEqual({
        ok: false,
        reason: Refusal.TooFewCoins,
    });
    expect(readProgress(world).step).toBe(5);
    expect(readBank(world)).toBe(2);
});

it("refuses a Speed step past the last", () => {
    const world = openShop(1000, 25);
    expect(buySpeedStep(world)).toEqual({ ok: false, reason: Refusal.TopStep });
    expect(readBank(world)).toBe(1000);
});

it("buys a look for its price, owns it and equips it", () => {
    const world = openShop(120);
    expect(buyLook(world, RiderId.Fox)).toEqual({ ok: true });
    expect(readBank(world)).toBe(20);
    expect(readProgress(world)).toMatchObject({
        riders: [RiderId.Penguin, RiderId.Fox],
        rider: RiderId.Fox,
        ride: RideId.Toboggan,
    });
});

it("refuses a look the bank cannot pay for, and changes nothing", () => {
    const world = openShop(74);
    expect(buyLook(world, RideId.Donut)).toEqual({
        ok: false,
        reason: Refusal.TooFewCoins,
    });
    expect(readBank(world)).toBe(74);
    expect(readProgress(world)).toEqual(newProgress);
});

it("refuses to sell a look the player owns", () => {
    const world = openShop(100);
    expect(buyLook(world, RiderId.Penguin)).toEqual({
        ok: false,
        reason: Refusal.Owned,
    });
    expect(readBank(world)).toBe(100);
});

it("equips a look the player owns", () => {
    const world = openShop(75);
    buyLook(world, RideId.Donut);
    expect(equipLook(world, RideId.Toboggan)).toEqual({ ok: true });
    expect(readProgress(world).ride).toBe(RideId.Toboggan);
});

it("refuses to equip a look the player does not own", () => {
    const world = openShop(1000);
    expect(equipLook(world, RideId.Tin)).toEqual({
        ok: false,
        reason: Refusal.NotOwned,
    });
    expect(readProgress(world)).toEqual(newProgress);
    expect(readBank(world)).toBe(1000);
});
