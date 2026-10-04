import {
    ChaseCamera,
    Lighting,
    Round,
    useLevels,
    type LevelId,
} from "@spawnite/engine";
import { buildRun, levelMaps, levels } from "../levels";
import { Coin } from "../components/Coin";
import { Controls } from "../components/Controls";
import { LaunchHint } from "../components/LaunchHint";
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

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins.
export { plugins } from "../game";

//  Metres: the whole of each level casts, from the sun's low angle.
const shadowBox = { halfWidth: 60, depth: 220 };

/** A level's track on its map, the ground the slope draws and the trees
 *  stand on, and what stands on the track. */
function buildLevel(id: LevelId) {
    const level = levels[id];
    const run = buildRun(level.track.points, levelMaps[id]);
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
    const view = built.get(id) ?? buildLevel(id);
    built.set(id, view);
    return view;
}

/** The level being played: the rider on the sling at the start, the track,
 *  the hillside and its trees, the rocks, the coins and the finish gate,
 *  the sky and the light of its map, and the camera chasing the rider down the run, and the run's
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
                look={run.map.look}
                focus={middle}
                shadowBox={shadowBox}
                shadowMapSize={2048}
                sky={run.map.background}
            />
            {/*  Keyed: a material's shader compiles once, in its map's
                 colours. */}
            <Slope key={run.map.name} geometry={ground} map={run.map} />
            <Forest run={run} ground={ground} trees={trees} />
            {rocks.map(({ kind, spot }) => (
                <Rock
                    key={`${kind} ${spot.at} ${spot.side}`}
                    track={run.track}
                    kind={kind}
                    spot={spot}
                    map={run.map}
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
            <LaunchHint />
            <RunHud />
            <RunScreen />
        </>
    );
}
