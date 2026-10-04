import { useLevels, useScenes, type LevelId } from "@spawnite/engine";
import { levels, levelSpeedSteps } from "../levels";
import { useProgress } from "../shop";
import { MapSheet, type MapTrack } from "./MapSheet";
import { readTrackShape } from "./trackShape";
import { PinState } from "./TrackPin";

/** Each track's shape, drawn once: the levels never change in play. */
const shapes = Object.fromEntries(
    Object.keys(levels).map((id) => [id, readTrackShape(id as LevelId)]),
) as Record<LevelId, MapTrack["shape"]>;

/** The map sheet from the player's progress through the levels and their
 *  Speed step; its play button plays the selected track in the run
 *  scene. The scene holds
 *  the selection, since the stage follows the selected track's world. */
export function TrackMap({
    selected,
    onSelect,
}: {
    selected: LevelId;
    onSelect: (track: LevelId) => void;
}) {
    const { levels: status, play } = useLevels();
    const { step } = useProgress();
    const scenes = useScenes();
    const tracks: MapTrack[] = status.map((level, index) => ({
        id: level.id,
        number: index + 1,
        state: level.finished
            ? PinState.Finished
            : level.unlocked
              ? PinState.Next
              : PinState.Locked,
        coins: {
            //  A sled round's score is the coins the run took.
            best: level.best?.score ?? 0,
            total: levels[level.id].triggers.pickups?.length ?? 0,
        },
        needed: levelSpeedSteps[level.id],
        shape: shapes[level.id],
    }));
    return (
        <MapSheet
            tracks={tracks}
            selected={selected}
            onSelect={onSelect}
            step={step}
            onPlay={() => {
                if (play(selected)) scenes.go("run");
            }}
        />
    );
}
