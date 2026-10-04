import { createQuery, type Entity } from "koota";
import {
    addStatModifier,
    createTrackFrame,
    readStat,
    removeStatModifiers,
    TrackMoverTrait,
    TrackRefTrait,
    updateEach,
    type System,
} from "@spawnite/engine/core";
import { isRiding, RunTrait } from "./course";

//  The Speed upgrade: one track of steps, each pulling the sled 2% harder
//  down a slope and lowering the air's drag by as much again, compounding,
//  as Hill Climb Racing's engine upgrade is felt on every slope. A climb
//  pulls back as hard at every step, so an upgraded sled reaches a climb
//  faster rather than climbing it worse. The sling fires at its base power
//  and the steer does not scale.

/** The steps the Speed track has: the last one pulls 1.02²⁵, about 1.64
 *  times, as hard down a slope as none. */
export const speedSteps = 25;

/** What each step adds to `drag` as a `more`, about −0.039: top speed goes
 *  as one over the square root of drag, so the drag alone raises it 2%. */
export const speedStepDrag = 1 / 1.02 ** 2 - 1;

/** What each step adds to `downhill` as a `more`. */
export const speedStepDownhill = 0.02;

/** The source the curve's modifiers are added under. */
const source = "speed";

/** Sets `rider` at Speed `step`, 0 to `speedSteps`, in place of any step
 *  it had: one `drag` and one `downhill` modifier, each holding every
 *  step's `more`, compounded. */
export function setSpeedStep(rider: Entity, step: number) {
    if (!Number.isInteger(step) || step < 0 || step > speedSteps)
        throw new RangeError(
            `Speed step ${step} is off the curve: pass a whole step from 0 to ${speedSteps}.`,
        );
    removeStatModifiers(rider, source);
    if (step === 0) return;
    addStatModifier(rider, "drag", {
        source,
        more: (1 + speedStepDrag) ** step - 1,
    });
    addStatModifier(rider, "downhill", {
        source,
        more: (1 + speedStepDownhill) ** step - 1,
    });
}

const riders = createQuery(RunTrait, TrackMoverTrait, TrackRefTrait);
//  Written in place, once per rider.
const frame = createTrackFrame();

/** Adds the pull past the engine's own a riding sled's `downhill` asks
 *  for, on the ground going down a slope: (downhill − 1) × gravity along
 *  the slope, on the slope the engine's move reads, before it. Not on the
 *  sling, nor once the run has ended. */
export const pullDownhill: System = (world, { deltaSeconds }) => {
    updateEach(world, riders, ([, mover, { track }], rider) => {
        if (!track || !mover.enabled || mover.height > 0 || !isRiding(rider))
            return;
        //  ponytail: the mover keeps no slope, so the frame is read again
        //  here; a slope on TrackMoverTrait would spare the second read.
        const fall = -track.frameAt(mover.distance, frame).tangent.y;
        if (fall <= 0) return;
        const extra = (readStat(rider, "downhill") ?? 1) - 1;
        mover.speed += extra * mover.gravity * fall * deltaSeconds;
    });
};

//  The economy the tracks are tuned to: the coins each step costs, and the
//  step a player is expected to hold on reaching each track.

/** Steps in each tier of the curve's price. */
export const speedTierSteps = 5;

/** Coins one step costs in each tier: steps 1 to 5 cost 1 each, 6 to 10
 *  cost 3, and so on, 410 to the last step. */
export const speedTierCosts = [1, 3, 8, 20, 50] as const;

/** The share of a track's coins a player is expected to take on a pass. */
export const expectedCoinShare = 0.6;

/** Coins Speed `step`, 1 to `speedSteps`, costs from the one below it. */
export function readSpeedStepCost(step: number) {
    return speedTierCosts[Math.floor((step - 1) / speedTierSteps)];
}

/** The highest step `coins` buy from none. */
export function readAffordableStep(coins: number) {
    let step = 0;
    let left = coins;
    while (step < speedSteps && left >= readSpeedStepCost(step + 1)) {
        step += 1;
        left -= readSpeedStepCost(step);
    }
    return step;
}

/** The step each track is tuned to finish at, from each track's coins in
 *  the order they unlock: none for the first, and for each later one, a
 *  step past what the expected share of the earlier tracks' coins buys,
 *  so a track asks about one replay, never below the track before. */
export function readExpectedSteps(coinsPerTrack: readonly number[]) {
    const steps: number[] = [];
    let coins = 0;
    for (const trackCoins of coinsPerTrack) {
        const affordable = readAffordableStep(
            Math.floor(coins * expectedCoinShare),
        );
        steps.push(
            steps.length === 0
                ? 0
                : Math.min(
                      speedSteps,
                      Math.max(steps[steps.length - 1], affordable + 1),
                  ),
        );
        coins += trackCoins;
    }
    return steps;
}
