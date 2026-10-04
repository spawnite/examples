import {
    Color,
    Object3D,
    Vector3,
    type Material,
    type MeshStandardMaterial,
    type WebGLProgramParametersWithUniforms,
} from "three";
import type { SkinnedCopyPart } from "@spawnite/engine";
import { createMark, MarkKind, type Mark } from "./marks";
import type { MonsterLook } from "./motion";
import type { EyeSprites } from "./models";

//  A monster's skin: its kind's body colour graded darker, a rim of its
//  colour round its outline so it reads against the dusk ground, eyes that
//  glow, the tint a hit and a wind-up light it with, and the frost a chill
//  coats it in. A monster its
//  kind's batch draws lights its own copy's values there; one drawn on its
//  own, the colossus, keeps its own materials. All share one shader but
//  the brute file's halo cut and the colossus's seams.

/** One monster's own values its shader reads. */
interface RimUniforms {
    rimColor: { value: Color };
    rimPower: { value: number };
}

/** A part of a model's file to leave out: the fragments of the material
 *  named `material` that stand above `above` on `axis` and beyond `beyond`
 *  on `across`, in the file's own units before any bone moves them. */
export interface CutAway {
    material: string;
    axis: "x" | "y" | "z";
    above: number;
    across: "x" | "y" | "z";
    beyond: number;
}

/** Molten seams over a body: their glow, and how many waves of them a
 *  unit of the file's space holds. */
interface SeamUniforms {
    seamColor: { value: Color };
    seamScale: { value: number };
}

/** What a model's body is dressed with beyond its rim. */
export interface BodyDressing {
    /** The seams' colour, for a body that burns through its skin. */
    seams?: string;
}

/** What a monster's copy in its kind's batch sets for itself: its glow,
 *  and its rim's colour. */
export interface MonsterUniforms extends Record<string, Color> {
    emissive: Color;
    rimColor: Color;
}

/** The values a batch of monsters starts each copy with. */
export function createMonsterUniforms(): MonsterUniforms {
    return { emissive: new Color(0, 0, 0), rimColor: new Color(0, 0, 0) };
}

/** A part of a monster's copy in its batch, and whether it draws its
 *  eyes, which glow instead of taking the rim. */
interface BatchedPart {
    part: SkinnedCopyPart<MonsterUniforms>;
    eyes: boolean;
}

export interface MonsterSkin {
    /** Its own materials, where it draws on its own. */
    body: MeshStandardMaterial[];
    eyes: MeshStandardMaterial[];
    /** Its copy's parts, where its kind's batch draws it. */
    parts: BatchedPart[];
    rim: RimUniforms;
    /** Its seams' glow, where its body has seams, and their colour. */
    seams: SeamUniforms | undefined;
    seamBase: Color;
    /** The kind's colours, written into the materials each frame. */
    rimBase: Color;
    tint: Color;
    eyeGlow: Color;
    /** How lit by a hit it is, 1 to 0, and how much of that washes its
     *  body, so a body keeps fading as it falls. */
    flash: number;
    wash: number;
}

/** How sharp the rim is: higher hugs the outline closer. */
const rimPower = 3;
/** The rim's strength at rest, and how much a hit and a wind-up add. */
const rimRest = 0.4;
const rimFlash = 1.6;
const rimThreat = 0.2;
/** The eyes' glow over their colour: above 1 so the bloom picks them up. */
const eyeStrength = 3.2;

//  The rim grows with distance, to 2.6 times its strength from 6 m to
//  26 m away, so a monster 20 m out keeps an outline a few pixels wide
//  against the night's grass, which a nearer one needs less of.
const rimFragment = [
    "#include <emissivemap_fragment>",
    "float rimFacing = 1.0 - saturate(dot(normal, normalize(vViewPosition)));",
    "float rimReach = mix(1.0, 2.6, smoothstep(6.0, 26.0, length(vViewPosition)));",
    "totalEmissiveRadiance += rimColor * pow(rimFacing, rimPower) * rimReach;",
].join("\n");

//  The same text for every monster, so three builds the program once.
function patchShader(
    this: RimUniforms,
    shader: WebGLProgramParametersWithUniforms,
) {
    shader.uniforms.rimColor = this.rimColor;
    shader.uniforms.rimPower = this.rimPower;
    shader.fragmentShader = shader.fragmentShader
        .replace(
            "#include <common>",
            "#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;",
        )
        .replace("#include <emissivemap_fragment>", rimFragment);
}

const programKey = () => "holdfast-monster-skin";

/** Passes each point's place in the model's file, before any bone moves
 *  it, to the fragment shader as `vFilePosition`. */
function passFilePosition(shader: WebGLProgramParametersWithUniforms) {
    if (shader.vertexShader.includes("vFilePosition")) return;
    shader.vertexShader = shader.vertexShader
        .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vFilePosition;",
        )
        .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvFilePosition = position;",
        );
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vFilePosition;",
    );
}

/** Leaves out the fragments of a material that `cut` names, by where they
 *  stand in the model's file. */
function patchCut(cut: CutAway, shader: WebGLProgramParametersWithUniforms) {
    passFilePosition(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        [
            "#include <clipping_planes_fragment>",
            `if (vFilePosition.${cut.axis} > ${cut.above.toFixed(6)} && vFilePosition.${cut.across} > ${cut.beyond.toFixed(6)}) discard;`,
        ].join("\n"),
    );
}

//  The colossus's seams: a net of thin molten lines over its charred body,
//  where three crossed waves of each point's place in the file meet zero,
//  so the seams ride the body as it walks.
const seamFragment = [
    "#include <emissivemap_fragment>",
    "vec3 seamAt = vFilePosition * seamScale;",
    "float seamWave = sin(seamAt.x * 1.7 + sin(seamAt.z * 1.3) * 2.0)",
    "    + sin(seamAt.z * 2.1 + sin(seamAt.y * 1.9) * 2.0)",
    "    + sin(seamAt.y * 1.5 + sin(seamAt.x * 2.3) * 2.0);",
    "float seam = 1.0 - smoothstep(0.0, 0.22, abs(seamWave));",
    "totalEmissiveRadiance += seamColor * seam;",
].join("\n");

function patchSeams(
    seams: SeamUniforms,
    shader: WebGLProgramParametersWithUniforms,
) {
    passFilePosition(shader);
    shader.uniforms.seamColor = seams.seamColor;
    shader.uniforms.seamScale = seams.seamScale;
    shader.fragmentShader = shader.fragmentShader
        .replace(
            "#include <common>",
            "#include <common>\nuniform vec3 seamColor;\nuniform float seamScale;",
        )
        .replace("#include <emissivemap_fragment>", seamFragment);
}

export function createMonsterSkin(
    look: MonsterLook,
    { seams }: BodyDressing = {},
): MonsterSkin {
    return {
        body: [],
        eyes: [],
        parts: [],
        rim: {
            rimColor: { value: new Color() },
            rimPower: { value: rimPower },
        },
        seams: seams
            ? {
                  seamColor: { value: new Color(seams) },
                  seamScale: { value: seamScale },
              }
            : undefined,
        seamBase: new Color(seams ?? "#000000").multiplyScalar(seamStrength),
        rimBase: new Color(look.rim),
        tint: new Color(look.eyes),
        eyeGlow: new Color(look.eyes).multiplyScalar(eyeStrength),
        flash: 0,
        wash: 1,
    };
}

interface DressOptions {
    skin: MonsterSkin;
    material: MeshStandardMaterial;
    look: MonsterLook;
    /** Whether the material draws the eyes, which glow instead. */
    eyes: boolean;
    cut?: CutAway;
}

/** Dresses one of the monster's own materials: graded and rimmed, or, for
 *  its eyes, lit. */
export function dressMaterial(options: DressOptions) {
    const { skin, material, look, eyes, cut } = options;
    if (eyes) {
        skin.eyes.push(material);
        return;
    }
    material.color.multiply(new Color(look.body));
    addRim(material, {
        rim: skin.rim,
        cut: cut?.material === material.name ? cut : undefined,
        //  Seams on the skin only, not on the horns and the weapon.
        seams: material.name === seamMaterial ? skin.seams : undefined,
    });
    skin.body.push(material);
}

/** The model's body material the seams burn through. */
const seamMaterial = "Demon_Main";
/** Seam waves a unit of the file's space holds: the brute's file stands
 *  0.03 units tall, so about eight seams from its feet to its horns. */
const seamScale = 700;
/** The seams' glow over their colour: above 1 so the bloom picks them up. */
const seamStrength = 1.8;

interface RimDressing {
    rim: RimUniforms;
    cut: CutAway | undefined;
    seams: SeamUniforms | undefined;
}

/** Gives `material` the rim `rim` colours and sharpens, and its cut and
 *  seams where it has them. */
function addRim(material: Material, { rim, cut, seams }: RimDressing) {
    material.onBeforeCompile = (shader) => {
        patchShader.call(rim, shader);
        if (cut) patchCut(cut, shader);
        if (seams) patchSeams(seams, shader);
    };
    const key = [
        programKey(),
        cut ? `${cut.axis}${cut.above}${cut.across}${cut.beyond}` : "",
        seams ? "seams" : "",
    ].join("|");
    material.customProgramCacheKey = () => key;
}

/** A batch part's material, from the model's own: rimmed where it draws
 *  the body, as it comes where it draws the eyes. Each copy's colour, glow
 *  and rim are its own values in the batch, read over these. */
export function dressBatchMaterial(
    material: Material,
    eyes: boolean,
    cut?: CutAway,
) {
    const dressed = material.clone();
    if (!eyes)
        addRim(dressed, {
            rim: {
                rimColor: { value: new Color() },
                rimPower: { value: rimPower },
            },
            cut: cut?.material === material.name ? cut : undefined,
            seams: undefined,
        });
    return dressed;
}

/** Hands a monster's skin its copy's parts in its kind's batch, each body
 *  part tinted its kind's colour, as `dressMaterial` grades its own. */
export function batchSkin(
    skin: MonsterSkin,
    parts: readonly SkinnedCopyPart<MonsterUniforms>[],
    { body, eyeMaterial }: { body: string; eyeMaterial?: string },
) {
    const bodyColor = new Color(body);
    for (const part of parts) {
        const { name } = part.mesh.material as Material;
        const eyes = eyeMaterial !== undefined && name === eyeMaterial;
        if (!eyes) part.color.copy(bodyColor);
        skin.parts.push({ part, eyes });
    }
}

const white = new Color("#ffffff");
//  Written in place.
const glow = new Color();

/** How lit a skin is this frame. */
export interface SkinLight {
    /** 1 at a hit fading to 0, white going to the kind's colour. */
    flash: number;
    /** How much of the flash washes the body, 0 to 1; the rim takes all
     *  of it. 0 keeps the body its own colour, for a monster hit faster
     *  than a flash fades. */
    wash: number;
    /** 0 to 1 as it winds up. */
    threat: number;
    /** 0 to 1 as frost coats it: its rim turns ice blue and a pale cold
     *  glow comes up in its body. 0 when it is not chilled. */
    frost?: number;
}

/** Frost's colours on a skin: an ice-blue rim, bright enough to read as
 *  frost at the fight camera, and a faint cold glow in the body. */
const frostRim = new Color("#8fd8ff").multiplyScalar(1.8);
const frostGlow = new Color("#5fd0ff").multiplyScalar(0.22);
//  Written in place for each skin.
const frosted = new Color();

/** Lights the skin for this frame. */
export function paintSkin(
    skin: MonsterSkin,
    { flash, wash, threat, frost = 0 }: SkinLight,
) {
    skin.flash = flash;
    skin.wash = wash;
    const washed = flash * wash;
    glow.copy(skin.tint)
        .multiplyScalar(threat * 0.06 + washed * 0.5)
        .lerp(white, washed * washed * 0.8)
        .add(frosted.copy(frostGlow).multiplyScalar(frost * frost));
    for (const material of skin.body) material.emissive.copy(glow);
    //  The seams burn hotter as it winds up.
    skin.seams?.seamColor.value
        .copy(skin.seamBase)
        .multiplyScalar(1 + threat * 1.5);
    for (const material of skin.eyes)
        material.emissive.copy(skin.eyeGlow).add(glow);
    const rim = skin.rim.rimColor.value
        .copy(skin.rimBase)
        .multiplyScalar(rimRest + rimThreat * threat)
        //  A light chill a thin rim of frost, a heavy one a full coat.
        .lerp(frostRim, frost * frost)
        .lerp(white, flash * 0.5)
        .multiplyScalar(1 + rimFlash * flash);
    for (const { part, eyes } of skin.parts) {
        if (eyes) part.uniforms.emissive.copy(skin.eyeGlow).add(glow);
        else part.uniforms.emissive.copy(glow);
        part.uniforms.rimColor.copy(rim);
    }
}

const headAt = new Vector3();
const eyeAt = new Vector3();
const headScale = new Vector3();

interface EyeSpriteOptions {
    object: Object3D;
    sprites: EyeSprites;
    color: string;
}

/** Glowing eyes on a model whose eyes are painted in its texture: a small
 *  glow on each side of its head bone, so they turn as it does, each a mark
 *  the eye layer draws. The model stands at its rest pose when this runs. */
export function addEyeGlows(options: EyeSpriteOptions): Mark[] {
    const { object, sprites: eyes, color } = options;
    const head = object.getObjectByName(eyes.bone);
    if (!head) return [];
    object.updateMatrixWorld(true);
    head.getWorldPosition(headAt);
    head.getWorldScale(headScale);
    //  Short of full saturation, above 1 for the bloom.
    const glow = new Color(color).lerp(white, 0.3).multiplyScalar(2.4);
    return [-1, 1].map((side) => {
        const mark = createMark(MarkKind.Glow, new Object3D());
        eyeAt.set(side * eyes.apart, eyes.up, eyes.forward).add(headAt);
        mark.object.position.copy(head.worldToLocal(eyeAt));
        mark.object.scale.setScalar(eyes.size / headScale.x);
        mark.color.copy(glow);
        head.add(mark.object);
        return mark;
    });
}
