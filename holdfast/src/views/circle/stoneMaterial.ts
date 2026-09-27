import { Color, MeshStandardMaterial } from "three";

//  The circle's one stone: a weathered grey, darker and mossy at its foot,
//  its upward faces worn pale, and on a standing stone's inner face runes
//  cut into it that burn with the siege's colour. Drawn in the material's
//  own shader, so a rune follows the stone's faces and costs no extra draw.

/** What every standing stone's runes share, set once a frame. */
export const runeUniforms = {
    uRuneColor: { value: new Color("#58c8ff") },
    uRunePower: { value: 2 },
    uTime: { value: 0 },
};

const varyings = /* glsl */ `
varying vec3 vStoneLocal;
varying vec3 vStoneNormal;
varying vec3 vStoneWorld;
varying float vStoneSeed;
`;

/** Value noise and the runes' strokes. */
const stoneFunctions = /* glsl */ `
uniform float uStoneHeight;
float stoneHash(vec3 point) {
    point = fract(point * 0.3183099 + 0.1);
    point *= 17.0;
    return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
}
float stoneNoise(vec3 point) {
    vec3 cell = floor(point);
    vec3 part = fract(point);
    part = part * part * (3.0 - 2.0 * part);
    return mix(
        mix(mix(stoneHash(cell), stoneHash(cell + vec3(1, 0, 0)), part.x),
            mix(stoneHash(cell + vec3(0, 1, 0)), stoneHash(cell + vec3(1, 1, 0)), part.x), part.y),
        mix(mix(stoneHash(cell + vec3(0, 0, 1)), stoneHash(cell + vec3(1, 0, 1)), part.x),
            mix(stoneHash(cell + vec3(0, 1, 1)), stoneHash(cell + vec3(1, 1, 1)), part.x), part.y),
        part.z);
}
float segmentDistance(vec2 point, vec2 from, vec2 to) {
    vec2 along = to - from;
    float reach = clamp(dot(point - from, along) / dot(along, along), 0.0, 1.0);
    return length(point - from - along * reach);
}
//  One rune in a box from -1 to 1: a stave and two or three branches,
//  picked by the seed.
float runeDistance(vec2 point, float seed) {
    float first = fract(seed * 7.13) > 0.5 ? 1.0 : -1.0;
    float second = fract(seed * 3.71) > 0.5 ? 1.0 : -1.0;
    float rise = fract(seed * 5.37) > 0.5 ? 0.55 : -0.55;
    float closest = segmentDistance(point, vec2(0.0, -1.0), vec2(0.0, 1.0));
    closest = min(closest, segmentDistance(point, vec2(0.0, 0.7), vec2(first * 0.75, 0.2)));
    closest = min(closest, segmentDistance(point, vec2(0.0, -0.1), vec2(second * 0.75, -0.1 + rise)));
    if (fract(seed * 11.9) > 0.5)
        closest = min(closest, segmentDistance(point, vec2(0.0, 0.7), vec2(-first * 0.75, 0.2)));
    return closest;
}
`;

/** Weathering: noise, a darker and mossy foot, pale worn tops. */
const weatherFragment = /* glsl */ `
float stoneRise = clamp(vStoneLocal.y / uStoneHeight, 0.0, 1.0);
float stoneBlotch = stoneNoise(vStoneWorld * 1.3) * 0.6 + stoneNoise(vStoneWorld * 4.1) * 0.4;
float stoneStreak = stoneNoise(vStoneWorld * vec3(5.0, 0.6, 5.0));
diffuseColor.rgb *= 0.78 + stoneBlotch * 0.4;
diffuseColor.rgb *= 1.0 - smoothstep(0.55, 0.85, stoneStreak) * 0.25;
diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.0, 0.4, stoneRise));
float stoneMoss = smoothstep(0.35, 0.05, stoneRise) * smoothstep(0.4, 0.62, stoneBlotch)
    + smoothstep(0.55, 0.9, vStoneNormal.y) * smoothstep(0.5, 0.7, stoneBlotch) * 0.7;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.26, 0.11), clamp(stoneMoss, 0.0, 0.85));
float stoneLichen = smoothstep(0.78, 0.84, stoneNoise(vStoneWorld * 7.0 + 3.1)) * smoothstep(0.3, 0.6, stoneRise);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.6, 0.45), stoneLichen * 0.5);
diffuseColor.rgb *= 1.0 + smoothstep(0.35, 0.9, vStoneNormal.y) * 0.3;
`;

/** Where the runes are on the inner face, in the model's own units, and
 *  the groove each is cut in. */
const runeFragment = /* glsl */ `
float runeFace = smoothstep(0.25, 0.55, vStoneNormal.z);
vec2 runeHalf = vec2(0.055, 0.075);
float runeStroke = min(
    runeDistance((vStoneLocal.xy - vec2(0.0, 0.5)) / runeHalf, vStoneSeed),
    runeDistance((vStoneLocal.xy - vec2(0.0, 0.32)) / runeHalf, vStoneSeed + 0.37));
float runeCore = (1.0 - smoothstep(0.1, 0.2, runeStroke)) * runeFace;
float runeHalo = exp(-runeStroke * 3.5) * 0.3 * runeFace;
diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.14, 0.3, runeStroke)) * runeFace * 0.6;
`;

const runeEmissive = /* glsl */ `
float runeShimmer = 0.8 + 0.2 * sin(uTime * 2.5 - vStoneLocal.y * 30.0);
totalEmissiveRadiance += uRuneColor * uRunePower * runeShimmer * (runeCore + runeHalo);
`;

interface StoneOptions {
    /** The model's height in its own units: its foot is 0, its top 1. */
    height: number;
    /** Whether its inner face, the model's positive z, carries the runes. */
    runes: boolean;
}

export function createStoneMaterial({ height, runes }: StoneOptions) {
    const material = new MeshStandardMaterial({
        color: "#8c8a83",
        roughness: 0.92,
        flatShading: true,
    });
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uStoneHeight = { value: height };
        if (runes) Object.assign(shader.uniforms, runeUniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>\n${varyings}`)
            .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
vStoneLocal = position;
vStoneNormal = normal;
vStoneWorld = (modelMatrix * vec4(position, 1.0)).xyz;
vStoneSeed = fract(dot(modelMatrix[3].xz, vec2(0.173, 0.291)));`,
            );
        const runeHead = runes
            ? "uniform vec3 uRuneColor;\nuniform float uRunePower;\nuniform float uTime;\n"
            : "";
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>\n${varyings}${runeHead}${stoneFunctions}`,
            )
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>\n${weatherFragment}${runes ? runeFragment : ""}`,
            )
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>\n${runes ? runeEmissive : ""}`,
            );
    };
    //  The runes change the source, so each kind compiles its own program.
    material.customProgramCacheKey = () => (runes ? "rune-stone" : "stone");
    return material;
}
