import {
    readStat,
    registerStatField,
    StatsTrait,
    TrackMoverTrait,
    type StatBase,
    type System,
} from "@spawnite/engine/core";

/** Metres down the track the rider starts, leaving track behind it for the
 *  sling's pull-back. */
export const spawnDistance = 6;

/** How hard gravity pulls the sled: Earth's, times the old sled's pace
 *  lever of 1.6, the one number that sets how fast the run feels. */
export const rideGravity = 9.81 * 1.6;

/** Metres the mover carries the rider's middle above the snow. */
export const rideHeight = 0.5;

/** The numbers an upgrade raises: `launch` is the metres a second a full
 *  pull fires at, `side` the metres a second across, and `drag` the air's
 *  1/m quadratic drag. */
export const riderStats = {
    launch: { base: 6.5, min: 0 },
    side: { base: 3.5, min: 0 },
    drag: { base: 0.004, min: 0 },
} satisfies Record<string, StatBase>;

/** Hands the rider's side and drag stats to its mover, before the move
 *  rides on them. */
export const readRiderStats: System = (world) => {
    world.query(StatsTrait, TrackMoverTrait).updateEach(([, mover], entity) => {
        mover.sideSpeed = readStat(entity, "side") ?? mover.sideSpeed;
        mover.drag = readStat(entity, "drag") ?? mover.drag;
    });
};

//  So the devtools slide the stats' bases, not the fields the step resets.
registerStatField("side", TrackMoverTrait, "sideSpeed");
registerStatField("drag", TrackMoverTrait, "drag");
