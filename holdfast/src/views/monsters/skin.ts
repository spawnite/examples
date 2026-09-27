import {
    AdditiveBlending,
    Color,
    Sprite,
    SpriteMaterial,
    Vector3,
    type MeshStandardMaterial,
    type Object3D,
    type WebGLProgramParametersWithUniforms,
} from "three";
import { readGlowTexture } from "../glowTexture";
import type { MonsterLook } from "./motion";
import type { EyeSprites } from "./models";

//  A monster's skin: its kind's body colour graded darker, a rim of its
//  colour round its outline so it reads against the dusk ground, eyes that
//  glow, and the tint a hit and a wind-up light it with. Each monster keeps
//  its own materials for its own tint; they all share one shader program.

/** One monster's own values its shader reads. */
interface RimUniforms {
    rimColor: { value: Color };
    rimPower: { value: number };
}

export interface MonsterSkin {
    body: MeshStandardMaterial[];
    eyes: MeshStandardMaterial[];
    rim: RimUniforms;
    /** The kind's colours, written into the materials each frame. */
    rimBase: Color;
    tint: Color;
    eyeGlow: Color;
    /** How lit by a hit it is, 1 to 0, so a body keeps fading as it falls. */
    flash: number;
}

/** How sharp the rim is: higher hugs the outline closer. */
const rimPower = 4;
/** The rim's strength at rest, and how much a hit and a wind-up add. */
const rimRest = 0.16;
const rimFlash = 1.6;
const rimThreat = 0.2;
/** The eyes' glow over their colour: above 1 so the bloom picks them up. */
const eyeStrength = 2.2;

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
        .replace(
            "#include <emissivemap_fragment>",
            [
                "#include <emissivemap_fragment>",
                "float rimFacing = 1.0 - saturate(dot(normal, normalize(vViewPosition)));",
                "totalEmissiveRadiance += rimColor * pow(rimFacing, rimPower);",
            ].join("\n"),
        );
}

const programKey = () => "holdfast-monster-skin";

export function createMonsterSkin(look: MonsterLook): MonsterSkin {
    return {
        body: [],
        eyes: [],
        rim: {
            rimColor: { value: new Color() },
            rimPower: { value: rimPower },
        },
        rimBase: new Color(look.rim),
        tint: new Color(look.eyes),
        eyeGlow: new Color(look.eyes).multiplyScalar(eyeStrength),
        flash: 0,
    };
}

interface DressOptions {
    skin: MonsterSkin;
    material: MeshStandardMaterial;
    look: MonsterLook;
    /** Whether the material draws the eyes, which glow instead. */
    eyes: boolean;
}

/** Dresses one of the monster's own materials: graded and rimmed, or, for
 *  its eyes, lit. */
export function dressMaterial(options: DressOptions) {
    const { skin, material, look, eyes } = options;
    if (eyes) {
        skin.eyes.push(material);
        return;
    }
    material.color.multiply(new Color(look.body));
    material.onBeforeCompile = patchShader.bind(skin.rim);
    material.customProgramCacheKey = programKey;
    skin.body.push(material);
}

const white = new Color("#ffffff");
//  Written in place.
const glow = new Color();

/** How lit a skin is this frame. */
export interface SkinLight {
    /** 1 at a hit fading to 0, white going to the kind's colour. */
    flash: number;
    /** 0 to 1 as it winds up. */
    threat: number;
}

/** Lights the skin for this frame. */
export function paintSkin(skin: MonsterSkin, { flash, threat }: SkinLight) {
    skin.flash = flash;
    glow.copy(skin.tint)
        .multiplyScalar(threat * 0.06 + flash * 0.5)
        .lerp(white, flash * flash * 0.8);
    for (const material of skin.body) material.emissive.copy(glow);
    for (const material of skin.eyes)
        material.emissive.copy(skin.eyeGlow).add(glow);
    skin.rim.rimColor.value
        .copy(skin.rimBase)
        .multiplyScalar(rimRest + rimThreat * threat)
        .lerp(white, flash * 0.5)
        .multiplyScalar(1 + rimFlash * flash);
}

/** Each colour's glow sprite, shared by every monster whose eyes it lights. */
const eyeSpriteMaterials = new Map<string, SpriteMaterial>();

function readEyeSpriteMaterial(color: string) {
    let material = eyeSpriteMaterials.get(color);
    if (!material) {
        material = new SpriteMaterial({
            map: readGlowTexture(),
            //  Short of full saturation, above 1 for the bloom.
            color: new Color(color).lerp(white, 0.3).multiplyScalar(2.4),
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        eyeSpriteMaterials.set(color, material);
    }
    return material;
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
 *  glow on each side of its head bone, so they turn as it does. The model
 *  stands at its rest pose when this runs. */
export function addEyeSprites(options: EyeSpriteOptions) {
    const { object, sprites: eyes, color } = options;
    const head = object.getObjectByName(eyes.bone);
    if (!head) return;
    object.updateMatrixWorld(true);
    head.getWorldPosition(headAt);
    head.getWorldScale(headScale);
    for (const side of [-1, 1]) {
        const sprite = new Sprite(readEyeSpriteMaterial(color));
        eyeAt.set(side * eyes.apart, eyes.up, eyes.forward).add(headAt);
        sprite.position.copy(head.worldToLocal(eyeAt));
        sprite.scale.setScalar(eyes.size / headScale.x);
        head.add(sprite);
    }
}
