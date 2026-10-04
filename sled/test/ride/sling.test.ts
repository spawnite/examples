// @vitest-environment node
import { Vector2 } from "three";
import { expect } from "vitest";
import {
    addStatModifier,
    sendInput,
    stepSeconds,
    TrackMoverTrait,
} from "@spawnite/engine/core";
import { RunMachine } from "../../src/ride/course";
import { aimSling, releaseSling, SlingTrait } from "../../src/ride/sling";
import { frames, startRide } from "./rider";
import { it, type CreateGame } from "@spawnite/engine/testing";

async function start(createGame: CreateGame) {
    const ride = await startRide(createGame);
    return ride;
}

//  Old Sling.test: easing on after the launch is what once dragged the
//  character, and the band strung through it, back to the start line.
it("eases toward the drag until the launch switches it off", async ({
    createGame,
}) => {
    const { game, rider } = await start(createGame);
    aimSling(rider, 1);
    stepSeconds(game, frames(10));
    expect(rider.get(SlingTrait)?.charge).toBeGreaterThan(0);

    releaseSling(rider);
    expect(RunMachine.read(rider).matches("riding")).toBe(true);
    aimSling(rider, 1);
    stepSeconds(game, frames(10));
    expect(rider.get(SlingTrait)?.charge).toBe(0);
});

it("launches at the drag's charge, not the eased one", async ({
    createGame,
}) => {
    const { rider } = await start(createGame);
    aimSling(rider, 1);
    releaseSling(rider);
    expect(rider.get(TrackMoverTrait)).toMatchObject({
        enabled: true,
        speed: 6.5,
    });
});

it.for([
    [0, 1.5],
    [0.5, 4],
    [1, 6.5],
])(
    "launches a pull of %s at %s m/s",
    async ([charge, speed], { createGame }) => {
        const { rider } = await start(createGame);
        aimSling(rider, charge);
        releaseSling(rider);
        expect(rider.get(TrackMoverTrait)?.speed).toBeCloseTo(speed);
    },
);

it("scales every launch by the launch stat", async ({ createGame }) => {
    const { rider } = await start(createGame);
    addStatModifier(rider, "launch", { source: "slingshot", more: 0.04 });
    aimSling(rider, 0.5);
    releaseSling(rider);
    expect(rider.get(TrackMoverTrait)?.speed).toBeCloseTo(4 * 1.04);
});

it("fires a bare Space from the half-draw, without a jump", async ({
    createGame,
}) => {
    const { game, rider } = await start(createGame);
    sendInput(game, { jump: true });
    stepSeconds(game, frames(1));

    const mover = rider.get(TrackMoverTrait);
    expect(mover?.speed).toBeCloseTo(4, 1);
    expect(mover?.enabled).toBe(true);
    expect(mover?.verticalSpeed).toBe(0);
});

it("fires a drag's pull below the half-draw as it was drawn", async ({
    createGame,
}) => {
    const { game, rider } = await start(createGame);
    aimSling(rider, 0.25);
    sendInput(game, { jump: true });
    stepSeconds(game, frames(1));

    const mover = rider.get(TrackMoverTrait);
    expect(mover?.speed).toBeCloseTo(2.75, 1);
    expect(mover?.verticalSpeed).toBe(0);
    expect(RunMachine.read(rider).matches("riding")).toBe(true);
});

it("fires a drag that only aimed with no pull, from the slack", async ({
    createGame,
}) => {
    const { game, rider } = await start(createGame);
    aimSling(rider, 0, 1);
    sendInput(game, { jump: true });
    stepSeconds(game, frames(1));
    expect(rider.get(TrackMoverTrait)?.speed).toBeCloseTo(1.5, 1);
});

it("pulls on S for 0.8 s to a full charge, and aims on D", async ({
    createGame,
}) => {
    const { game, rider } = await start(createGame);
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
