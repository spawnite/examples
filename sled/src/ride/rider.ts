import {
    registerStatField,
    TrackMoverTrait,
    type StatBase,
} from "@spawnite/engine/core";

/** Metres down the track the rider starts, leaving track behind it for the
 *  sling's pull-back. */
export const spawnDistance = 6;

/** How hard gravity pulls the sled: Earth's, times the old sled's pace
 *  lever of 1.6, the one number that sets how fast the run feels. */
export const rideGravity = 9.81 * 1.6;

/** The m/s² an ended run brakes at, over the finish or out of steam, on
 *  top of the slope's pull: a finisher at 12 m/s glides to rest about 11 m
 *  past the gate, inside the run-out, and one past about 16 m/s reaches
 *  the track's end, which stops it. A constant brake, as Unreal's
 *  `BrakingDecelerationWalking`, reaches rest; a drag fades with speed. */
export const endBrake = 10;

/** Metres the mover carries the rider's middle above the snow. */
export const rideHeight = 0.5;

/** The rider's numbers: `launch` is the metres a second a full pull fires
 *  at, which no upgrade raises, `side` the metres a second across, `drag`
 *  the air's 1/m quadratic drag, which the Speed curve in `speed.ts`
 *  lowers, and `downhill` the multiple of the slope's pull the sled rides
 *  down a slope with, which the curve raises. */
export const riderStats = {
    launch: { base: 6.5, min: 0 },
    side: { base: 3.5, min: 0 },
    drag: { base: 0.004, min: 0 },
    downhill: { base: 1, min: 0 },
} satisfies Record<string, StatBase>;

//  So each step hands the rider's side and drag stats to its mover.
registerStatField("side", TrackMoverTrait, "sideSpeed");
registerStatField("drag", TrackMoverTrait, "drag");
