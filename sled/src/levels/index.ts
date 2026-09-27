import {
    createTrackFrame,
    Track,
    type TrackFrame,
    type TrackSpot,
} from "@spawnite/engine";
import {
    readTrackLevel,
    type TrackLevel,
    type TrackLevelPoint,
    type TrackPlacement,
} from "@spawnite/schema";
import {
    shoulderWidth,
    snowDepthAt,
    snowDragPerMetre,
    type Lane,
} from "../track/profile";
import level1 from "./level-1.json";

/** One authored point of a level's track. `width` is the lane's, without
 *  its shoulders; `zone` is "snow" or "ice", blended to the next point. */
export type LevelPoint = TrackLevelPoint;

/** A tree placed in track coordinates: metres along, metres across
 *  (negative is left, and beyond the fence), and its height in metres. */
export type TreeDef = TrackPlacement;

//  Read through the schema, so a bad file fails at load with the field named.
export const levels: TrackLevel[] = [readTrackLevel(level1)];

/** Metres between rings: the facet of the drawn surface. */
const ringSpacing = 0.5;

/** One ring of the run: the track's frame there, how far along it lies,
 *  and how icy its lane is. */
export interface Ring extends TrackFrame {
    distance: number;
    ice: number;
}

/** A level's track on the engine, and the rings its surface stands on. */
export interface Run {
    track: Track;
    rings: Ring[];
}

//  Written in place by each read of the snow's friction, once a step.
const frame = createTrackFrame();
const lane: Lane = { halfWidth: 0, ice: 0 };

/** The 1/s the snow under the sled costs it: its depth, deepening from
 *  the lane out across the shoulder, and none on swept ice. */
function readSnowFriction({ track, distance, lateral }: TrackSpot) {
    lane.halfWidth = track.frameAt(distance, frame).halfWidth - shoulderWidth;
    lane.ice = track.zoneWeight(distance, "ice");
    return snowDepthAt(lateral, lane) * snowDragPerMetre;
}

export function buildRun(points: LevelPoint[]): Run {
    const track = new Track(
        points.map(({ x, y, z, width, zone }) => ({
            x,
            y,
            z,
            width: width + 2 * shoulderWidth,
            //  A point that names no zone is snow: ice is free speed,
            //  and free speed is never what forgetting to say gets you.
            zone,
        })),
        { friction: readSnowFriction },
    );
    const count = Math.max(1, Math.round(track.length / ringSpacing));
    const rings = Array.from({ length: count + 1 }, (_, index) => {
        const distance = (index / count) * track.length;
        return {
            ...track.frameAt(distance),
            distance,
            ice: track.zoneWeight(distance, "ice"),
        };
    });
    return { track, rings };
}
