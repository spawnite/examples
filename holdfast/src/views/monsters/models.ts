import brute from "@spawnite/assets/models/holdfast/brute.glb?url";
import husk from "@spawnite/assets/models/holdfast/husk.glb?url";
import skitter from "@spawnite/assets/models/holdfast/skitter.glb?url";
import { useModel } from "@spawnite/engine";
import { MonsterKind } from "../../siege/traits";
import type { CutAway } from "./skin";

//  Each kind's model, how big it stands, and which of its clips it walks,
//  strikes, falls and flinches with. The files name their clips after the
//  pack's rig, so each is found by the end of its name.

/** Which clip plays for what a monster does. */
export enum MonsterClip {
    Walk = "walk",
    Strike = "strike",
    Fall = "fall",
    Flinch = "flinch",
}

export interface MonsterModel {
    url: string;
    /** The model's size in the world: the kind's height over the file's. */
    scale: number;
    /** The end of each clip's name; a kind with no flinch leaves it out. */
    clips: Partial<Record<MonsterClip, string>>;
    /** Metres a second the walk clip covers at its own pace, so a faster
     *  monster plays it faster. */
    walkMetresPerSecond: number;
    /** The name of the material its eyes are drawn with, lit to glow. */
    eyeMaterial?: string;
    /** Glows for eyes a model paints in its texture instead. */
    eyeSprites?: EyeSprites;
    /** Metres across the soft shadow under it. */
    shadowMetres: number;
    /** A part of its file it draws without. */
    cut?: CutAway;
    /** The colour of the molten seams its body burns with, if any. */
    seams?: string;
}

/** The halo the brute's file floats over its horns, in its dark material:
 *  above the crown of its head and behind its horns, which stand forward
 *  of it. Read from the file's parts with gltf-transform. */
const bruteHalo: CutAway = {
    material: "Black",
    axis: "z",
    above: 0.02705,
    across: "y",
    beyond: -0.0032,
};

/** Where a model's eye glows sit, in its file's metres from its head bone,
 *  the model facing positive z. */
export interface EyeSprites {
    bone: string;
    apart: number;
    up: number;
    forward: number;
    /** Across each glow. */
    size: number;
}

export const monsterModels: Record<MonsterKind, MonsterModel> = {
    //  2.74 m tall in its file, drawn at 1.65 m.
    [MonsterKind.Husk]: {
        url: husk,
        scale: 0.6,
        clips: {
            [MonsterClip.Walk]: "|Run",
            [MonsterClip.Strike]: "|Attack",
            [MonsterClip.Fall]: "|Death",
            [MonsterClip.Flinch]: "|HitRecieve",
        },
        walkMetresPerSecond: 3.2,
        eyeSprites: {
            bone: "Head",
            apart: 0.1,
            up: 0.2,
            forward: 0.25,
            size: 0.16,
        },
        shadowMetres: 1.5,
    },
    //  2 m tall and 5.9 m across its legs in its file, drawn at 0.7 m tall.
    [MonsterKind.Skitter]: {
        url: skitter,
        scale: 0.35,
        clips: {
            [MonsterClip.Walk]: "|Spider_Walk",
            [MonsterClip.Strike]: "|Spider_Attack",
            [MonsterClip.Fall]: "|Spider_Death",
        },
        walkMetresPerSecond: 3,
        eyeMaterial: "Material.001",
        shadowMetres: 1.6,
    },
    //  2.94 m tall in its file, drawn at 2.5 m.
    [MonsterKind.Brute]: {
        url: brute,
        scale: 0.85,
        clips: {
            [MonsterClip.Walk]: "|Walk",
            [MonsterClip.Strike]: "|Weapon",
            [MonsterClip.Fall]: "|Death",
            [MonsterClip.Flinch]: "|HitReact",
        },
        walkMetresPerSecond: 1.8,
        eyeMaterial: "Eye_White",
        shadowMetres: 2.6,
        cut: bruteHalo,
    },
    //  The husk's model, drawn at 1.5 m.
    [MonsterKind.Spitter]: {
        url: husk,
        scale: 0.55,
        clips: {
            [MonsterClip.Walk]: "|Run",
            [MonsterClip.Strike]: "|Attack",
            [MonsterClip.Fall]: "|Death",
            [MonsterClip.Flinch]: "|HitRecieve",
        },
        walkMetresPerSecond: 2.9,
        eyeSprites: {
            bone: "Head",
            apart: 0.1,
            up: 0.2,
            forward: 0.25,
            size: 0.16,
        },
        shadowMetres: 1.4,
    },
    //  The brute's model, drawn at 4.2 m, charred dark with molten seams and
    //  no halo, and a longer stride than the brute's, so it lumbers. It
    //  strikes with its slam, whose wind-up plays the strike clip.
    [MonsterKind.Colossus]: {
        url: brute,
        scale: 1.43,
        clips: {
            [MonsterClip.Walk]: "|Walk",
            [MonsterClip.Strike]: "|Weapon",
            [MonsterClip.Fall]: "|Death",
            [MonsterClip.Flinch]: "|HitReact",
        },
        walkMetresPerSecond: 4.4,
        eyeMaterial: "Eye_White",
        shadowMetres: 4.4,
        cut: bruteHalo,
        seams: "#ff5a14",
    },
};

/** What decides a model's shaders: its file, which of its materials glow
 *  as eyes, and its cut and seams. */
export function readModelDressing({
    url,
    eyeMaterial,
    eyeSprites,
    cut,
    seams,
}: MonsterModel) {
    return [
        url,
        eyeMaterial ?? "",
        eyeSprites ? "sprites" : "",
        cut ? "cut" : "",
        seams ? "seams" : "",
    ].join("|");
}

/** One kind for each way a model file is dressed: kinds dressed alike
 *  share their shaders. */
export function listModelKinds() {
    const kinds = new Map<string, MonsterKind>();
    for (const [kind, model] of Object.entries(monsterModels) as [
        MonsterKind,
        MonsterModel,
    ][]) {
        const dressing = readModelDressing(model);
        if (!kinds.has(dressing)) kinds.set(dressing, kind);
    }
    return [...kinds.values()];
}

/** Starts fetching every kind's model while the page shows its menu. */
export function preloadMonsterModels() {
    for (const { url } of Object.values(monsterModels)) useModel.preload(url);
}
