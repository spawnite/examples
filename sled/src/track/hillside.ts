import { MathUtils } from "three";
import { weighPlanRings } from "@spawnite/engine";
import type { Ring, Run } from "../levels";
import { apronDrift } from "./drift";
import { apronHeight, edges, shoulderWidth } from "./profile";

/** Metres below the ride surface the hillside stands where the track
 *  covers it: clear of an ice lane, which has no snow over its ground and
 *  would otherwise flicker against it. */
export const under = 1.2;

/** The hillside off one ring, at a world point `distance` metres along the
 *  track off it: level to the right, so it runs out level. */
function hillsideOff(ring: Ring, distance: number, x: number, z: number) {
    const offTrack = Math.abs(
        (x - ring.position.x) * ring.right.x +
            (z - ring.position.z) * ring.right.z,
    );
    const lane = { halfWidth: ring.halfWidth - shoulderWidth, ice: ring.ice };
    const { shoulder, wall } = edges(lane.halfWidth);
    const onApron = MathUtils.smoothstep(offTrack, shoulder, wall);
    return (
        ring.position.y +
        onApron * (apronHeight + apronDrift(offTrack, distance, lane)) -
        (1 - onApron) * under
    );
}

/** The ground the hillside stands on at a world point: one function the
 *  apron mesh and the scenery both seat on, so they cannot disagree. Under
 *  the track it is `under` below the ride surface; from the fence out it is
 *  the fence top plus the drift and the valley's climb. It is asked about a
 *  spot on the map, whatever its height, and blends the rings the engine's
 *  `weighPlanRings` reads it off, so where two stretches of the run meet it
 *  ramps from one to the other. */
export function hillsideAt(run: Run, x: number, z: number) {
    return weighPlanRings(run.rings, { x, z }).reduce(
        (height, { ring, distance, weight }) =>
            height + weight * hillsideOff(ring, distance, x, z),
        0,
    );
}
