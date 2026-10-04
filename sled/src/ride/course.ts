import { createQuery, trait, type Entity, type World } from "koota";
import {
    defineBehaviour,
    failRound,
    finishRound,
    readEach,
    RoundMachine,
    RunContext,
    states,
    TrackMoverTrait,
    TrackTriggerMoversTrait,
    updateEach,
    WalletTrait,
    type AiMetadata,
    type System,
    type Track,
} from "@spawnite/engine/core";
import type { TrackLevel } from "@spawnite/schema";
import { endBrake, rideHeight } from "./rider";

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

export const CourseBehaviour = defineBehaviour({
    name: "course",
    trait: CourseTrait,
    source: "src/ride/course.ts",
    description: "Stuns, crashes, pays or finishes the rider who enters it.",
    ai: ({ kind }) => courseWords[kind],
    runsOn: RunContext.Client,
});

/** Metres a second down the run under which the sled is stalling, and the
 *  seconds it stalls before the run is out of steam. Along the track only,
 *  so neither sliding sideways nor jumping keeps a run alive. */
export const stallSpeed = 2;
export const stallSeconds = 1.5;

/** The rider's run, from the sling to its end: on the sling, riding,
 *  stunned by a hit, or ended, `crashed` being out of steam, slow for
 *  longer than the stall. The sling's fire launches it; the course sends
 *  it each hit, the finish, and the end of its steam. The stun is a wait.
 *  An ended run's state is the reason the round keeps. */
export const RunMachine = states({
    id: "run",
    description: "The rider's run: on the sling, riding, stunned, then ended.",
    initial: "aiming",
    states: {
        aiming: { on: { LAUNCH: "riding" } },
        riding: {
            on: {
                HIT: "stunned",
                WIPE_OUT: "wiped",
                FINISH: "finished",
                OUT_OF_STEAM: "crashed",
            },
        },
        stunned: {
            wait: { seconds: stunSeconds, then: "riding" },
            on: {
                HIT: "wiped",
                WIPE_OUT: "wiped",
                FINISH: "finished",
                OUT_OF_STEAM: "crashed",
            },
        },
        finished: {},
        crashed: {},
        wiped: {},
    },
});

/** A state of the run, as its machine names it, such as `"crashed"`: the
 *  reason the round keeps for a run that ended short of the line. */
export type RunStateName = ReturnType<typeof RunMachine.read>["value"];

/** The rider's run: the run machine's snapshot. */
export const RunTrait = RunMachine.trait;

export const RunBehaviour = defineBehaviour({
    name: "run",
    trait: RunTrait,
    source: "src/ride/course.ts",
    description: "Runs the rider from the sling to its end.",
    runsOn: RunContext.Client,
});

function isSlow(rider: Entity) {
    return (rider.get(TrackMoverTrait)?.speed ?? 0) < stallSpeed;
}

/** Whether the rider's run is on, riding or stunned, and slower than
 *  `stallSpeed`. */
function isStalling(rider: Entity) {
    return isRiding(rider) && isSlow(rider);
}

/** The rider's pace, a machine beside the run so the stall counts on
 *  through a stun: a machine counts one wait at a time, and the stun is
 *  the run's. It stalls while the run rides slower than `stallSpeed`, and
 *  the course ends the run on a slow step once it has stalled. */
export const PaceMachine = states({
    id: "pace",
    description: "The rider's pace: sliding, or stalling slower than 2 m/s.",
    initial: "sliding",
    states: {
        sliding: { when: [[isStalling, "stalling"]] },
        stalling: {
            wait: { seconds: stallSeconds, then: "stalled" },
            when: [[(rider) => !isSlow(rider), "sliding"]],
        },
        stalled: { when: [[(rider) => !isSlow(rider), "sliding"]] },
    },
});

/** The rider's pace: the pace machine's snapshot. */
export const PaceTrait = PaceMachine.trait;

export const PaceBehaviour = defineBehaviour({
    name: "pace",
    trait: PaceTrait,
    source: "src/ride/course.ts",
    description: "Counts the rider's stall while it rides.",
    runsOn: RunContext.Client,
});

/** Whether `rider`'s run is between the launch and its end: riding or
 *  stunned. */
export function isRiding(rider: Entity) {
    return rider.has(RunMachine.is.riding) || rider.has(RunMachine.is.stunned);
}

function isEnded(rider: Entity) {
    return (
        rider.has(RunMachine.is.finished) ||
        rider.has(RunMachine.is.crashed) ||
        rider.has(RunMachine.is.wiped)
    );
}

/** A rock hits the rider: the first halves its speed and stuns it, and a
 *  second inside the stun, or any boulder, wipes the run out and stops the
 *  rider dead where it hit; `letGoEndedRuns` lets it drop to the snow
 *  there. True when it wiped out. */
export function hitRider(rider: Entity, lethal: boolean) {
    if (lethal) RunMachine.send(rider, "WIPE_OUT");
    else if (RunMachine.send(rider, "HIT") && rider.has(RunMachine.is.stunned))
        rider.set(TrackMoverTrait, (mover) => ({
            speed: mover.speed * stunSpeedCut,
        }));
    const wiped = rider.has(RunMachine.is.wiped);
    if (wiped) rider.set(TrackMoverTrait, { speed: 0 });
    return wiped;
}

/** Whether the rider is drawn with `left` seconds of stun: it blinks while
 *  stunned. */
export function readRiderVisible(left: number) {
    return left <= 0 || Math.floor(left * blinkRate * 2) % 2 === 0;
}

//  Created once, for the engine's walks, which build no array a step.
const riders = createQuery(RunTrait, TrackMoverTrait);
const runs = createQuery(RunTrait);
const triggers = createQuery(CourseTrait, TrackTriggerMoversTrait);
const stalled = createQuery(PaceMachine.is.stalled);
const pending: Entity[] = [];
//  Declared once, with no destructuring, so a step allocates no closure
//  and no iterator.
const collectWalletless = (_: unknown, rider: Entity) => {
    if (!rider.has(WalletTrait)) pending.push(rider);
};
const collectEntered = (
    traits: [unknown, { entered: Entity[] }],
    entity: Entity,
) => {
    if (traits[1].entered.length > 0) pending.push(entity);
};
const collectStalling = (_: unknown, rider: Entity) => {
    if (isStalling(rider)) pending.push(rider);
};

function isRoundPlaying(world: World) {
    return world.queryFirst(RoundMachine.is.playing) !== undefined;
}

/** Lets go of the steer and the jump of each rider whose run has ended,
 *  and brakes it, so it glides on under the end screen to rest on the
 *  snow, where its mover stops. A wiped rider has no speed left, so it
 *  only drops to the snow. Between the input and the move. */
export const letGoEndedRuns: System = (world, { deltaSeconds }) => {
    updateEach(world, riders, ([, mover], rider) => {
        if (!isEnded(rider)) return;
        mover.steer = 0;
        mover.jump = false;
        if (!mover.enabled) return;
        mover.speed = Math.max(0, mover.speed - endBrake * deltaSeconds);
        //  Stopped on the snow, or the slope's pull would creep it on at
        //  rest.
        if (mover.speed === 0 && mover.height <= 0) mover.enabled = false;
    });
};

/** Hands each ended run to the round, once, while it plays: won over the
 *  line, or failed with the run's state as the reason. */
function endRuns(world: World) {
    readEach(world, runs, (_, rider) => {
        if (!isEnded(rider) || !isRoundPlaying(world)) return;
        if (rider.has(RunMachine.is.finished)) finishRound(world);
        else failRound(world, RunMachine.read(rider).value);
    });
}

/** Acts on each course trigger for each riding rider that came into it
 *  this step, then ends the run of one that is still slow once its pace
 *  has stalled: slow for longer
 *  than the stall. The finish comes first, so crawling over the line on
 *  the step the stall runs out is a finish. After the engine's move, which
 *  marks the triggers, and before the round's clock, so the round ends in
 *  the step the run does. Each rider carries a wallet from its first
 *  step, so the HUD shows none rather than the last run's. */
export const rideCourse: System = (world) => {
    //  Collected, then changed: the walks never add, remove or destroy
    //  under themselves.
    pending.length = 0;
    readEach(world, riders, collectWalletless);
    for (const rider of pending) rider.add(WalletTrait);
    pending.length = 0;
    readEach(world, triggers, collectEntered);
    for (const entity of pending) {
        const kind = entity.get(CourseTrait)?.kind;
        for (const rider of entity.get(TrackTriggerMoversTrait)?.entered ??
            []) {
            if (!isRiding(rider)) continue;
            if (kind === CourseKind.Finish) RunMachine.send(rider, "FINISH");
            else if (kind === CourseKind.Coin) {
                rider.set(WalletTrait, (wallet) => ({
                    coins: wallet.coins + 1,
                }));
                entity.destroy();
                break;
            } else hitRider(rider, kind === CourseKind.Boulder);
        }
    }
    //  A send rather than a `when` on the run: the machines step after the
    //  round's clock, and the round ends in the step the run does.
    pending.length = 0;
    readEach(world, stalled, collectStalling);
    for (const rider of pending) RunMachine.send(rider, "OUT_OF_STEAM");
    endRuns(world);
};
