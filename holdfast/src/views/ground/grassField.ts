import { MathUtils, Vector3 } from "three";
import { QualityLevel } from "@spawnite/schema";
import type { GroundSurface } from "@spawnite/engine";
import { drawRandom } from "../../siege/random";
import { hearthMetres } from "../layout";

//  Where the grass blades stand, in square patches the size of a room, so
//  a page draws only the patches in front of the camera and thins each by
//  its distance. Numbers only: the view in Grass.tsx draws them.

/** The ground the blades stand on. */
export type GrassGround = Pick<
    GroundSurface,
    "size" | "getHeightAt" | "getNormalAt" | "getPathSurfaceAt"
>;

/** One square of blades. `roots` holds x, y, z and a rank from 0 to 1 per
 *  blade, in a random order, so the first blades of a patch are a thinner
 *  field of the same grass. `ground` holds the road's weight and the
 *  ground's upward share under each blade, which the blade's shader reads
 *  to shrink where the paint turns to earth. */
export interface GrassPatch {
    centerX: number;
    centerZ: number;
    /** Metres from the middle to a corner. */
    radius: number;
    roots: Float32Array;
    ground: Float32Array;
    count: number;
}

/** What plantGrass plants on, and how thick. */
export interface PlantGrassOptions {
    surface: GrassGround;
    /** The share of the full field, 0 to 1, from readGrassShare. */
    share: number;
}

/** A patch's side in metres. */
const patchMetres = 6;
/** Blades a square metre at a share of 1. */
const bladesPerSquareMetre = 220;
/** Grass ends where the forest floor begins, past the circle's region. */
const grassReachMetres = 38;
/** A path's weight past which no blade roots: its core. */
const pathCoreWeight = 0.9;

/** Metres from the camera where the grass starts to thin, and where the
 *  last blade goes: the shader reads the same two. */
export const grassFade = { near: 9, far: 28 };

/** The field's share at each Graphics level: none at Minimum, a sparse
 *  field at Low. Auto plants Medium's, as its post-processing does. */
const grassShares: Record<QualityLevel, number> = {
    [QualityLevel.Minimum]: 0,
    [QualityLevel.Low]: 0.15,
    [QualityLevel.Medium]: 0.75,
    [QualityLevel.High]: 1,
    [QualityLevel.Auto]: 0.75,
};

/** The share of the field a Graphics level plants. */
export function readGrassShare(level: QualityLevel): number {
    return grassShares[level];
}

/** The dirt road's weight where a blade may root, or undefined off the
 *  grass: on a path's core, the ring's cobbles or a road's packed earth,
 *  on the hearth's flagstones, or on the forest floor. The ragged edges
 *  between are the shader's, which shrinks a blade where the paint shows
 *  earth or stone. */
function readGrassRoad(surface: GrassGround, x: number, z: number) {
    const radius = Math.hypot(x, z);
    if (radius > grassReachMetres) return undefined;
    if (radius < hearthMetres - 0.3) return undefined;
    const path = surface.getPathSurfaceAt({ x, z });
    if (path && path.weight >= pathCoreWeight) return undefined;
    return path?.surface === "dirt" ? path.weight : 0;
}

const normal = new Vector3();

/** The map's grass as patches of blade roots, `share` of the full field.
 *  ponytail: planted on the main thread when the view mounts, about half a
 *  second at Auto; planting a patch as the camera first nears it would
 *  spread that over the first frames. */
export function plantGrass({
    surface,
    share,
}: PlantGrassOptions): GrassPatch[] {
    const patches: GrassPatch[] = [];
    if (share <= 0) return patches;
    const seeded = { seed: 1765 };
    const half = surface.size / 2;
    const perPatch = Math.round(
        patchMetres ** 2 * bladesPerSquareMetre * share,
    );
    for (let left = -half; left < half; left += patchMetres) {
        for (let near = -half; near < half; near += patchMetres) {
            const centerX = left + patchMetres / 2;
            const centerZ = near + patchMetres / 2;
            const corner = Math.SQRT1_2 * patchMetres;
            if (Math.hypot(centerX, centerZ) - corner > grassReachMetres)
                continue;
            const roots = new Float32Array(perPatch * 4);
            const ground = new Float32Array(perPatch * 2);
            let count = 0;
            for (let index = 0; index < perPatch; index++) {
                const x = left + drawRandom(seeded) * patchMetres;
                const z = near + drawRandom(seeded) * patchMetres;
                const road = readGrassRoad(surface, x, z);
                if (road === undefined) continue;
                surface.getNormalAt({ x, z }, normal);
                roots.set([x, surface.getHeightAt({ x, z }), z, 0], count * 4);
                ground.set([road, normal.y], count * 2);
                count++;
            }
            //  The rank a blade's order gives it, now the count is known.
            for (let index = 0; index < count; index++)
                roots[index * 4 + 3] = index / count;
            if (count > 0)
                patches.push({
                    centerX,
                    centerZ,
                    radius: corner,
                    roots: roots.slice(0, count * 4),
                    ground: ground.slice(0, count * 2),
                    count,
                });
        }
    }
    return patches;
}

/** The share of blades drawn at a distance from the camera: all near, none
 *  past the fade. */
function readGrassDensity(distance: number): number {
    return 1 - MathUtils.smoothstep(distance, grassFade.near, grassFade.far);
}

/** How many of a patch's blades to draw with the camera here: its first
 *  blades, as many as its nearest corner's density keeps. */
export function countDrawnBlades(
    patch: GrassPatch,
    camera: { x: number; z: number },
): number {
    const distance = Math.max(
        0,
        Math.hypot(patch.centerX - camera.x, patch.centerZ - camera.z) -
            patch.radius,
    );
    return Math.ceil(readGrassDensity(distance) * patch.count);
}
