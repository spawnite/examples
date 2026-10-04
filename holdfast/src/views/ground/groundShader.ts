import { hearthMetres, ringMetres } from "../layout";
import { trackGround } from "../world/land";

//  The ground's paint, as GLSL the ground's standard material splices into
//  its own shaders: albedo, roughness and a normal from four photographed
//  surfaces, grass, packed earth, the ring's cobbles and the hearth's
//  flagstones, laid out and coloured by noise from the world position, so
//  three's light, shadows and fog still fall on it. The layout is its own
//  chunk, because the grass blades read it too and shrink where the paint
//  shows earth.

/** GLSL: the value and cell noises every layer is laid out with. */
export const groundNoise = /* glsl */ `
// A hash with no sine: exact at any coordinate on the map, and cheap.
float hashGround(vec2 point) {
    vec3 mixed = fract(vec3(point.xyx) * 0.1031);
    mixed += dot(mixed, mixed.yzx + 33.33);
    return fract((mixed.x + mixed.y) * mixed.z);
}

float noiseGround(vec2 point) {
    vec2 cell = floor(point);
    vec2 inside = fract(point);
    vec2 blend = inside * inside * (3.0 - 2.0 * inside);
    float a = hashGround(cell);
    float b = hashGround(cell + vec2(1.0, 0.0));
    float c = hashGround(cell + vec2(0.0, 1.0));
    float d = hashGround(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

// Two octaves, the second turned off the first's grid so their cells
// never line up; 0 to 1.
float fractalGround(vec2 point) {
    vec2 turned = mat2(0.8, -0.6, 0.6, 0.8) * point * 2.07 + 13.1;
    return (noiseGround(point) + noiseGround(turned) * 0.5) / 1.5;
}
`;

/** The uniforms the layout reads, by name: the ring's radius and half
 *  width and the hearth's radius, in metres. */
export const groundLayoutUniforms = {
    uRing: ringMetres.radius,
    uRingHalfWidth: ringMetres.halfWidth,
    uHearth: hearthMetres,
};

/** GLSL, for the vertex and the fragment shader alike: where each surface
 *  lies, from the world position, the road's weight and the ground's
 *  upward share, and the grass's colour at a place. No screen derivative,
 *  so a vertex can read it. Each shader declares groundLayoutUniforms
 *  ahead of it. */
export const groundLayout = /* glsl */ `
${trackGround}

struct GroundLayout {
    // Above about 0.5 the grass gives way to packed earth.
    float wear;
    // 1 on the forest floor past the circle.
    float forest;
    // 1 where the hills are too steep to hold grass.
    float steep;
    // 1 on the ring's cobbles and on the hearth's flagstones.
    float ring;
    float hearth;
    // A slow noise from -0.5 to 0.5 that raggeds every edge.
    float ragged;
};

GroundLayout layoutGround(vec2 at, float roadWeight, float up) {
    GroundLayout site;
    float radius = length(at);
    float ragged = fractalGround(at * 0.6 + 3.0) - 0.5;
    float patches = fractalGround(at * 0.17 + 5.3);
    // Packed earth: the map's roads and the tracks they run on as, the
    // ring's verges, the hearth's rim and the trodden middle, each with a
    // ragged edge where grass holds on.
    float roadShare = max(roadWeight, trackGround(at));
    float road = roadShare + ragged * 0.7;
    float ringDistance = abs(radius - uRing);
    float verge = 1.0 - smoothstep(uRingHalfWidth, uRingHalfWidth + 1.4, ringDistance);
    float rim = 1.0 - smoothstep(uHearth, uHearth + 1.1, radius);
    float trodden = (1.0 - smoothstep(4.0, 10.0, radius)) * 0.25;
    site.wear = max(road, max(max(verge, rim), trodden) + ragged * 0.8 + (patches - 0.5) * 0.3);
    site.forest = smoothstep(34.0, 42.0, radius + ragged * 4.0) * (1.0 - smoothstep(0.3, 0.6, roadShare));
    site.steep = 1.0 - smoothstep(0.66, 0.8, up + ragged * 0.08);
    site.ring = 1.0 - smoothstep(uRingHalfWidth - 0.3, uRingHalfWidth + 0.1, ringDistance + ragged * 0.7);
    site.hearth = 1.0 - smoothstep(uHearth - 0.5, uHearth, radius + ragged * 0.9);
    site.ragged = ragged;
    return site;
}

// The grass's colour at a place, in linear light: a cool deep green in the
// broad hollows, a mid green, a yellow-green in patches, moss-dark
// clumps and dry straw. The ground's grass and the blades both take it.
vec3 colourGrass(vec2 at) {
    float broad = fractalGround(at * 0.045);
    float patches = fractalGround(at * 0.17 + 5.3);
    float clump = fractalGround(at * 0.85 + 17.0);
    vec3 grass = mix(vec3(0.04, 0.1, 0.045), vec3(0.09, 0.2, 0.075), smoothstep(0.25, 0.65, broad));
    grass = mix(grass, vec3(0.2, 0.26, 0.08), smoothstep(0.5, 0.78, patches) * 0.55);
    float moss = smoothstep(0.56, 0.7, clump) * (1.0 - smoothstep(0.5, 0.75, patches));
    grass = mix(grass, vec3(0.04, 0.085, 0.035), moss * 0.8);
    float dry = smoothstep(0.64, 0.8, fractalGround(at * 0.11 + 31.0));
    return mix(grass, vec3(0.28, 0.23, 0.1), dry * 0.4);
}
`;

/** Declared in the vertex shader: what the fragment shader paints from. */
export const groundVertexDeclarations = /* glsl */ `
attribute float roadWeight;
varying vec3 vGroundPosition;
varying vec3 vGroundNormal;
varying float vRoadWeight;
`;

/** Written after three's world position. */
export const groundVertexOutputs = /* glsl */ `
vGroundPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGroundNormal = normalize(mat3(modelMatrix) * objectNormal);
vRoadWeight = roadWeight;
`;

/** One photographed surface: its colour map, its detail map (the normal's
 *  x and y, then roughness), the metres one copy spans, and its mean colour
 *  in linear light, which the paint divides out to recolour it. */
export interface GroundLayer {
    colorMap: string;
    detailMap: string;
    tileMetres: string;
    mean: string;
}

/** The uniform names of each layer, as the fragment shader declares them. */
export const groundLayers = {
    grass: {
        colorMap: "uGrassColor",
        detailMap: "uGrassDetail",
        tileMetres: "uGrassTile",
        mean: "uGrassMean",
    },
    earth: {
        colorMap: "uEarthColor",
        detailMap: "uEarthDetail",
        tileMetres: "uEarthTile",
        mean: "uEarthMean",
    },
    cobbles: {
        colorMap: "uCobbleColor",
        detailMap: "uCobbleDetail",
        tileMetres: "uCobbleTile",
        mean: "uCobbleMean",
    },
    flagstones: {
        colorMap: "uFlagColor",
        detailMap: "uFlagDetail",
        tileMetres: "uFlagTile",
        mean: "uFlagMean",
    },
} satisfies Record<string, GroundLayer>;

const layerUniforms = Object.values(groundLayers)
    .map(
        ({ colorMap, detailMap, tileMetres, mean }) => `
uniform sampler2D ${colorMap};
uniform sampler2D ${detailMap};
uniform float ${tileMetres};
uniform vec3 ${mean};`,
    )
    .join("");

/** GLSL: the paint. `paintGround` fills `groundRoughness` and
 *  `groundTangentNormal`, which the roughness and normal chunks read after
 *  it. */
export const groundFunctions = /* glsl */ `
varying vec3 vGroundPosition;
varying vec3 vGroundNormal;
varying float vRoadWeight;
${layerUniforms}
uniform float uRing;
uniform float uRingHalfWidth;
uniform float uHearth;
${groundNoise}
${groundLayout}

float groundRoughness = 0.9;
vec3 groundTangentNormal = vec3(0.0, 0.0, 1.0);

struct GroundSample {
    vec3 color;
    vec2 slope;
    float roughness;
};

// One reading of a surface: the photograph's colour over its mean, so the
// paint recolours it, the normal's tilt and the roughness.
GroundSample readGround(sampler2D colorMap, sampler2D detailMap, vec2 uv, vec3 mean) {
    GroundSample reading;
    reading.color = texture2D(colorMap, uv).rgb / mean;
    vec3 detail = texture2D(detailMap, uv).rgb;
    reading.slope = detail.rg * 2.0 - 1.0;
    reading.roughness = detail.b;
    return reading;
}

// A surface with no repeat to see: two readings, the second turned and at
// another scale, blended by a slow noise, so neither copy's grid lines up
// for more than a few metres. The second reading's tilt is turned back
// into the first's frame.
GroundSample sampleGround(sampler2D colorMap, sampler2D detailMap, vec2 at, float tileMetres, vec3 mean, float seed) {
    vec2 uv = vec2(at.x, -at.y) / tileMetres;
    float angle = 0.9 + seed;
    mat2 turn = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
    GroundSample first = readGround(colorMap, detailMap, uv, mean);
    GroundSample second = readGround(colorMap, detailMap, turn * uv * 0.73 + seed * 7.1, mean);
    second.slope = second.slope * turn;
    float share = smoothstep(0.3, 0.7, noiseGround(at / (tileMetres * 2.3) + seed * 13.0));
    GroundSample blended;
    blended.color = mix(first.color, second.color, share);
    blended.slope = mix(first.slope, second.slope, share);
    blended.roughness = mix(first.roughness, second.roughness, share);
    return blended;
}

float lumaGround(vec3 color) {
    return dot(color, vec3(0.3, 0.59, 0.11));
}

vec3 paintGround(vec3 world) {
    vec2 at = world.xz;
    float radius = length(at);
    GroundLayout site = layoutGround(at, vRoadWeight, vGroundNormal.y);
    float clump = fractalGround(at * 0.85 + 17.0);
    float patches = fractalGround(at * 0.17 + 5.3);

    // The land past the map is forest floor and track alone, so it reads
    // no grass.
#ifdef GROUND_LAND
    GroundSample grass = GroundSample(vec3(1.0), vec2(0.0), 1.0);
#else
    GroundSample grass = sampleGround(uGrassColor, uGrassDetail, at, uGrassTile, uGrassMean, 0.0);
#endif
    vec3 color = grass.color * colourGrass(at);
    vec2 slope = grass.slope;
    float roughness = mix(0.85, 1.0, grass.roughness);

    // Packed earth, darker and littered in the forest, stony on the
    // slopes, grey with ash round the fire.
    GroundSample earth = sampleGround(uEarthColor, uEarthDetail, at, uEarthTile, uEarthMean, 0.37);
    vec3 earthColor = mix(vec3(0.08, 0.058, 0.04), vec3(0.17, 0.125, 0.08), fractalGround(at * 0.7 + 8.0));
    earthColor *= (0.8 + clump * 0.35) * (0.85 + patches * 0.3);
    float ash = (1.0 - smoothstep(uHearth, uHearth + 2.5, radius)) * smoothstep(0.45, 0.7, fractalGround(at * 1.9 + 71.0));
    earthColor = mix(earthColor, vec3(0.06, 0.055, 0.05), ash * 0.7);
    vec3 litter = mix(vec3(0.035, 0.05, 0.028), vec3(0.1, 0.075, 0.05), clump);
    earthColor = mix(earthColor, litter, site.forest);
    vec3 scree = mix(vec3(0.09, 0.075, 0.06), vec3(0.2, 0.18, 0.15), smoothstep(0.55, 0.8, clump));
    earthColor = mix(earthColor, scree, site.steep * 0.85);
    // The grass's tufts hold on over the earth's hollows: each surface's
    // brightness pushes the edge, so it follows the photographs.
    float edge = (lumaGround(grass.color) - lumaGround(earth.color)) * 0.18;
    // Past the forest's edge every surface is earth, litter or a road's,
    // so no strip of grass lights up along a road's verge in the wood.
    float wooded = smoothstep(34.0, 42.0, radius + site.ragged * 4.0);
    float earthShare = max(max(smoothstep(0.42, 0.62, site.wear - edge), wooded), max(site.forest, site.steep * 0.85));
    color = mix(color, earth.color * earthColor, earthShare);
    slope = mix(slope, earth.slope * 1.2, earthShare);
    roughness = mix(roughness, mix(0.88, 1.0, earth.roughness), earthShare);

    // The ring's cobbles, lost toward its ragged edges where the grass
    // takes them back.
    if (site.ring > 0.0) {
        GroundSample cobble = sampleGround(uCobbleColor, uCobbleDetail, at, uCobbleTile, uCobbleMean, 0.71);
        float share = smoothstep(0.0, 0.35, site.ring + (lumaGround(cobble.color) - 1.0) * 0.4);
        vec3 stone = cobble.color * vec3(0.17, 0.16, 0.145) * (0.85 + clump * 0.3);
        color = mix(color, stone, share);
        slope = mix(slope, cobble.slope * 1.4, share);
        roughness = mix(roughness, cobble.roughness, share);
    }

    // The hearth's flagstones, soot darkening them toward the fire.
    if (site.hearth > 0.0) {
        GroundSample flag = sampleGround(uFlagColor, uFlagDetail, at, uFlagTile, uFlagMean, 0.13);
        float share = smoothstep(0.0, 0.35, site.hearth + (lumaGround(flag.color) - 1.0) * 0.4);
        vec3 slab = flag.color * vec3(0.13, 0.12, 0.105);
        slab *= mix(0.25, 1.0, smoothstep(0.8, 3.0, radius + (clump - 0.5) * 1.2));
        color = mix(color, slab, share);
        slope = mix(slope, flag.slope * 1.4, share);
        roughness = mix(roughness, flag.roughness, share);
    }

    groundTangentNormal = normalize(vec3(slope, 1.0));
    groundRoughness = roughness;
    return color;
}

// The painted normal in view space: the photographs' tilt in the frame the
// ground's world position lays them in, x east and y north.
vec3 tiltGround(vec3 tangentNormal) {
    vec3 up = normalize(vGroundNormal);
    vec3 east = normalize(vec3(1.0, 0.0, 0.0) - up * up.x);
    vec3 north = cross(up, east);
    vec3 world = normalize(east * tangentNormal.x + north * tangentNormal.y + up * tangentNormal.z);
    return normalize((viewMatrix * vec4(world, 0.0)).xyz);
}
`;
