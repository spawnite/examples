import {
    ChaseCamera,
    Lighting,
    Round,
    useLevels,
    type LevelId,
} from "@spawnite/engine";
import { dusk } from "@spawnite/engine/looks/dusk";
import type { TrackLevel } from "@spawnite/schema";
import sky from "@spawnite/assets/textures/sled/sky-dawn.webp?url";
import { buildRun, levels } from "../levels";
import { Coin } from "../components/Coin";
import { Controls } from "../components/Controls";
import { FinishGate } from "../components/FinishGate";
import { Forest } from "../components/Forest";
import { Rider } from "../components/Rider";
import { Rock } from "../components/Rock";
import { RunHud } from "../components/RunHud";
import { RunScreen } from "../components/RunScreen";
import { SlingPosts } from "../components/SlingPosts";
import { Slope } from "../components/Slope";
import { readRocks } from "../ride/course";
import { readAimSpan } from "../ride/sling";
import { buildSlopeSurface } from "../track/surface";

//  Dusk with its sun 20 degrees up ahead of the run, so the run sleds into
//  the light and the shadows stretch toward the camera.
const look = {
    base: dusk,
    hour: 17.75,
    sun: 2.5,
    fog: { near: 60, far: 400 },
    bloom: { intensity: 0.5, threshold: 0.9 },
    //  Open snow shows no contact shade; the pass costs half a retina frame.
    ambientOcclusion: false as const,
};
//  Metres: the whole of each level casts, from the sun's low angle.
const shadowBox = { halfWidth: 60, depth: 220 };
//  The painted dawn behind the run; its sun is in the plate's middle column.
const background = { file: sky, sunU: 0.5 };

/** A level's track, the ground the slope draws and the trees stand on,
 *  and what stands on the track. */
function buildLevel(level: TrackLevel) {
    const run = buildRun(level.track.points);
    return {
        level,
        run,
        ground: buildSlopeSurface(run),
        trees: level.placements.trees ?? [],
        coins: level.triggers.pickups ?? [],
        rocks: readRocks(level),
        aimSpan: readAimSpan(level.track.points),
        middle: run.track.pointAt(run.track.length / 2, 0),
    };
}

const built = new Map<LevelId, ReturnType<typeof buildLevel>>();

/** The level `id` names, built the first time it is played and kept, so a
 *  retry or a return to it builds nothing. */
export function loadLevel(id: LevelId) {
    const view = built.get(id) ?? buildLevel(levels[id]);
    built.set(id, view);
    return view;
}

/** The level being played: the rider on the sling at the start, the track,
 *  the hillside and its trees, the rocks, the coins and the finish gate,
 *  the sky, and the camera chasing the rider down the run, and the run's
 *  round, from the sling's fire to its end screen.
 *  fov 52 holds both fences in frame on a phone held upright. */
export function Run() {
    const { current } = useLevels();
    const { level, run, ground, trees, coins, rocks, aimSpan, middle } =
        loadLevel(current);
    return (
        <>
            <ChaseCamera track={run.track} fov={52} />
            <Lighting
                look={look}
                focus={middle}
                shadowBox={shadowBox}
                shadowMapSize={2048}
                background={background}
            />
            <Slope geometry={ground} />
            <Forest run={run} ground={ground} trees={trees} />
            {rocks.map(({ kind, spot }) => (
                <Rock
                    key={`${kind} ${spot.at} ${spot.side}`}
                    track={run.track}
                    kind={kind}
                    spot={spot}
                />
            ))}
            {coins.map((spot) => (
                <Coin
                    key={`${spot.at} ${spot.side}`}
                    track={run.track}
                    spot={spot}
                />
            ))}
            <FinishGate track={run.track} at={level.finish.at} />
            <SlingPosts track={run.track} aimSpan={aimSpan} />
            <Rider track={run.track} aimSpan={aimSpan} />
            {/*  Waits on the sling, whose fire starts it. */}
            <Round ready />
            <Controls />
            <RunHud />
            <RunScreen />
        </>
    );
}
