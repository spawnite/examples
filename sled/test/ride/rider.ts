import type { Entity, World } from "koota";
import {
    Authority,
    createHeadlessGame,
    declareStats,
    RoundState,
    RoundTrait,
    RunContext,
    Transform,
    TrackMoverTrait,
    TrackRef,
    TrackTriggerTrait,
    Wallet,
} from "@spawnite/engine/core";
import {
    CourseKind,
    CourseTrait,
    readCourseRegion,
    readRocks,
    RunTrait,
    type CourseSpot,
} from "../../src/ride/course";
import { buildRun, levels } from "../../src/levels";
import { LeanTrait } from "../../src/ride/lean";
import { rideGravity, riderStats, spawnDistance } from "../../src/ride/rider";
import { readAimSpan, SlingTrait } from "../../src/ride/sling";
import { systems } from "../../src/systems";

const level = levels[0];
const { track } = buildRun(level.track.points);

/** Level 1's rider at the start line, as the Rider component mounts it,
 *  and its round waiting for the sling, on sled's own systems: the
 *  headless half of the old tests' Player and RunDirector. */
export async function startRide() {
    let rider: Entity | undefined;
    const game = await createHeadlessGame({
        systems,
        scene: (world) => {
            world.spawn(
                RoundTrait({ seconds: 0, target: 0, state: RoundState.Ready }),
            );
            rider = world.spawn(
                Transform,
                Authority({ context: RunContext.Client }),
                TrackMoverTrait({
                    distance: spawnDistance,
                    enabled: false,
                    gravity: rideGravity,
                }),
                TrackRef({ track }),
                SlingTrait({ aimSpan: readAimSpan(level.track.points) }),
                LeanTrait,
                RunTrait,
                Wallet,
            );
            declareStats(rider, riderStats);
        },
    });
    if (!rider) throw new Error("The scene spawned no rider.");
    return { game, rider, track };
}

/** Level 1's rocks, coins and finish, each a trigger as its component
 *  mounts it. */
export function layCourse(world: World) {
    const spots: { kind: CourseKind; spot: CourseSpot }[] = [
        ...readRocks(level),
        ...(level.triggers.pickups ?? []).map((spot) => ({
            kind: CourseKind.Coin,
            spot,
        })),
        { kind: CourseKind.Finish, spot: { at: level.finish.at, side: 0 } },
    ];
    for (const { kind, spot } of spots)
        world.spawn(
            CourseTrait({ kind }),
            TrackTriggerTrait(readCourseRegion(kind, spot, track)),
            TrackRef({ track }),
        );
}

/** The old tests' `tick` counted the template's frames, each a sixtieth
 *  of a second: one fixed step here. */
export function frames(count: number) {
    return count / 60;
}
