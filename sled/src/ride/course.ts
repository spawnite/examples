import { trait, type Entity, type World } from "koota";
import {
    failRound,
    finishRound,
    registerBehaviour,
    RoundState,
    RoundTrait,
    RunContext,
    TrackMoverTrait,
    TrackTriggerMovers,
    Wallet,
    type AiMetadata,
    type Behaviour,
    type System,
    type Track,
} from "@spawnite/engine/core";
import type { TrackLevel } from "@spawnite/schema";
import { rideHeight } from "./rider";

//  What the rider meets on the way down, each an engine TrackTrigger in
//  track coordinates: the rocks that stun or crash it, the coins, and the
//  finish gate. The regions are sled's numbers; the hit test is the
//  engine's.

export enum CourseKind {
    Slab = "slab",
    Rock = "rock",
    Boulder = "boulder",
    Coin = "coin",
    Finish = "finish",
}

export type RockKind = CourseKind.Slab | CourseKind.Rock | CourseKind.Boulder;

/** A spot on the course: metres along, metres across, and for a coin the
 *  metres it floats higher, over a rock only a jump clears. */
export interface CourseSpot {
    at: number;
    side: number;
    lift?: number;
}

/** Each rock's box in metres, across, up and along. The shape tells the
 *  rider what to do: a flat shelf to clear with room, a dome to clear with
 *  timing, a crag to go round, which ends the run on a touch. */
export const rockSizes: Record<RockKind, [number, number, number]> = {
    [CourseKind.Slab]: [4, 0.3, 1.4],
    [CourseKind.Rock]: [4, 0.5, 1.4],
    [CourseKind.Boulder]: [3, 3, 2.2],
};

/** A rock hits at 0.8 of what is drawn, so "I cleared it" reads fair. */
const hitScale = 0.8;
/** A step at 30 m/s covers half a metre, so a rock is at least that deep
 *  along, or the rider could pass it between two tests. */
const minimumHalfDepth = 0.5;
/** The sled is a metre square on the snow; the engine tests its middle. */
const riderHalf = 0.5;
/** A coin's reach from its middle, across, up and along: bigger than the
 *  coin, so a graze collects. */
const coinReach = { across: 0.6, up: 0.7, along: 0.5 };
/** Metres above the snow a coin floats, at the sled's middle. */
export const coinFloat = 0.6;

/** Seconds a hit stays live: a second hit inside it crashes the run. */
export const stunSeconds = 0.8;
/** A hit keeps this much of the speed. */
const stunSpeedCut = 0.5;
/** Blinks a second while stunned: the window made visible. */
const blinkRate = 8;

/** The trigger region of a spot of `kind`, in track coordinates. */
export function readCourseRegion(
    kind: CourseKind,
    { at, side, lift = 0 }: CourseSpot,
    track: Track,
) {
    if (kind === CourseKind.Finish) return { start: at, end: track.length };
    if (kind === CourseKind.Coin) {
        //  Against the rider's middle, which rides `rideHeight` over the
        //  snow plus the mover's height.
        const middle = coinFloat + lift - rideHeight;
        return {
            start: at - coinReach.along - riderHalf,
            end: at + coinReach.along + riderHalf,
            left: side - coinReach.across - riderHalf,
            right: side + coinReach.across + riderHalf,
            bottom: middle - coinReach.up,
            top: middle + coinReach.up,
        };
    }
    const [width, height, depth] = rockSizes[kind];
    const halfAlong =
        Math.max((depth / 2) * hitScale, minimumHalfDepth) + riderHalf;
    const halfAcross = (width / 2) * hitScale + riderHalf;
    return {
        start: at - halfAlong,
        end: at + halfAlong,
        left: side - halfAcross,
        right: side + halfAcross,
        top: height * hitScale,
    };
}

//  Each tier of rock under its own kind in the level's triggers.
const rockKinds: Record<string, RockKind> = {
    slabs: CourseKind.Slab,
    rocks: CourseKind.Rock,
    boulders: CourseKind.Boulder,
};

/** A level's rocks, each with its kind. */
export function readRocks(level: TrackLevel) {
    return Object.entries(rockKinds).flatMap(([name, kind]) =>
        (level.triggers[name] ?? []).map((spot) => ({ kind, spot })),
    );
}

/** What a course trigger is, so the step knows what an entry does. */
export const CourseTrait = trait({ kind: CourseKind.Coin });

/** Each kind for an agent: what it is and what the rider can do about it. */
const courseWords: Record<CourseKind, AiMetadata> = {
    [CourseKind.Slab]: {
        is: "a slab across the lane",
        actions: ["jump it", "go round it"],
    },
    [CourseKind.Rock]: {
        is: "a low rock",
        actions: ["jump it", "go round it"],
    },
    [CourseKind.Boulder]: {
        is: "a boulder",
        facts: ["ends the run on a touch"],
        actions: ["go round it"],
    },
    [CourseKind.Coin]: { is: "a coin", actions: ["collect it"] },
    [CourseKind.Finish]: { is: "the finish line" },
};

export const CourseBehaviour: Behaviour<typeof CourseTrait> = {
    trait: CourseTrait,
    source: "games/sled/src/ride/course.ts",
    description: "Stuns, crashes, pays or finishes the rider who enters it.",
    ai: ({ kind }) => courseWords[kind],
    runsOn: RunContext.Client,
};

/** Why a run failed, as the round keeps it: out of steam, or wiped out on
 *  the rocks. */
export enum RunEnd {
    Crashed = "crashed",
    Wiped = "wiped",
}

/** Metres a second down the run under which the sled is stalling, and the
 *  seconds it stalls before the run is out of steam. Along the track only,
 *  so neither sliding sideways nor jumping keeps a run alive. */
export const stallSpeed = 2;
export const stallSeconds = 1.5;

/** The rider's run: the stun left from its last hit, and the seconds it
 *  has been slower than `stallSpeed`. */
export const RunTrait = trait({ stunSeconds: 0, slowSeconds: 0 });

export const RunBehaviour: Behaviour<typeof RunTrait> = {
    trait: RunTrait,
    source: "games/sled/src/ride/course.ts",
    description: "Stuns the rider on a hit, and ends its run.",
    ai: ({ stunSeconds }) => ({ facts: stunSeconds > 0 ? ["stunned"] : [] }),
    runsOn: RunContext.Client,
};

//  Named in the dump and read by the AI tree, with no component mounted.
registerBehaviour("course", CourseBehaviour);
registerBehaviour("run", RunBehaviour);

/** Ends the round, won or failed for `reason`, and stops the rider dead
 *  where it ended. */
function endRun(world: World, rider: Entity, reason?: RunEnd) {
    if (reason) failRound(world, reason);
    else finishRound(world);
    rider.set(TrackMoverTrait, { enabled: false, speed: 0 });
}

/** A rock hits the rider: the first halves its speed and stuns it, and a
 *  second inside the stun, or any boulder, wipes the run out. True when it
 *  wiped out. */
export function hitRider(rider: Entity, lethal: boolean) {
    const chained = (rider.get(RunTrait)?.stunSeconds ?? 0) > 0;
    rider.set(RunTrait, { stunSeconds });
    if (!chained)
        rider.set(TrackMoverTrait, (mover) => ({
            speed: mover.speed * stunSpeedCut,
        }));
    return chained || lethal;
}

/** Whether the rider is drawn with `left` seconds of stun: it blinks while
 *  stunned. */
export function readRiderVisible(left: number) {
    return left <= 0 || Math.floor(left * blinkRate * 2) % 2 === 0;
}

function isPlaying(world: World) {
    const round = world.queryFirst(RoundTrait)?.get(RoundTrait);
    return round?.state === RoundState.Playing;
}

/** While the round plays: counts each rider's stun down, acts on each
 *  course trigger for each rider that came into it this step, then fails
 *  the run once a rider has stalled. The finish comes first, so crawling
 *  over the line on the step the stall runs out is a finish. After the
 *  engine's move, which marks the triggers. Each rider carries a wallet
 *  from its first step, so the HUD shows none rather than the last run's.
 */
export const rideCourse: System = (world, { deltaSeconds }) => {
    const riders = world.query(RunTrait, TrackMoverTrait);
    for (const rider of riders) if (!rider.has(Wallet)) rider.add(Wallet);
    if (!isPlaying(world)) return;
    for (const rider of riders)
        rider.set(RunTrait, (run) => ({
            stunSeconds: Math.max(0, run.stunSeconds - deltaSeconds),
        }));
    for (const entity of world.query(CourseTrait, TrackTriggerMovers)) {
        const kind = entity.get(CourseTrait)?.kind;
        for (const rider of entity.get(TrackTriggerMovers)?.entered ?? []) {
            if (!isPlaying(world)) return;
            if (!rider.has(RunTrait)) continue;
            if (kind === CourseKind.Finish) endRun(world, rider);
            else if (kind === CourseKind.Coin) {
                rider.set(Wallet, (wallet) => ({ coins: wallet.coins + 1 }));
                entity.destroy();
                break;
            } else if (hitRider(rider, kind === CourseKind.Boulder))
                endRun(world, rider, RunEnd.Wiped);
        }
    }
    for (const rider of riders) {
        if (!isPlaying(world)) return;
        const slow = (rider.get(TrackMoverTrait)?.speed ?? 0) < stallSpeed;
        rider.set(RunTrait, (run) => ({
            slowSeconds: slow ? run.slowSeconds + deltaSeconds : 0,
        }));
        //  Past it by more than half a step, as summed steps drift.
        const slowSeconds = rider.get(RunTrait)?.slowSeconds ?? 0;
        if (slowSeconds - deltaSeconds / 2 > stallSeconds)
            endRun(world, rider, RunEnd.Crashed);
    }
};
