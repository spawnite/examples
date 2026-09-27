import { groundLayout, groundNoise } from "./groundShader";

//  The grass blades' shape, sway and colour, as GLSL a standard material
//  splices into its own shaders, so the sun, its shadows and the fog fall
//  on the blades as on the ground. Every blade is the same strip of
//  triangles; the vertex shader stands it on its root, sizes it from the
//  ground's layout, bends it in the wind and thins the field with distance.

/** Declared in the vertex shader. `blade` is a vertex's side, -1 to 1, and
 *  its height up the blade, 0 to 1; `root` and `groundUnder` are the
 *  blade's own, from grassField's patches. */
export const grassVertexDeclarations = /* glsl */ `
attribute vec2 blade;
attribute vec4 root;
attribute vec2 groundUnder;
uniform float uTime;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uBladeHeight;
uniform float uBladeWidth;
// Where the wardens stand: x, z, the radius they flatten, and 1, or all 0.
uniform vec4 uTrample[4];
varying vec3 vGrassColor;
${groundNoise}
${groundLayout}
`;

/** Replaces three's first normal: works out the blade and leaves its
 *  position in `bladePosition` for the position chunk. */
export const grassVertexShape = /* glsl */ `
float bladeSeed = hashGround(root.xz * 17.13);
float bladeSize = hashGround(root.xz * 9.71 + 3.1);
float bladeLean = hashGround(root.xz * 5.3 + 7.7);

// Thinned with distance: a blade ranked past the share kept here shrinks
// away rather than popping.
float bladeDistance = length(root.xz - cameraPosition.xz);
float keptShare = 1.0 - smoothstep(uFadeNear, uFadeFar, bladeDistance);
float kept = 1.0 - smoothstep(keptShare - 0.06, keptShare, root.w);
// Low right under the camera, where a blade would fill the screen.
kept *= mix(0.35, 1.0, smoothstep(1.5, 4.5, bladeDistance));

// Short or gone where the ground's paint turns to earth, stone or forest.
GroundLayout site = layoutGround(root.xz, groundUnder.x, groundUnder.y);
float earth = smoothstep(0.42, 0.62, site.wear + (bladeSeed - 0.5) * 0.25);
// Gone wherever the paint shows the ring's cobbles or the hearth's slabs,
// which it draws whole once their share passes about a third.
float grassy = (1.0 - earth) * (1.0 - site.forest) * (1.0 - site.steep * 0.85)
    * (1.0 - smoothstep(0.0, 0.3, site.ring)) * (1.0 - smoothstep(0.0, 0.3, site.hearth));
float tall = fractalGround(root.xz * 0.35 + 11.0);
float bladeHeight = uBladeHeight * mix(0.5, 1.3, tall) * (0.65 + bladeSize * 0.7)
    * smoothstep(0.05, 0.6, grassy) * kept;
// Far blades are wider, so a thinner field still covers the ground.
float bladeWidth = uBladeWidth * (0.75 + bladeLean * 0.5)
    * mix(1.0, 2.4, smoothstep(uFadeNear, uFadeFar, bladeDistance));

// Flattened and pushed aside round a warden's feet, so her ring shows.
float pressed = 0.0;
vec2 pushed = vec2(0.0);
for (int warden = 0; warden < 4; warden++) {
    vec4 trample = uTrample[warden];
    vec2 away = root.xz - trample.xy;
    float press = (1.0 - smoothstep(trample.z * 0.6, trample.z, length(away))) * trample.w;
    pressed = max(pressed, press);
    pushed += normalize(away + 0.0001) * press;
}
bladeHeight *= 1.0 - pressed * 0.7;

float along = blade.y;
float yaw = bladeSeed * 6.2832;
vec2 facing = vec2(cos(yaw), sin(yaw));
vec2 across = vec2(-facing.y, facing.x);

// The wind: a slow sway along the map, gusts that roll across it, and a
// flutter of each blade's own.
vec2 windDirection = normalize(vec2(1.0, 0.35));
float gust = noiseGround(root.xz * 0.07 - windDirection * uTime * 0.8);
float sway = sin(uTime * 1.6 + dot(root.xz, windDirection) * 0.55 + bladeSize * 2.0) * 0.3
    + gust * 0.9;
float flutter = sin(uTime * 5.1 + bladeLean * 6.2832) * 0.07;
vec2 bend = facing * (0.15 + bladeLean * 0.35) + windDirection * sway * 0.55 + across * flutter
    + pushed * 1.5;
float curve = along * along;

vec3 bladePosition = root.xyz;
bladePosition.xz += across * blade.x * bladeWidth * (1.0 - along) + bend * curve * bladeHeight;
bladePosition.y += along * bladeHeight * (1.0 - 0.25 * curve * dot(bend, bend));

// Mostly up, so the field takes the light as the ground does, with the
// blade's own face and its curl across it.
vec3 objectNormal = normalize(
    vec3(facing.x, 0.0, facing.y) * 0.35 + vec3(across.x, 0.0, across.y) * blade.x * 0.2
    + vec3(0.0, 1.0, 0.0)
);

// Dark at the root, where the blades shade each other, to the ground's
// grass colour, lighter and warmer at the tip.
vec3 grassColour = colourGrass(root.xz);
vec3 tipColour = grassColour * vec3(1.3, 1.45, 1.1) + vec3(0.012, 0.012, 0.0) * bladeSize;
vGrassColor = mix(grassColour * 0.3, tipColour, pow(along, 0.8));
`;

/** Replaces three's first position with the blade's. */
export const grassVertexPosition = /* glsl */ `
vec3 transformed = bladePosition;
`;

/** Declared in the fragment shader. */
export const grassFragmentDeclarations = /* glsl */ `
varying vec3 vGrassColor;
`;
