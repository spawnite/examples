import { Track as TrackPath, type LevelId } from "@spawnite/engine";
import { levels } from "../levels";
import type { ShapePoint } from "./TrackCard";

/** Points a track's shape is drawn through: enough that a hairpin on the
 *  card stays round. */
const shapePoints = 64;

/** `track`'s centreline from above, start to finish, sampled along the
 *  curve the run rides rather than through its authored points. */
export function readTrackShape(track: LevelId): ShapePoint[] {
    const path = new TrackPath(levels[track].track.points);
    return Array.from({ length: shapePoints + 1 }, (_, index) => {
        const { position } = path.frameAt((index / shapePoints) * path.length);
        return { x: position.x, z: position.z };
    });
}
