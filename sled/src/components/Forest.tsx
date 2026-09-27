import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Color, type BufferGeometry } from "three";
import {
    extendGltfLoader,
    hashKeys,
    registerModel,
    TrackScatter,
    type TrackScatterCopy,
    type TrackScatterRow,
} from "@spawnite/engine";
import conifer from "@game/assets/models/sled/conifer.glb?url";
import spruce from "@game/assets/models/sled/spruce.glb?url";
import type { Run, TreeDef } from "../levels";
import { wallLip } from "../track/profile";

/** The species and how often each is drawn. */
const species = { conifer, spruce };
const weights = { conifer: 0.75, spruce: 0.25 };
for (const [name, url] of Object.entries(species)) {
    registerModel(name, url);
    //  Both at once: each batch alone would start its file when it mounts.
    useGLTF.preload(url, false, undefined, extendGltfLoader);
}
/** Metres a row keeps clear of an authored tree. */
const heroClear = 4;
/** Metres tall an authored tree stands when it names no scale: both
 *  models are a metre tall, so the height in metres is the scale. */
const heroScale = 3;
/** Rows a side, in metres out from the start of the band, and the metres
 *  between their trees: a treeline close in, a scattered stand further out
 *  that carries the eye up the valley wall, and the last five past the
 *  apron, on the terrain. */
const rows = [0, 4, 8.5, 14, 20, 26.5, 34, 42, 50, 62, 78, 96, 116, 136];
const rowSpacing = [4, 4.5, 5, 6, 7.5, 9, 10.5, 12, 13.5, 18, 22, 26, 32, 40];
/** Metres the band starts past the fence. */
const bandIn = 1.5;
/** A row tree's width in metres, its height as a multiple of that, how
 *  far it wanders across its row, and the share of its cell it may slide
 *  along. */
const row = {
    jitter: 1.6,
    slide: 0.7,
    size: [3.4, 6.8],
    stretch: [0.95, 1.35],
} satisfies Partial<TrackScatterRow>;
/** Each tree's brightness, and how far its green drifts: what makes them
 *  read as different trees rather than one tree lit differently. */
const tintRange = [0.82, 1.06];
const tintHue = 0.05;

function tint(index: number) {
    const value =
        tintRange[0] + hashKeys(index, 0) * (tintRange[1] - tintRange[0]);
    const green = (hashKeys(index, 1) - 0.5) * tintHue;
    return new Color(value - green, value + green, value - green / 2);
}

interface ForestProps {
    run: Run;
    /** The drawn ground the trees stand on, the terrain with it. */
    ground: BufferGeometry;
    trees: TreeDef[];
}

/** The level's authored trees, and rows each side from past the fence up
 *  the hillside, stepping round them.
 *  ponytail: every tree at full detail and never culled, about 210 on
 *  level 1; the old sled swaps in a decimated model past 60 m, chunk by
 *  chunk, which a longer level earns. */
export function Forest({ run, ground, trees }: ForestProps) {
    const placements = useMemo(
        () => [
            ...trees.map(({ at, side, scale }): TrackScatterCopy => ({
                at,
                across: side,
                scale: scale ?? heroScale,
            })),
            ...[-1, 1].flatMap((side) =>
                rows.map((out, index): TrackScatterRow => ({
                    ...row,
                    from: side < 0 ? "left" : "right",
                    across: side * (wallLip + bandIn + out),
                    spacing: rowSpacing[index],
                })),
            ),
        ],
        [trees],
    );
    return (
        <TrackScatter
            track={run.track}
            surface={ground}
            models={weights}
            placements={placements}
            clear={heroClear}
            tint={tint}
        />
    );
}
