import {
    BufferGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Mesh,
    MeshStandardMaterial,
    NoColorSpace,
    OctahedronGeometry,
    SphereGeometry,
    Vector3,
    type Material,
    type Texture,
} from "@spawnite/engine/three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

//  The slimes' model: the creator's slime, baked by scripts/bake-slime.mjs
//  into a dome a metre across, standing on its underside's middle and
//  facing +z, with one map for every kind. A kind's colour is laid on as
//  the gel is drawn: the shader dyes the map's blue the kind's colour, and
//  leaves the eyes, their glints and the blush as painted. Each kind has
//  three looks of the one shader, which a slime swaps between as it
//  fights: at rest, hot as it winds up an attack, and white as it is hit.
//  Every slime of a kind shares its looks, and every kind the mesh.

export const slimeModelUrl = `${import.meta.env.BASE_URL}models/monsters/slime.glb`;

/** Metres, on the metre-wide model, from its underside to the top of its
 *  dome. */
export const slimeHeight = 0.73;

/** The gel's colour in the map, which the bake writes into the file, for a
 *  file without it. */
const paintedGel = "#1694e6";

/** How brightly the gel lights itself from within, all over and at its
 *  edges: without it, a slime with the sun behind it is a dark lump on the
 *  grass. */
const innerGlow = 0.35;
const edgeGlow = 1;

/** Seconds of the game's clock, which a winding-up look throbs by. Any
 *  slime drawing a frame sets it; every look reads the one value. */
export const slimeClock = { value: 0 };

export type SlimeLook = {
    geometry: BufferGeometry;
    rest: Material;
    windUp: Material;
    hurt: Material;
};

/** A colour's channels as written, 0 to 1. */
function channelsOf(hex: string) {
    return new Vector3(
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
    );
}

/** A colour's hue, from 0 round to 1. */
function hueOf(hex: string) {
    const { x: r, y: g, z: b } = channelsOf(hex);
    const max = Math.max(r, g, b);
    const delta = max - Math.min(r, g, b);
    if (delta === 0) return 0;
    if (max === r) return (((g - b) / delta + 6) % 6) / 6;
    if (max === g) return ((b - r) / delta + 2) / 6;
    return ((r - g) / delta + 4) / 6;
}

const gelShader = /* glsl */ `
uniform float uGelHue;
uniform vec3 uDye;
uniform float uHeat;
uniform float uHurt;
uniform float uTime;

vec3 slimeHsv(vec3 c) {
    vec4 k = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, k.wz), vec4(c.gb, k.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    //  Kept above what a phone's half floats hold, so a grey never
    //  divides by nothing.
    float e = 1.0e-4;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
`;

//  The map holds its colours as painted, not decoded, so the gel is found
//  and dyed in the terms it was painted in, then decoded for the light. A
//  texel is gel as far as its hue is the gel's, it is not grey, and it is
//  not dark: the eyes are a dark navy, the glints white, and the blush a
//  mauve further round the hues than the gel's blue. Each texel moves by
//  its share of gel times the way from the gel's colour to the kind's, so
//  the gel takes the kind's colour with its own light and shade, and the
//  soft edge where an eye or the blush meets the gel takes the kind's
//  colour as far as it is gel.
const gelFragment = /* glsl */ `
#ifdef USE_MAP
{
    vec3 painted = texture2D(map, vMapUv).rgb;
    vec3 hsv = slimeHsv(painted);
    float turn = fract(hsv.x - uGelHue + 0.5) - 0.5;
    float gel = (1.0 - smoothstep(0.04, 0.2, turn))
        * (1.0 - smoothstep(0.06, 0.15, -turn))
        * smoothstep(0.12, 0.3, hsv.y)
        * smoothstep(0.12, 0.75, hsv.z);
    vec3 dyed = clamp(painted + gel * uDye, 0.0, 1.0);
    diffuseColor.rgb *= sRGBTransferEOTF(vec4(dyed, 1.0)).rgb;
}
#endif
//  Winding up, it reddens and throbs with heat; hit, it flashes white.
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.16, 0.06), uHeat * 0.3);
totalEmissiveRadiance += uHeat * (0.22 + 0.18 * sin(uTime * 36.0)) * vec3(1.0, 0.22, 0.05);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uHurt * 0.7);
totalEmissiveRadiance += uHurt * vec3(0.5);
`;

//  Gel is lit from within: light that enters it scatters and comes out all
//  over, and most at its edges, where the eye looks through the most of it.
const glowFragment = /* glsl */ `
#include <emissivemap_fragment>
{
    float facing = abs(dot(normal, normalize(vViewPosition)));
    totalEmissiveRadiance += diffuseColor.rgb
        * (${innerGlow.toFixed(2)} + ${edgeGlow.toFixed(2)} * pow(1.0 - facing, 3.0));
}
`;

/** A glossy gel in `color`, one of a kind's three looks. Every look is
 *  built by this one function, so all share one compiled shader and differ
 *  only in their uniforms. */
function gelMaterial(
    map: Texture,
    color: string,
    gel: string,
    heat: number,
    hurt: number,
) {
    const uniforms = {
        uGelHue: { value: hueOf(gel) },
        uDye: { value: channelsOf(color).sub(channelsOf(gel)) },
        uHeat: { value: heat },
        uHurt: { value: hurt },
        uTime: slimeClock,
    };
    const material = new MeshStandardMaterial({
        map,
        roughness: 0.32,
        metalness: 0,
    });
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${gelShader}`)
            .replace("#include <map_fragment>", gelFragment)
            .replace("#include <emissivemap_fragment>", glowFragment);
    };
    return material;
}

const looks = new WeakMap<GLTF, Map<string, SlimeLook>>();

/** The looks of a slime in `color`, made once per colour and shared. */
export function slimeLook(gltf: GLTF, color: string): SlimeLook {
    let byColor = looks.get(gltf);
    if (!byColor) {
        byColor = new Map();
        looks.set(gltf, byColor);
    }
    const made = byColor.get(color);
    if (made) return made;
    let mesh: Mesh | undefined;
    gltf.scene.traverse((node) => {
        if ((node as Mesh).isMesh) mesh ??= node as Mesh;
    });
    const painted = mesh!.material as MeshStandardMaterial;
    const map = painted.map!;
    //  Read as painted: the shader decodes it once the gel is dyed.
    if (map.colorSpace !== NoColorSpace) {
        map.colorSpace = NoColorSpace;
        map.needsUpdate = true;
    }
    const gel = (painted.userData.gel as string | undefined) ?? paintedGel;
    const look = {
        geometry: mesh!.geometry,
        rest: gelMaterial(map, color, gel, 0, 0),
        windUp: gelMaterial(map, color, gel, 1, 0),
        hurt: gelMaterial(map, color, gel, 0, 1),
    };
    byColor.set(color, look);
    return look;
}

/** `geometry` in one colour all over, as a colour per corner. */
function inColour(geometry: BufferGeometry, hex: string) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const { r, g, b } = new Color(hex);
    const count = flat.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let corner = 0; corner < count; corner++)
        colors.set([r, g, b], corner * 3);
    flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return flat;
}

let crown: { geometry: BufferGeometry; material: Material } | undefined;

/** A boss's crown, in the model's metre-wide units, in the gold and ruby
 *  the sprite's was painted in: a band with five points, a bead on each,
 *  and a ruby at the front. One mesh, drawn in one go, shared by every
 *  boss. */
export function crownParts() {
    if (crown) return crown;
    const gold = "#f2c230";
    const parts = [
        inColour(new CylinderGeometry(0.2, 0.18, 0.08, 20, 1, true), gold),
    ];
    for (let point = 0; point < 5; point++) {
        const angle = (point / 5) * Math.PI * 2;
        const x = Math.sin(angle) * 0.185;
        const z = Math.cos(angle) * 0.185;
        parts.push(
            inColour(
                new ConeGeometry(0.045, 0.1, 8).translate(x, 0.09, z),
                gold,
            ),
            inColour(
                new SphereGeometry(0.022, 8, 6).translate(x, 0.145, z),
                "#fff3b0",
            ),
        );
    }
    parts.push(
        inColour(new OctahedronGeometry(0.035).translate(0, 0, 0.2), "#e0233a"),
    );
    crown = {
        geometry: mergeGeometries(parts)!,
        material: new MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.35,
            metalness: 0.3,
            //  Lit a little from within, as there is no sky in it to shine.
            emissive: "#5a4000",
            //  The band is open: its inside shows over the far rim.
            side: DoubleSide,
        }),
    };
    return crown;
}
