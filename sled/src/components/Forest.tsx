import { useMemo } from "react";
import { Color, type BufferGeometry } from "three";
import {
    hashKeys,
    registerModel,
    TrackScatter,
    type TrackScatterCopy,
    type TrackScatterRow,
    useModel,
} from "@spawnite/engine";
import type { Run, TreeDef } from "../levels";
import { desert, snow, type PropStand } from "../maps";
import { wallLip } from "../track/profile";

for (const stand of [...snow.props, ...desert.props])
    for (const [name, { url }] of Object.entries(stand.models))
        registerModel(name, url);
/** Metres a row keeps clear of an authored tree. */
const heroClear = 4;
/** Metres tall an authored tree stands when it names no scale: every
 *  model is about a metre tall, so the height in metres is the scale. */
const heroScale = 3;
/** Rows a side, in metres out from the start of the band, and the metres
 *  between their trees: a treeline close in, a scattered stand further out
 *  that carries the eye up the valley wall, and the last five past the
 *  apron, on the terrain. */
const rows = [0, 4, 8.5, 14, 20, 26.5, 34, 42, 50, 62, 78, 96, 116, 136];
const rowSpacing = [4, 4.5, 5, 6, 7.5, 9, 10.5, 12, 13.5, 18, 22, 26, 32, 40];
/** Metres the band starts past the fence. */
const bandIn = 1.5;
/** How far a row tree wanders across its row, the share of its cell it
 *  may slide along, and its height as a multiple of its width; its stand
 *  gives its width in metres. */
const row = {
    jitter: 1.6,
    slide: 0.7,
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

/** The rows of one stand each side, from past the fence up the hillside.
 *  A stand after the first shifts its rows along by its share of a cell,
 *  so two stands interleave rather than stand on each other. */
function placeRows(stand: PropStand, index: number, stands: number) {
    return [-1, 1].flatMap((side) =>
        rows.map((out, rowIndex): TrackScatterRow => ({
            ...row,
            size: stand.size,
            from: side < 0 ? "left" : "right",
            across: side * (wallLip + bandIn + out),
            spacing: rowSpacing[rowIndex],
            start: (rowSpacing[rowIndex] * index) / stands,
        })),
    );
}

/** The level's authored trees, and the map's stands in rows each side
 *  from past the fence up the hillside, stepping round them.
 *  ponytail: every tree at full detail and never culled, about 210 on
 *  level 1; the old sled swaps in a decimated model past 60 m, chunk by
 *  chunk, which a longer level earns, and the models' -far files wait. */
export function Forest({ run, ground, trees }: ForestProps) {
    const { props } = run.map;
    const stands = useMemo(
        () =>
            props.map((stand, index) => ({
                weights: Object.fromEntries(
                    Object.entries(stand.models).map(([name, { weight }]) => [
                        name,
                        weight,
                    ]),
                ),
                placements: [
                    ...(index === 0
                        ? trees.map(
                              ({ at, side, scale }): TrackScatterCopy => ({
                                  at,
                                  across: side,
                                  scale: scale ?? heroScale,
                              }),
                          )
                        : []),
                    ...placeRows(stand, index, props.length),
                ],
            })),
        [props, trees],
    );
    //  Every file at once: each batch alone would start its file when it
    //  mounts.
    for (const stand of props)
        for (const { url } of Object.values(stand.models))
            useModel.preload(url);
    return stands.map(({ weights, placements }, index) => (
        <TrackScatter
            key={index}
            track={run.track}
            surface={ground}
            models={weights}
            placements={placements}
            clear={heroClear}
            tint={tint}
        />
    ));
}
