import type { Entity } from "koota";
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
import { buildRun, levels, Track } from "../../src/levels";
import { LeanTrait } from "../../src/ride/lean";
import { rideGravity, riderStats, spawnDistance } from "../../src/ride/rider";
import { readAimSpan, SlingTrait } from "../../src/ride/sling";
import { systems } from "../../src/systems";

/** A level's rider at the start line, as the Rider component mounts it,
 *  and its round waiting for the sling, on sled's own systems: the
 *  headless half of the old tests' Player and RunDirector. Level 1 unless
 *  another is named. */
export async function startRide(level = levels[Track.One]) {
    const { track } = buildRun(level.track.points);
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
    return { game, rider, track, level };
}

type Ride = Awaited<ReturnType<typeof startRide>>;

/** The ride's level's rocks, coins and finish, each a trigger on the ride's
 *  track as its component mounts it. */
export function layCourse({ game, level, track }: Ride) {
    const spots: { kind: CourseKind; spot: CourseSpot }[] = [
        ...readRocks(level),
        ...(level.triggers.pickups ?? []).map((spot) => ({
            kind: CourseKind.Coin,
            spot,
        })),
        { kind: CourseKind.Finish, spot: { at: level.finish.at, side: 0 } },
    ];
    for (const { kind, spot } of spots)
        game.world.spawn(
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
