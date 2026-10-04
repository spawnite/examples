// @vitest-environment node
import { afterAll, expect } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import {
    aimAlongTrack,
    createTrackFrame,
    Track,
    trackCameraSettings,
    type LevelId,
} from "@spawnite/engine";
import { RoundState } from "@spawnite/engine/core";
import { levels, levelSpeedSteps } from "../../src/levels";
import { readRocks, rockSizes } from "../../src/ride/course";
import { rideHeight, spawnDistance } from "../../src/ride/rider";
import { frames, rideToEnd } from "../ride/rider";
import { it } from "@spawnite/engine/testing";

//  Every rock is fair: a rider riding a track's clean line at its expected
//  step has it in view for at least `warningSeconds` before reaching it, on
//  a phone held upright and on a wide screen alike. The view is the chase
//  camera's, the engine's `aimAlongTrack` for a rider on the centreline,
//  through sled's 52° lens at the screen's aspect. A rock is in view while its top is in that
//  frame and no stretch of the track between rises above the line from the
//  eye to it. The fog, the hillside and the camera's easing are left out:
//  the bend and the crest are what hide a rock on these tracks.

/** The old game's warning floor, `WARNING_S` in its reach rig: the
 *  seconds of sight a rider gets before any rock. */
const warningSeconds = 1.5;

/** Sled's lens, the Run scene's: degrees from the bottom of the screen to
 *  the top, so a narrower screen sees less to either side. */
const lensDegrees = 52;

/** The screens sled is played on, width over height. */
const aspects = {
    "a phone held upright": 390 / 844,
    "a 16:9 screen": 16 / 9,
};
type Screen = keyof typeof aspects;

/** Metres between the places along the track the view is read from. */
const viewSpacing = 0.25;

/** A rock as drawn: metres along and across the track to its middle,
 *  and its width and height in metres. */
interface Rock {
    at: number;
    side: number;
    width: number;
    height: number;
}

const frame = createTrackFrame();
//  Rewritten by each read.
const lens = new PerspectiveCamera(lensDegrees);
const eye = new Vector3();
const aim = new Vector3();
const seen = new Vector3();
const rider = new Vector3();

/** The centreline `distance` along `track`, carried on along the start's
 *  tangent before it, as the camera's eye stands behind a rider at the
 *  start. Written into `into`. */
function readCentre(track: Track, distance: number, into: Vector3) {
    const clamped = Math.max(0, distance);
    const { position, tangent } = track.frameAt(clamped, frame);
    return into.copy(position).addScaledVector(tangent, distance - clamped);
}

/** Whether the camera chasing a rider `distance` along `track` sees
 *  `target`, `at` metres along: in its frame, with no stretch of the
 *  track between rising above the line from the eye to it. */
function isInView(track: Track, distance: number, target: Vector3, at: number) {
    const eyeAt = distance - trackCameraSettings.behind;
    readCentre(track, distance, rider).y += rideHeight;
    aimAlongTrack(track, distance, rider, eye, aim);
    lens.position.copy(eye);
    lens.lookAt(aim);
    lens.updateMatrixWorld();
    const { x, y, z } = seen.copy(target).project(lens);
    if (Math.abs(x) > 1 || Math.abs(y) > 1 || z > 1) return false;
    for (let along = Math.max(0, eyeAt); along < at; along += viewSpacing) {
        const share = (along - eyeAt) / (at - eyeAt);
        const sight = eye.y + share * (target.y - eye.y);
        if (track.frameAt(along, frame).position.y > sight) return false;
    }
    return true;
}

/** Points read along a rock's top edge, end to end, for whether any of it
 *  is in view. */
const edgePoints = 5;

/** Where along `track` a rider first has `rock` in view for good: the
 *  start of the last stretch some of its top edge is in view before the
 *  rider reaches it, so a rock a bend hides again is seen only once it
 *  comes back, and the sling when that stretch began there. Undefined
 *  when it is never in view. */
function readSeenAt(track: Track, { at, side, height, width }: Rock) {
    const edge = Array.from({ length: edgePoints }, (_, index) => {
        const across = side + width * (index / (edgePoints - 1) - 0.5);
        const point = track.pointAt(at, across);
        point.y += height;
        return point;
    });
    const isRockInView = (distance: number) =>
        edge.some((point) => isInView(track, distance, point, at));
    let wasInView = isRockInView(spawnDistance);
    let seenAt = wasInView ? spawnDistance : undefined;
    for (
        let distance = spawnDistance + viewSpacing;
        distance < at;
        distance += viewSpacing
    ) {
        const inView = isRockInView(distance);
        if (inView && !wasInView) seenAt = distance;
        wasInView = inView;
    }
    return seenAt;
}

/** Seconds into the ride `distances`, one a step, the rider first reached
 *  `distance`. */
function readSecondsAt(distances: number[], distance: number) {
    const step = distances.findIndex((reached) => reached >= distance);
    return step < 0 ? Infinity : frames(step);
}

/** Seconds a rider riding `distances` along `track` has `rock` in view
 *  before reaching it, on a screen `aspect` wide: without end when it is
 *  in view from the sling, where the rider waits to fire. Throws when the
 *  camera never shows the rock, or the ride stops short of it. */
function readWarning(
    track: Track,
    rock: Rock,
    distances: number[],
    aspect: number,
) {
    lens.aspect = aspect;
    lens.updateProjectionMatrix();
    const where = `The rock at ${rock.at} m, ${rock.side} m across`;
    const seenAt = readSeenAt(track, rock);
    if (seenAt === undefined)
        throw new Error(
            `${where} is never in view before the rider reaches it.`,
        );
    //  The rider passes where it saw the rock before it reaches the rock.
    const reached = readSecondsAt(distances, rock.at);
    if (!Number.isFinite(reached))
        throw new Error(
            `${where} is never reached: the ride stopped at ${distances.at(-1)} m.`,
        );
    if (seenAt === spawnDistance) return Infinity;
    return reached - readSecondsAt(distances, seenAt);
}

const straight = new Track([
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: -100 },
]);

it("fails a rock the camera never shows", () => {
    expect(() =>
        readWarning(
            straight,
            { at: 10, side: 100, width: 4, height: 3 },
            [6, 20],
            aspects["a 16:9 screen"],
        ),
    ).toThrow(/never in view/);
});

it("counts a rock in view from the sling as seen without end", () => {
    expect(
        readWarning(
            straight,
            { at: 30, side: 0, width: 4, height: 1 },
            [6, 20, 40],
            aspects["a phone held upright"],
        ),
    ).toBe(Infinity);
});

it("fails a rock the ride stops short of", () => {
    expect(() =>
        readWarning(
            straight,
            { at: 50, side: 0, width: 4, height: 1 },
            [6],
            aspects["a 16:9 screen"],
        ),
    ).toThrow(/stopped/);
});

//  The tightest warning on each track, printed once every track has ridden.
const rows: string[] = [];
afterAll(() => {
    const screens = Object.keys(aspects);
    console.log(
        [
            `| Track | Expected step | ${screens.map((screen) => `Tightest on ${screen} | Rock, metres along and across`).join(" | ")} |`,
            `| --- | --- | ${screens.map(() => "--- | ---").join(" | ")} |`,
            ...rows,
        ].join("\n"),
    );
});

it.for(
    Object.entries(levels).map(([id, { name }]) => ({
        //  `entries` keys by string; the keys are `levels`' own ids.
        id: id as LevelId,
        name,
    })),
)(
    "shows the rider every rock on $name for at least the warning floor at its expected step",
    async ({ id, name }, { createGame }) => {
        const step = levelSpeedSteps[id];
        const { track, level, distances, round } = await rideToEnd(createGame, {
            track: id,
            full: true,
            clear: true,
            step,
        });
        expect(round?.state, `${name} at step ${step}`).toBe(RoundState.Won);
        const rocks = readRocks(level).map(({ kind, spot }) => {
            const [width, height] = rockSizes[kind];
            return { ...spot, width, height };
        });
        const cells: string[] = [];
        const short: string[] = [];
        for (const [screen, aspect] of Object.entries(aspects) as [
            Screen,
            number,
        ][]) {
            let tightest = { rock: "every rock", seconds: Infinity };
            for (const rock of rocks) {
                const seconds = readWarning(track, rock, distances, aspect);
                const named = `${rock.at} m, ${rock.side.toFixed(1)} m`;
                if (seconds < tightest.seconds)
                    tightest = { rock: named, seconds };
                if (seconds < warningSeconds)
                    short.push(
                        `${named} on ${screen}: ${seconds.toFixed(2)} s`,
                    );
            }
            cells.push(
                Number.isFinite(tightest.seconds)
                    ? `${tightest.seconds.toFixed(2)} s`
                    : "from the sling",
                tightest.rock,
            );
        }
        rows.push(`| ${name} | ${step} | ${cells.join(" | ")} |`);

        expect(
            short,
            `${name}'s rocks seen for less than ${warningSeconds} s`,
        ).toEqual([]);
    },
);
