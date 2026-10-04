// @vitest-environment node
import { expect } from "vitest";
import {
    AuthorityTrait,
    declareStats,
    readStat,
    RunContext,
    stepSeconds,
    TransformTrait,
    TrackMoverTrait,
    TrackRefTrait,
} from "@spawnite/engine/core";
import { it, type CreateGame } from "@spawnite/engine/testing";
import { plugins } from "../../src/game";
import { buildRun } from "../../src/levels";
import { RunMachine, RunTrait } from "../../src/ride/course";
import { rideGravity, riderStats } from "../../src/ride/rider";
import {
    readAffordableStep,
    readExpectedSteps,
    setSpeedStep,
    speedSteps,
} from "../../src/ride/speed";

//  A 3 km ice straight at one in five, so the ground costs nothing and the
//  air's drag alone sets the top speed.
const { track } = buildRun([
    { x: 0, y: 0, z: 0, width: 6, zone: "ice" },
    { x: 0, y: -600, z: -2940, width: 6, zone: "ice" },
]);

/** The speed a rider at Speed `step` holds after a minute down the
 *  straight, long past reaching its top speed. */
async function topSpeedAt(createGame: CreateGame, step: number) {
    const game = await createGame({
        plugins,
        scene: (world) => {
            const rider = world.spawn(
                TransformTrait,
                AuthorityTrait({ context: RunContext.Client }),
                TrackMoverTrait({ distance: 1, gravity: rideGravity }),
                TrackRefTrait({ track }),
            );
            declareStats(rider, riderStats);
            setSpeedStep(rider, step);
        },
    });
    stepSeconds(game, 60);
    const rider = game.world.queryFirst(TrackMoverTrait)!;
    expect(rider.get(TrackMoverTrait)!.distance).toBeLessThan(track.length);
    return { speed: rider.get(TrackMoverTrait)!.speed, rider };
}

it("rides about 1.64 times as fast on the lower drag alone at the last Speed step as at none, on the same straight", async ({
    createGame,
}) => {
    const none = await topSpeedAt(createGame, 0);
    const top = await topSpeedAt(createGame, speedSteps);
    expect(speedSteps).toBe(25);
    expect(top.speed / none.speed).toBeCloseTo(1.64, 2);
});

it("sets a step rather than adding one, so setting it again changes nothing", async ({
    createGame,
}) => {
    const { rider } = await topSpeedAt(createGame, 3);
    setSpeedStep(rider, 3);
    expect(readStat(rider, "drag")).toBeCloseTo(0.004 / 1.02 ** 6, 9);
    expect(readStat(rider, "downhill")).toBeCloseTo(1.02 ** 3, 9);
    setSpeedStep(rider, 0);
    expect(readStat(rider, "drag")).toBe(0.004);
    expect(readStat(rider, "downhill")).toBe(1);
});

//  The descent's mirror: a one-in-five ice climb.
const { track: climb } = buildRun([
    { x: 0, y: 0, z: 0, width: 6, zone: "ice" },
    { x: 0, y: 600, z: -2940, width: 6, zone: "ice" },
]);

/** Seconds each pull is measured over: short and slow, so the air's drag,
 *  which the steps also lower, moves the speed by under 5 mm/s. */
const window = 0.25;
const dragGap = 0.005;

/** Metres a second a rider at Speed `step` gains over `window` on
 *  `slope`, set going at `from` m/s, its run riding, still on the sling,
 *  or finished. */
async function gainAt(
    createGame: CreateGame,
    {
        step,
        slope = track,
        from = 0,
        run = "riding",
    }: {
        step: number;
        slope?: typeof track;
        from?: number;
        run?: "aiming" | "riding" | "finished";
    },
) {
    const game = await createGame({
        plugins,
        scene: (world) => {
            const rider = world.spawn(
                TransformTrait,
                AuthorityTrait({ context: RunContext.Client }),
                TrackMoverTrait({
                    distance: 1,
                    gravity: rideGravity,
                    speed: from,
                }),
                TrackRefTrait({ track: slope }),
                RunTrait,
            );
            declareStats(rider, riderStats);
            setSpeedStep(rider, step);
            if (run !== "aiming") RunMachine.send(rider, "LAUNCH");
            if (run === "finished") RunMachine.send(rider, "FINISH");
        },
    });
    stepSeconds(game, window);
    const rider = game.world.queryFirst(TrackMoverTrait)!;
    return rider.get(TrackMoverTrait)!.speed - from;
}

it("pulls 1.02²⁵, about 1.64 times, as hard down a slope at the last Speed step as at none", async ({
    createGame,
}) => {
    const none = await gainAt(createGame, { step: 0 });
    const top = await gainAt(createGame, { step: speedSteps });
    expect(none).toBeGreaterThan(0.5);
    expect(top / none).toBeCloseTo(1.02 ** 25, 2);
});

it("slows on a climb as hard at the last Speed step as at none", async ({
    createGame,
}) => {
    const none = await gainAt(createGame, { step: 0, slope: climb, from: 2 });
    const top = await gainAt(createGame, {
        step: speedSteps,
        slope: climb,
        from: 2,
    });
    expect(none).toBeLessThan(-0.5);
    expect(Math.abs(top - none)).toBeLessThan(dragGap);
});

it("adds no pull to a rider still on the sling, or to one whose run has ended", async ({
    createGame,
}) => {
    for (const run of ["aiming", "finished"] as const) {
        const none = await gainAt(createGame, { step: 0, from: 2, run });
        const top = await gainAt(createGame, {
            step: speedSteps,
            from: 2,
            run,
        });
        expect(Math.abs(top - none), run).toBeLessThan(dragGap);
    }
});

it("refuses a step off the curve, naming the range", async ({ createGame }) => {
    const { rider } = await topSpeedAt(createGame, 0);
    expect(() => setSpeedStep(rider, 26)).toThrow(/0 to 25/);
    expect(() => setSpeedStep(rider, 1.5)).toThrow(/0 to 25/);
});

it("prices the curve at 410 coins to its last step, in tiers of five", () => {
    expect(readAffordableStep(409)).toBe(24);
    expect(readAffordableStep(410)).toBe(25);
    expect(readAffordableStep(5)).toBe(5);
    expect(readAffordableStep(7)).toBe(5);
    expect(readAffordableStep(8)).toBe(6);
});

it("expects each track a step past what 60% of the earlier tracks' coins buy", () => {
    expect(
        readExpectedSteps([7, 13, 13, 8, 16, 10, 26, 60, 35, 35, 52, 59]),
    ).toEqual([0, 5, 8, 10, 11, 12, 13, 15, 17, 18, 19, 21]);
    //  Never past the last step, and never below the track before.
    expect(readExpectedSteps([1000, 0, 1000])).toEqual([0, 25, 25]);
    expect(readExpectedSteps([0, 0, 0])).toEqual([0, 1, 1]);
});
