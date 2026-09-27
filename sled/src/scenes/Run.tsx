import { ChaseCamera, Lighting, LookName, Round } from "@spawnite/engine";
import sky from "@game/assets/textures/sled/sky-dawn.webp?url";
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

const level = levels[0];
const run = buildRun(level.track.points);
//  Built once: the slope draws it and the trees stand on it.
const ground = buildSlopeSurface(run);
const trees = level.placements.trees ?? [];
const aimSpan = readAimSpan(level.track.points);
const middle = run.track.pointAt(run.track.length / 2, 0);
//  Dusk with its sun 20 degrees up ahead of the run, so the run sleds into
//  the light and the shadows stretch toward the camera.
const look = {
    name: LookName.Dusk,
    hour: 17.75,
    sun: 2.5,
    fog: { near: 60, far: 400 },
    bloom: { intensity: 0.5, threshold: 0.9 },
    //  Open snow shows no contact shade; the pass costs half a retina frame.
    ambientOcclusion: false as const,
};
//  Metres: the whole of level 1 casts, from the sun's low angle.
const shadowBox = { halfWidth: 60, depth: 220 };
//  The painted dawn behind the run; its sun is in the plate's middle column.
const background = { file: sky, sunU: 0.5 };
const coins = level.triggers.pickups ?? [];
const rocks = readRocks(level);

/** Level 1: the rider on the sling at the start, the track, the hillside
 *  and its trees, the rocks, the coins and the finish gate, the sky, and
 *  the camera chasing the rider down the run, and the run's round, from
 *  the sling's fire to its end screen.
 *  fov 52 holds both fences in frame on a phone held upright. */
export function Run() {
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
