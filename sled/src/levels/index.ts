import {
    createTrackFrame,
    defineLevels,
    Track as TrackPath,
    type LevelId,
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
import level2 from "./level-2.json";
import level3 from "./level-3.json";
import level4 from "./level-4.json";

/** One authored point of a level's track. `width` is the lane's, without
 *  its shoulders; `zone` is "snow" or "ice", blended to the next point. */
export type LevelPoint = TrackLevelPoint;

/** A tree placed in track coordinates: metres along, metres across
 *  (negative is left, and beyond the fence), and its height in metres. */
export type TreeDef = TrackPlacement;

/** Sled's tracks, in the order they unlock, each by the id the save keeps
 *  the player's progress on it under. An id never changes once players
 *  hold a save. */
export const Track = defineLevels({
    One: "level-1",
    Two: "level-2",
    Three: "level-3",
    Four: "level-4",
});

declare module "@spawnite/engine" {
    interface Register {
        levels: typeof Track;
    }
}

//  Each track's level, read through the schema, so a bad file fails at
//  load with the field named.
export const levels: Record<LevelId, TrackLevel> = {
    [Track.One]: readTrackLevel(level1),
    [Track.Two]: readTrackLevel(level2),
    [Track.Three]: readTrackLevel(level3),
    [Track.Four]: readTrackLevel(level4),
};

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
    track: TrackPath;
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
    const track = new TrackPath(
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
