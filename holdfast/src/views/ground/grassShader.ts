import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from "three";
import type { GrassShader, GroundSurface } from "@spawnite/engine";
import {
    groundLayout,
    groundLayoutUniforms,
    groundNoise,
} from "./groundShader";

//  The engine's grass as this game shapes it, from the same layout as its
//  paint: short or gone where the paint shows a road's or the trodden
//  middle's earth, the ring's cobbles, the hearth's flagstones or the
//  forest floor, and coloured as the paint's grass.

/** The ground the grass is shaped over: its grid and its roads. */
type GrassGround = Pick<GroundSurface, "size" | "cell" | "getPathSurfaceAt">;

/** Each point's share of a dirt road, as the paint's `roadWeight`
 *  attribute holds it per vertex: the roads bend, which the shader alone
 *  cannot follow cheaply. One texel per point of the map's grid. */
function bakeRoadWeights({ size, cell, getPathSurfaceAt }: GrassGround) {
    const points = Math.round(size / cell) + 1;
    const weights = new Uint8Array(points * points);
    for (let row = 0; row < points; row++)
        for (let column = 0; column < points; column++) {
            const paint = getPathSurfaceAt({
                x: column * cell - size / 2,
                z: row * cell - size / 2,
            });
            if (paint?.surface === "dirt")
                weights[row * points + column] = Math.round(paint.weight * 255);
        }
    const texture = new DataTexture(
        weights,
        points,
        points,
        RedFormat,
        UnsignedByteType,
    );
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

/** The grass's shaping over this map, and the texture of its road
 *  weights, which the caller disposes. */
export interface HoldfastGrass {
    grass: GrassShader;
    roadWeights: DataTexture;
}

export function createHoldfastGrass(ground: GrassGround): HoldfastGrass {
    const points = Math.round(ground.size / ground.cell) + 1;
    const roadWeights = bakeRoadWeights(ground);
    const grass: GrassShader = {
        functions: /* glsl */ `
${groundNoise}
${groundLayout}
// The texel of the grid's point under a place, the first point's centre at
// the map's corner.
float readRoadWeight(vec2 at) {
    vec2 point = (at + ${(ground.size / 2).toFixed(1)}) / ${ground.cell.toFixed(2)} + 0.5;
    return texture(uRoadWeights, point / ${points.toFixed(1)}).r;
}
`,
        shape: /* glsl */ `
GroundLayout site = layoutGround(bladeRoot.xz, readRoadWeight(bladeRoot.xz), groundUp);
float earth = smoothstep(0.42, 0.62, site.wear + (bladeSeed - 0.5) * 0.25);
// Gone wherever the paint shows the ring's cobbles or the hearth's slabs,
// which it draws whole once their share passes about a third.
float grassy = (1.0 - earth) * (1.0 - site.forest) * (1.0 - site.steep * 0.85)
    * (1.0 - smoothstep(0.0, 0.3, site.ring)) * (1.0 - smoothstep(0.0, 0.3, site.hearth));
bladeHeight *= smoothstep(0.05, 0.6, grassy);
bladeColour = colourGrass(bladeRoot.xz);
`,
        uniforms: { ...groundLayoutUniforms, uRoadWeights: roadWeights },
    };
    return { grass, roadWeights };
}
