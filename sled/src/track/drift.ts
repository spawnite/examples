import { MathUtils } from "three";
import { apronWidth, edges, snowDepthAt, wallLip, type Lane } from "./profile";

//  Wind drift: sastrugi, long ridges running downslope with the wind, so
//  the field varies fast across the track and slowly along it. Across, the
//  wavelengths are about 4.5, 2.9 and 2 m: broader and a few centimetres of
//  snow make a tilt no sun finds, and finer beats against the tile's own
//  grain. Along, they run 50 to 100 m, which makes a ridge a ridge.

/** The field at a point, about -1 to 1.
 *  ponytail: three sines rather than a noise dependency; the along-track
 *  terms repeat at about 63 m, so a fourth, incommensurable term the day a
 *  level runs far enough to show it. */
export function driftAt(lateral: number, distance: number) {
    //  The lookup bends by a slower field of its own, so the ridges wander,
    //  split and rejoin rather than running dead parallel.
    const bent =
        lateral +
        1.6 * Math.sin(distance * 0.037 + 0.7) +
        0.9 * Math.sin(distance * 0.011 - 2.1);
    return (
        0.55 * Math.sin(bent * 1.4 + distance * 0.1) +
        0.3 * Math.sin(bent * 2.2 - distance * 0.06 + 1.7) +
        0.15 * Math.sin(bent * 3.1 + distance * 0.13 + 3.9)
    );
}

/** How heavily this patch is drifted, 0.35 to 1. Wind scours some
 *  stretches and piles others, tens of metres across, so a run passes
 *  through several; a field the same everywhere reads as a material, not
 *  a place. */
export function driftPatch(lateral: number, distance: number) {
    return (
        0.35 +
        0.65 *
            (0.5 +
                0.35 * Math.sin(lateral * 0.28 + distance * 0.19 + 2.3) +
                0.15 * Math.sin(lateral * 0.11 - distance * 0.075 + 0.8))
    );
}

/** The share of the loose snow's depth the wind may scour out: under 1, so
 *  a trough always leaves some snow. An ice lane has none to drift. */
export const driftOfDepth = 0.8;
/** How dark a scoured patch paints against a drifted one: under the
 *  snow-to-ice spread the lane's telegraph rides on. */
export const patchTone = 0.86;

/** Metres of relief at the apron's rim, and how much coarser its drifts
 *  run: big forms at a distance read as landscape, and the rim's wide spans
 *  would alias anything finer. */
const apronDriftHeight = 0.6;
const apronStretch = 2.5;
/** Metres the hillside climbs by the apron's rim, quadratic in the way
 *  out, so the corridor reads as a valley floor with no rim against the sky
 *  and no crease along the fence. */
const apronRise = 10;

/** Metres the hillside stands above the fence top: flat at the fence, out
 *  to the full relief and climb at the rim. */
export function apronDrift(lateral: number, distance: number, lane: Lane) {
    const out = MathUtils.clamp(
        (Math.abs(lateral) - edges(lane.halfWidth).wall) / apronWidth,
        0,
        1,
    );
    return (
        driftAt(lateral / apronStretch, distance / apronStretch) *
            apronDriftHeight *
            out *
            driftPatch(lateral, distance) +
        apronRise * out * out
    );
}

/** Metres the drift moves the drawn surface at a point on the
 *  cross-section. It carves the ride surface down and never piles it up,
 *  so the sled's clearance over the authored snow is the ceiling. */
export function driftLift(lateral: number, distance: number, lane: Lane) {
    const across = Math.abs(lateral);
    const { shoulder, wall } = edges(lane.halfWidth);
    if (across >= wall) return apronDrift(lateral, distance, lane);
    //  Faded out over the fence face, so it meets the apron at zero.
    const fade = across <= shoulder ? 1 : 1 - (across - shoulder) / wallLip;
    const depth = snowDepthAt(lateral, lane) * driftOfDepth;
    const carve = (driftAt(lateral, distance) - 1) / 2;
    return carve * depth * fade * driftPatch(lateral, distance);
}
