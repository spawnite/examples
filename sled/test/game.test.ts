// @vitest-environment node
import { expect } from "vitest";
import {
    sendInput,
    stepSeconds,
    TrackMoverTrait,
    TrackRefTrait,
    TrackTriggerTrait,
} from "@spawnite/engine/core";
import { it } from "@spawnite/engine/testing";
import {
    CourseKind,
    CourseTrait,
    readCourseRegion,
    RunMachine,
} from "../src/ride/course";
import { RigTrait } from "../src/ride/rig";
import { releaseSling } from "../src/ride/sling";
import { frames, launch, startRide } from "./ride/rider";

//  The pose reads what the move and the course left, so a takeoff or a hit
//  shows in the step it happens, not the one after.

it("stretches the rider in the step its jump leaves the snow", async ({
    createGame,
}) => {
    const { game, rider } = await startRide(createGame);
    releaseSling(rider);
    rider.set(TrackMoverTrait, { speed: 10 });
    stepSeconds(game, frames(30));

    sendInput(game, { jump: true });
    stepSeconds(game, frames(1));

    expect(rider.get(TrackMoverTrait)?.height).toBeGreaterThan(0);
    expect(rider.get(RigTrait)?.impact).toBeGreaterThan(0);
    game.world.destroy();
});

it("squashes the rider in the step a rock stuns it", async ({ createGame }) => {
    const ride = await startRide(createGame);
    const { game, rider, track } = ride;
    const spot = { at: 40, side: 0 };
    game.world.spawn(
        CourseTrait({ kind: CourseKind.Slab }),
        TrackTriggerTrait(readCourseRegion(CourseKind.Slab, spot, track)),
        TrackRefTrait({ track }),
    );
    launch(ride);
    rider.set(TrackMoverTrait, { speed: 8, distance: 30 });
    stepSeconds(game, frames(1));

    rider.set(TrackMoverTrait, { distance: 40 });
    stepSeconds(game, frames(1));

    expect(rider.has(RunMachine.is.stunned)).toBe(true);
    expect(rider.get(RigTrait)?.impact).toBeLessThan(0);
    game.world.destroy();
});
