import type { LevelId } from "@spawnite/engine";
import mapDesert from "@spawnite/assets/textures/sled/map-desert.webp?url";
import mapSnow from "@spawnite/assets/textures/sled/map-snow.webp?url";
import { Track } from "../levels";

//  The lobby's map: one painting per world, each with a trail of round
//  clearings, the tracks on them from the bottom up and a gate to the
//  other world on the last.

export enum WorldId {
    Snow = "snow",
    Desert = "desert",
}

/** A place on a painting, as fractions of its width and height from its
 *  top left corner, so it holds at any size the painting is drawn. */
export interface MapPoint {
    x: number;
    y: number;
}

export interface LobbyWorld {
    /** The painting's file. */
    image: string;
    /** The painting's width over its height. */
    aspect: number;
    /** Each track on the trail, bottom to top, at its clearing. */
    pins: { track: LevelId; at: MapPoint }[];
    /** The clearing at the trail's top, which leads to `to`. */
    gate: MapPoint;
    to: WorldId;
}

/** A clearing's centre on a painting `width` by `height` pixels, measured
 *  by eye off the painting in pixels. */
function clearing(width: number, height: number, x: number, y: number) {
    return { x: x / width, y: y / height };
}

const snow = clearing.bind(null, 1024, 1536);
const desert = clearing.bind(null, 1024, 1024);

/** The two worlds, in the order they are played. */
export const worlds: Record<WorldId, LobbyWorld> = {
    [WorldId.Snow]: {
        image: mapSnow,
        aspect: 1024 / 1536,
        pins: [
            { track: Track.One, at: snow(505, 1395) },
            { track: Track.Two, at: snow(620, 1095) },
            { track: Track.Three, at: snow(440, 990) },
            { track: Track.Four, at: snow(420, 790) },
            { track: Track.Five, at: snow(610, 660) },
            { track: Track.Six, at: snow(420, 590) },
            { track: Track.Seven, at: snow(410, 430) },
            { track: Track.Eight, at: snow(560, 345) },
        ],
        gate: snow(500, 130),
        to: WorldId.Desert,
    },
    [WorldId.Desert]: {
        image: mapDesert,
        aspect: 1,
        pins: [
            { track: Track.Nine, at: desert(515, 890) },
            { track: Track.Ten, at: desert(472, 610) },
            { track: Track.Eleven, at: desert(478, 468) },
            { track: Track.Twelve, at: desert(550, 260) },
        ],
        gate: desert(527, 90),
        to: WorldId.Snow,
    },
};

/** The world `track` is pinned in. */
export function readTrackWorld(track: LevelId): WorldId {
    return worlds[WorldId.Desert].pins.some((pin) => pin.track === track)
        ? WorldId.Desert
        : WorldId.Snow;
}

/** The track whose finish opens the snow's gate to the desert: the last
 *  on the snow's trail. */
export const desertKey = Track.Eight;
