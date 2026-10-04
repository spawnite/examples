import type { Entity } from "koota";
import {
    AuthorityTrait,
    declareStats,
    RoundState,
    RoundTrait,
    RunContext,
    sendInput,
    startRound,
    stepSeconds,
    TransformTrait,
    TrackMoverTrait,
    TrackRefTrait,
    TrackTriggerTrait,
    WalletTrait,
} from "@spawnite/engine/core";
import type { CreateGame } from "@spawnite/engine/testing";
import {
    CourseKind,
    CourseTrait,
    readCourseRegion,
    PaceTrait,
    readRocks,
    RunMachine,
    RunTrait,
    type CourseSpot,
} from "../../src/ride/course";
import { buildRun, levelMaps, levels, Track } from "../../src/levels";
import { snow } from "../../src/maps";
import { LeanTrait } from "../../src/ride/lean";
import { RigTrait } from "../../src/ride/rig";
import { rideGravity, riderStats, spawnDistance } from "../../src/ride/rider";
import { aimSling, readAimSpan, SlingTrait } from "../../src/ride/sling";
import { setSpeedStep } from "../../src/ride/speed";
import { plugins } from "../../src/game";

/** A level's rider at the start line, as the Rider component mounts it,
 *  and its round waiting for the sling, on sled's own plugins: the
 *  headless half of the old tests' Player and RunDirector. Level 1 on
 *  snow unless another level and map are named. */
export async function startRide(
    createGame: CreateGame,
    level = levels[Track.One],
    map = snow,
) {
    const { track } = buildRun(level.track.points, map);
    let rider: Entity | undefined;
    const game = await createGame({
        plugins,
        scene: (world) => {
            world.spawn(
                RoundTrait({ seconds: 0, target: 0, state: RoundState.Ready }),
            );
            rider = world.spawn(
                TransformTrait,
                AuthorityTrait({ context: RunContext.Client }),
                TrackMoverTrait({
                    distance: spawnDistance,
                    enabled: false,
                    gravity: rideGravity,
                }),
                TrackRefTrait({ track }),
                SlingTrait({ aimSpan: readAimSpan(level.track.points) }),
                LeanTrait,
                RigTrait,
                RunTrait,
                PaceTrait,
                WalletTrait,
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
            TrackRefTrait({ track }),
        );
}

/** Takes the ride's rider off the sling and starts its round, as the
 *  sling's fire does, and leaves its mover where the test holds it. */
export function launch({ game, rider }: Pick<Ride, "game" | "rider">) {
    RunMachine.send(rider, "LAUNCH");
    startRound(game.world);
}

/** The old tests' `tick` counted the template's frames, each a sixtieth
 *  of a second: one fixed step here. */
export function frames(count: number) {
    return count / 60;
}

/** Rides a track, track 1 unless another is named, on its own map, from
 *  the sling to the step its round ends: fired with a full pull or a bare
 *  Space, at Speed `step`, with a slab laid `slabAt` metres down, and with
 *  only the finish laid when `clear`, the fastest a track rides. */
export async function rideToEnd(
    createGame: CreateGame,
    {
        full = false,
        slabAt,
        track: id = Track.One,
        clear = false,
        step = 0,
    }: RideOptions = {},
) {
    const ride = await startRide(createGame, levels[id], levelMaps[id]);
    const { game, rider, track, level } = ride;
    if (clear)
        game.world.spawn(
            CourseTrait({ kind: CourseKind.Finish }),
            TrackTriggerTrait(
                readCourseRegion(
                    CourseKind.Finish,
                    { at: level.finish.at, side: 0 },
                    track,
                ),
            ),
            TrackRefTrait({ track }),
        );
    else layCourse(ride);
    if (slabAt !== undefined)
        game.world.spawn(
            CourseTrait({ kind: CourseKind.Slab }),
            TrackTriggerTrait(
                readCourseRegion(
                    CourseKind.Slab,
                    { at: slabAt, side: 0 },
                    track,
                ),
            ),
            TrackRefTrait({ track }),
        );
    setSpeedStep(rider, step);
    stepSeconds(game, frames(1));
    if (full) aimSling(rider, 1);
    sendInput(game, { jump: true });
    const round = () => game.world.queryFirst(RoundTrait)?.get(RoundTrait);
    const mover = () => rider.get(TrackMoverTrait);
    //  Where the rider stood after each step, a sixtieth of a second apart.
    const distances: number[] = [];
    let steps = 0;
    do {
        stepSeconds(game, frames(1));
        distances.push(mover()?.distance ?? 0);
        steps += 1;
    } while (round()?.state === RoundState.Playing && steps < 6000);
    return {
        game,
        rider,
        track,
        level: ride.level,
        steps,
        distances,
        round: round(),
        mover,
        end: mover(),
    };
}

export interface RideOptions {
    full?: boolean;
    slabAt?: number;
    track?: keyof typeof levels;
    clear?: boolean;
    step?: number;
}
