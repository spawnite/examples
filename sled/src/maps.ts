import type { LookBackground, LookPick } from "@spawnite/engine";
import { dusk } from "@spawnite/engine/looks/dusk";
import { noon } from "@spawnite/engine/looks/noon";
import barrelCactus from "@spawnite/assets/models/sled/barrel-cactus.glb?url";
import conifer from "@spawnite/assets/models/sled/conifer.glb?url";
import hoodoo from "@spawnite/assets/models/sled/hoodoo.glb?url";
import palm from "@spawnite/assets/models/sled/palm.glb?url";
import palmTrunk from "@spawnite/assets/models/sled/palm-trunk.glb?url";
import crag from "@spawnite/assets/models/sled/rock-crag.glb?url";
import lowRock from "@spawnite/assets/models/sled/rock-low.glb?url";
import slab from "@spawnite/assets/models/sled/rock-slab.glb?url";
import spruce from "@spawnite/assets/models/sled/spruce.glb?url";
import ice from "@spawnite/assets/textures/sled/ice.ktx2?url";
import iceNormal from "@spawnite/assets/textures/sled/ice-n.ktx2?url";
import skyDawn from "@spawnite/assets/textures/sled/sky-dawn.webp?url";
import snowTile from "@spawnite/assets/textures/sled/snow.ktx2?url";
import snowNormal from "@spawnite/assets/textures/sled/snow-n.ktx2?url";
import { CourseKind, type RockKind } from "./ride/course";
import { snowDragPerMetre } from "./track/profile";

//  A map is what a level is drawn on and rides on: everything that differs
//  between the snow and the desert. A level's points name two zones, `snow`
//  for the loose cover and `ice` for the fast stretch; the map says what
//  each one is, such as sand and packed dune.

/** One value for each zone a level's points name. */
export interface PerZone<Value> {
    /** The loose cover: snow, or sand. */
    snow: Value;
    /** The fast stretch: swept ice, or packed dune. */
    ice: Value;
}

/** A ground tile: its colour and normal `.ktx2` files. */
export interface GroundTile {
    color: string;
    normal: string;
    /** 0 mirror to 1 matte. */
    roughness: number;
}

/** The land from the hillside's rim to the horizon. */
export interface MapTerrain {
    /** What lies on whatever faces up. */
    cover: number;
    /** What the steep faces show. */
    rock: number;
    /** The colour the far land fades into. */
    haze: number;
    /** Metres its relief climbs; the engine's 340 when left out. */
    height?: number;
}

/** A model of a stand, by its file, and how often it is drawn. */
export interface PropModel {
    url: string;
    weight: number;
}

/** Models that stand round the run in rows, by name, at a size range, as a
 *  multiple of each model's metre. */
export interface PropStand {
    models: Record<string, PropModel>;
    size: [number, number];
}

export interface SledMap {
    /** Unique among the maps: it keys the terrain's shader. */
    name: string;
    /** 1/s the sled loses per metre of loose cover under it. */
    dragPerMetre: number;
    /** The lane's paint in each zone, sRGB hex, multiplied into its tile. */
    paint: PerZone<number>;
    /** What the cover is painted, and its glow, so its shade never goes
     *  dead. */
    albedo: number;
    emissive: number;
    tiles: PerZone<GroundTile>;
    terrain: MapTerrain;
    look: LookPick;
    /** A painted sky in place of the look's own image. */
    background?: LookBackground;
    /** The first stand takes the level's own trees. */
    props: PropStand[];
    /** The model each rock kind draws, stretched to the kind's box: the
     *  kind sets what hits and what the rider does about it, the map what
     *  the thing is. */
    rocks: Record<RockKind, string>;
}

/** The old sled's dawn on snow: the snow zone's colours measured off the
 *  dawn concept board and its sky plate. */
export const snow: SledMap = {
    name: "snow",
    dragPerMetre: snowDragPerMetre,
    paint: { snow: 0xfcfcff, ice: 0xedf5ff },
    albedo: 0xf7f4f2,
    emissive: 0x050506,
    tiles: {
        //  Roughness is all that parts snow from ice. Ice at 0.45 rather
        //  than near-mirror: a narrow lobe reflects the horizon, and the
        //  lane went the colour of the sky whenever the sky changed.
        snow: { color: snowTile, normal: snowNormal, roughness: 0.95 },
        ice: { color: ice, normal: iceNormal, roughness: 0.45 },
    },
    terrain: {
        cover: 0xf7f4f2,
        //  Cool and grey, so the snow on top reads as the warm half.
        rock: 0x6b6a72,
        //  The sky plate's lowest band, measured off the plate itself.
        haze: 0xeeab8d,
    },
    //  Dusk with its sun 20 degrees up ahead of the run, so the run sleds
    //  into the light and the shadows stretch toward the camera.
    look: {
        base: dusk,
        hour: 17.75,
        sun: 2.5,
        fog: { near: 60, far: 400 },
        bloom: { intensity: 0.5, threshold: 0.9 },
        //  Open snow shows no contact shade; the pass costs half a retina
        //  frame.
        ambientOcclusion: false as const,
    },
    //  The painted dawn behind the run; its sun is in the plate's middle
    //  column.
    background: { file: skyDawn, sunU: 0.5 },
    props: [
        {
            models: {
                conifer: { url: conifer, weight: 0.75 },
                spruce: { url: spruce, weight: 0.25 },
            },
            size: [3.4, 6.8],
        },
    ],
    rocks: {
        [CourseKind.Slab]: slab,
        [CourseKind.Rock]: lowRock,
        [CourseKind.Boulder]: crag,
    },
};

/** A desert canyon at mid-afternoon: sand where the snow lay, packed dune
 *  where the ice ran, red sandstone on the steep faces, and palms, hoodoos
 *  and barrel cacti where the snow has its trees. */
export const desert: SledMap = {
    name: "desert",
    //  Half again the snow's: the old sled ran sand on the snow's numbers
    //  so 29 tuned levels kept their feel, and these tracks are tuned for
    //  the desert alone. A sand lane costs 0.06/s against snow's 0.04/s,
    //  and a shoulder's edge 0.6/s against 0.4/s.
    dragPerMetre: snowDragPerMetre * 1.5,
    //  The packed dune paints a shade darker and pinker than the loose
    //  sand, and shines a little, as a crust the wind packed does.
    paint: { snow: 0xffffff, ice: 0xe8cdb8 },
    //  The old sled's sand, measured off its desert board. The snow's tile
    //  is a near-white field of wind ridges, as the old sand tile was, so
    //  the albedo carries the whole of the sand's colour.
    albedo: 0xe8c48c,
    emissive: 0x060402,
    tiles: {
        snow: { color: snowTile, normal: snowNormal, roughness: 0.95 },
        ice: { color: snowTile, normal: snowNormal, roughness: 0.7 },
    },
    terrain: {
        //  The old sled's sand, measured off its desert board.
        cover: 0xe8c48c,
        //  Its sandstone, lifted so the lit faces read red-brown.
        rock: 0x8a4a32,
        haze: 0xe6c7a6,
        //  Mesas and canyon walls rather than peaks.
        height: 220,
    },
    look: {
        base: noon,
        hour: 14.5,
        sun: 1.6,
        fog: { color: "#e6c7a6", near: 80, far: 500 },
        bloom: { intensity: 0.4, threshold: 0.9 },
        ambientOcclusion: false as const,
        grading: { tint: "#ffe6c8", saturation: 0.2, contrast: 0.1 },
    },
    props: [
        {
            models: {
                palm: { url: palm, weight: 0.6 },
                hoodoo: { url: hoodoo, weight: 0.4 },
            },
            size: [3.4, 6.8],
        },
        {
            models: { "barrel-cactus": { url: barrelCactus, weight: 1 } },
            size: [1, 2],
        },
    ],
    //  The old sled's desert: a fallen palm to hop, barrel cacti that
    //  stun, and a hoodoo to go round.
    rocks: {
        [CourseKind.Slab]: palmTrunk,
        [CourseKind.Rock]: barrelCactus,
        [CourseKind.Boulder]: hoodoo,
    },
};
