import { MathUtils, type Vector3 } from "three";
import { buildTrackSurface, type TrackSectionPoint } from "@spawnite/engine";
import type { Run } from "../levels";
import { palette, rgb } from "../palette";
import { driftLift, driftPatch, patchTone } from "./drift";
import { hillsideAt } from "./hillside";
import {
    apronHeight,
    apronWidth,
    edges,
    shoulderWidth,
    snowDepthAt,
    tileMetres,
    wallLip,
    type Lane,
} from "./profile";

//  Vertices across each part. The apron's spans widen outward, so the few
//  metres behind the fence, the part on screen, are sampled finely.
const laneSpans = 12;
const shoulderSpans = 6;
const apronSpans = 14;
const apronBias = 1.5;

/** Metres past the track's edge of the apron's vertex `step` out. */
const apron = (step: number) =>
    wallLip + apronWidth * (step / apronSpans) ** apronBias;
const steps = Array.from({ length: apronSpans }, (_, index) => index + 1);

/** The cross-section: the hillside apron, the fence, a snow shoulder each
 *  side of the lane the level authors, all measured from the track's edge,
 *  which is the shoulder's. The fence stays one span: its crease is what
 *  the slant normal shades. */
export const section: TrackSectionPoint[] = [
    ...[...steps].reverse().map((step) => ({
        from: "left" as const,
        across: -apron(step),
        height: apronHeight,
    })),
    { from: "left", across: -wallLip, height: apronHeight, wall: true },
    { from: "left", across: 0, spans: shoulderSpans },
    { from: "left", across: shoulderWidth, spans: laneSpans },
    { from: "right", across: -shoulderWidth, spans: shoulderSpans },
    { from: "right", across: 0, wall: true },
    { from: "right", across: wallLip, height: apronHeight },
    ...steps.map((step) => ({
        from: "right" as const,
        across: apron(step),
        height: apronHeight,
    })),
];

const snowColor = rgb(palette.snowSurface);
const iceColor = rgb(palette.iceSurface);

function mix(a: number[], b: number[], t: number) {
    return a.map((value, index) => MathUtils.lerp(value, b[index], t));
}

/** The drawn run: the snow and its drift on the ride surface, the fence,
 *  and the hillside past it, grouped as snow and ice; and the engine's
 *  terrain from the hillside's rim out to the horizon, the old sled's
 *  alpine relief. */
export function buildSlopeSurface(run: Run) {
    const { track } = run;
    const laneAt = (along: number): Lane => ({
        halfWidth: track.frameAt(along).halfWidth - shoulderWidth,
        ice: track.zoneWeight(along, "ice"),
    });
    //  The loose snow and its drift on the ride surface and up the fence
    //  face; from the fence top out, the hillside the scenery stands on.
    const lift = (across: number, along: number, point: Vector3) => {
        const lane = laneAt(along);
        const { shoulder } = edges(lane.halfWidth);
        const off = Math.abs(across) - shoulder;
        if (off >= wallLip - 1e-6)
            return hillsideAt(run, point.x, point.z) - point.y;
        //  The fence face starts from whatever depth the shoulder ends at,
        //  so it never steps up out of the snow.
        const snow =
            off <= 0
                ? snowDepthAt(across, lane)
                : snowDepthAt(shoulder, lane) * (1 - off / wallLip);
        return snow + driftLift(across, along, lane);
    };
    const paint = (across: number, along: number) => {
        const lane = laneAt(along);
        const laneColor = mix(snowColor, iceColor, lane.ice);
        const off = Math.abs(across) - lane.halfWidth;
        const color =
            off <= 0
                ? laneColor
                : mix(laneColor, snowColor, Math.min(1, off / shoulderWidth));
        //  The patches the wind drifted shade a little darker as well: a
        //  few centimetres of relief is a tilt the sun barely finds.
        const tone = patchTone + (1 - patchTone) * driftPatch(across, along);
        return color.map((channel) => channel * tone);
    };
    return buildTrackSurface({
        track,
        section,
        zones: ["snow", "ice"],
        lift,
        paint,
        tile: tileMetres,
        terrain: {},
    });
}
