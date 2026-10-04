// @vitest-environment node
import { Vector2 } from "three";
import { expect } from "vitest";
import { sendInput, stepSeconds, TrackMoverTrait } from "@spawnite/engine/core";
import { LeanTrait } from "../../src/ride/lean";
import { releaseSling } from "../../src/ride/sling";
import { frames, startRide } from "./rider";
import { it } from "@spawnite/engine/testing";

//  Old Lean.test, with the run end's freeze as what it did to the lean.
it("rolls into the steer only while it is enabled", async ({ createGame }) => {
    const { game, rider } = await startRide(createGame);
    releaseSling(rider);
    sendInput(game, { intent: new Vector2(1, 0), steering: true });
    rider.set(LeanTrait, { enabled: false });
    stepSeconds(game, frames(30));
    expect(rider.get(TrackMoverTrait)?.steer).toBe(1);
    expect(rider.get(LeanTrait)?.roll).toBe(0);

    rider.set(LeanTrait, { enabled: true });
    stepSeconds(game, frames(30));
    expect(rider.get(LeanTrait)?.roll).toBeGreaterThan(0);

    //  A run end holds the roll where it was, not where the steer points.
    rider.set(LeanTrait, { enabled: false });
    const held = rider.get(LeanTrait)?.roll;
    stepSeconds(game, frames(30));
    expect(rider.get(LeanTrait)?.roll).toBe(held);
    game.world.destroy();
});
