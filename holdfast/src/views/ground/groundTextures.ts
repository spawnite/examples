import cobblesColor from "@spawnite/assets/textures/holdfast/cobbles-color.webp?url";
import cobblesDetail from "@spawnite/assets/textures/holdfast/cobbles-detail.webp?url";
import slabsColor from "@spawnite/assets/textures/holdfast/slabs-color.webp?url";
import slabsDetail from "@spawnite/assets/textures/holdfast/slabs-detail.webp?url";
import grassColor from "@spawnite/assets/textures/holdfast/grass-color.webp?url";
import grassDetail from "@spawnite/assets/textures/holdfast/grass-detail.webp?url";
import pathColor from "@spawnite/assets/textures/holdfast/path-color.webp?url";
import pathDetail from "@spawnite/assets/textures/holdfast/path-detail.webp?url";
import { groundLayers } from "./groundShader";

//  The four photographed surfaces the ground's paint lays down. Each colour
//  map carries its ambient occlusion; each detail map carries the normal's x
//  and y in red and green, and roughness in blue.

/** A surface's files, the metres one copy of it spans on the ground, and
 *  its colour map's mean in linear light, measured over every pixel. */
export interface GroundTexture {
    color: string;
    detail: string;
    tileMetres: number;
    mean: [number, number, number];
}

export const groundTextures: Record<keyof typeof groundLayers, GroundTexture> =
    {
        grass: {
            color: grassColor,
            detail: grassDetail,
            tileMetres: 2.2,
            mean: [0.0983, 0.1247, 0.0283],
        },
        earth: {
            color: pathColor,
            detail: pathDetail,
            tileMetres: 2.6,
            mean: [0.1755, 0.11, 0.0541],
        },
        cobbles: {
            color: cobblesColor,
            detail: cobblesDetail,
            tileMetres: 1.6,
            mean: [0.2139, 0.1965, 0.1647],
        },
        flagstones: {
            color: slabsColor,
            detail: slabsDetail,
            tileMetres: 2.4,
            mean: [0.1441, 0.102, 0.0651],
        },
    };
