// @vitest-environment node
import { Vector2 } from "three";
import { afterEach, expect, it } from "vitest";
import {
    addStatModifier,
    sendInput,
    stepSeconds,
    TrackMoverTrait,
    type HeadlessGame,
} from "@spawnite/engine/core";
import { aimSling, releaseSling, SlingTrait } from "../../src/ride/sling";
import { frames, startRide } from "./rider";

const games: HeadlessGame[] = [];
afterEach(() => {
    for (const game of games.splice(0)) game.world.destroy();
});

async function start() {
    const ride = await startRide();
    games.push(ride.game);
    return ride;
}

//  Old Sling.test: easing on after the launch is what once dragged the
//  character, and the band strung through it, back to the start line.
it("eases toward the drag until the launch switches it off", async () => {
    const { game, rider } = await start();
    aimSling(rider, 1);
    stepSeconds(game, frames(10));
    expect(rider.get(SlingTrait)?.charge).toBeGreaterThan(0);

    releaseSling(rider);
    expect(rider.get(SlingTrait)?.enabled).toBe(false);
    aimSling(rider, 1);
    stepSeconds(game, frames(10));
    expect(rider.get(SlingTrait)?.charge).toBe(0);
});

it("launches at the drag's charge, not the eased one", async () => {
    const { rider } = await start();
    aimSling(rider, 1);
    releaseSling(rider);
    expect(rider.get(TrackMoverTrait)).toMatchObject({
        enabled: true,
        speed: 6.5,
    });
});

it.each([
    [0, 1.5],
    [0.5, 4],
    [1, 6.5],
])("launches a pull of %s at %s m/s", async (charge, speed) => {
    const { rider } = await start();
    aimSling(rider, charge);
    releaseSling(rider);
    expect(rider.get(TrackMoverTrait)?.speed).toBeCloseTo(speed);
});

it("scales every launch by the launch stat", async () => {
    const { rider } = await start();
    addStatModifier(rider, "launch", { source: "slingshot", more: 0.04 });
    aimSling(rider, 0.5);
    releaseSling(rider);
    expect(rider.get(TrackMoverTrait)?.speed).toBeCloseTo(4 * 1.04);
});

it("fires a bare Space from the half-draw, without a jump", async () => {
    const { game, rider } = await start();
    sendInput(game, { jump: true });
    stepSeconds(game, frames(1));

    const mover = rider.get(TrackMoverTrait);
    expect(mover?.speed).toBeCloseTo(4, 1);
    expect(mover?.enabled).toBe(true);
    expect(mover?.verticalSpeed).toBe(0);
});

it("pulls on S for 0.8 s to a full charge, and aims on D", async () => {
    const { game, rider } = await start();
    sendInput(game, { intent: new Vector2(1, -1), steering: true });
    stepSeconds(game, 0.8);

    const sling = rider.get(SlingTrait);
    expect(sling?.targetCharge).toBeCloseTo(1);
    expect(sling?.targetSide).toBe(1);
    expect(rider.get(TrackMoverTrait)?.lateral).toBeGreaterThan(0);

    sendInput(game, { intent: new Vector2(), steering: false, jump: true });
    stepSeconds(game, frames(1));
    expect(rider.get(TrackMoverTrait)?.speed).toBeCloseTo(6.5, 1);
});
