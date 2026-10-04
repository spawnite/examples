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
import { desert, snow, type SledMap } from "../maps";
import { readExpectedSteps } from "../ride/speed";
import { shoulderWidth, snowDepthAt, type Lane } from "../track/profile";
import level1 from "./level-1.json";
import level2 from "./level-2.json";
import level3 from "./level-3.json";
import level4 from "./level-4.json";
import level5 from "./level-5.json";
import level6 from "./level-6.json";
import level7 from "./level-7.json";
import level8 from "./level-8.json";
import level9 from "./level-9.json";
import level10 from "./level-10.json";
import level11 from "./level-11.json";
import level12 from "./level-12.json";

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
    Five: "level-5",
    Six: "level-6",
    Seven: "level-7",
    Eight: "level-8",
    Nine: "level-9",
    Ten: "level-10",
    Eleven: "level-11",
    Twelve: "level-12",
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
    [Track.Five]: readTrackLevel(level5),
    [Track.Six]: readTrackLevel(level6),
    [Track.Seven]: readTrackLevel(level7),
    [Track.Eight]: readTrackLevel(level8),
    [Track.Nine]: readTrackLevel(level9),
    [Track.Ten]: readTrackLevel(level10),
    [Track.Eleven]: readTrackLevel(level11),
    [Track.Twelve]: readTrackLevel(level12),
};

//  The map each track is drawn and ridden on. A table here rather than a
//  field of the level's file: the engine's track level reads its file
//  strictly, and a map is sled's own idea.
export const levelMaps: Record<LevelId, SledMap> = {
    [Track.One]: snow,
    [Track.Two]: snow,
    [Track.Three]: snow,
    [Track.Four]: snow,
    [Track.Five]: snow,
    [Track.Six]: snow,
    [Track.Seven]: snow,
    [Track.Eight]: snow,
    [Track.Nine]: desert,
    [Track.Ten]: desert,
    [Track.Eleven]: desert,
    [Track.Twelve]: desert,
};

//  The Speed step each track is tuned to finish at, beside `levelMaps` for
//  the same reason: the level's file takes no key the engine does not know.
//  Worked out from the coins of the tracks before it, so a track's coins
//  and its step never disagree.
const expectedSteps = readExpectedSteps(
    Object.values(levels).map(({ triggers }) => triggers.pickups?.length ?? 0),
);
//  Cast because `fromEntries` keys its record by string; the keys are
//  `levels`' own, every level id.
export const levelSpeedSteps = Object.fromEntries(
    Object.keys(levels).map((id, index) => [id, expectedSteps[index]]),
) as Record<LevelId, number>;

/** Metres between rings: the facet of the drawn surface. */
const ringSpacing = 0.5;

/** One ring of the run: the track's frame there, how far along it lies,
 *  and how icy its lane is. */
export interface Ring extends TrackFrame {
    distance: number;
    ice: number;
}

/** A level's track on the engine, the rings its surface stands on, and
 *  the map it is drawn on. */
export interface Run {
    track: TrackPath;
    rings: Ring[];
    map: SledMap;
}

//  Written in place by each read of the cover's depth, once a step.
const frame = createTrackFrame();
const lane: Lane = { halfWidth: 0, ice: 0 };

/** Metres of loose cover under the sled: deepening from the lane out
 *  across the shoulder, and none on the fast stretch. */
function readCoverDepth({ track, distance, lateral }: TrackSpot) {
    lane.halfWidth = track.frameAt(distance, frame).halfWidth - shoulderWidth;
    lane.ice = track.zoneWeight(distance, "ice");
    return snowDepthAt(lateral, lane);
}

/** A level's track on `map`, whose cover costs the sled its drag per
 *  metre of depth: snow when left out. */
export function buildRun(points: LevelPoint[], map = snow): Run {
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
        { friction: (spot) => readCoverDepth(spot) * map.dragPerMetre },
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
    return { track, rings, map };
}
