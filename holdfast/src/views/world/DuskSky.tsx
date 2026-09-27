import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    BackSide,
    Color,
    ShaderMaterial,
    SphereGeometry,
    Mesh,
    type Object3D,
} from "three";
import { duskAir, duskSun } from "./air";

//  The dusk sky: deep blue overhead, violet lower down, a warm band along
//  the horizon that burns orange toward the low sun, the sun's disc and its
//  halo, thin clouds lit from below, and the first stars. Drawn first and
//  behind everything, round the camera, in place of the rig's own painted
//  domes, cloud decks and scattering sky, which read as afternoon.

/** The engine rig's own sky, by the names its meshes carry, and its sky
 *  shader's: hidden while this sky stands.
 *  ponytail: reaches into the rig by name; a look that can leave out the
 *  rig's sky would lift it. */
const rigSkyNames = new Set([
    "skyTint",
    "skyCloudsFar",
    "skyCloudsNear",
    "skyBand",
]);
const rigSkyShader = "SkyShader";

function isRigSky(object: Object3D) {
    if (rigSkyNames.has(object.name)) return true;
    return (
        object instanceof Mesh &&
        !Array.isArray(object.material) &&
        object.material.name === rigSkyShader
    );
}

/** The rig's sky as last found, gathered in place. */
const rigSky: Object3D[] = [];
function collectRigSky(object: Object3D) {
    if (isRigSky(object)) rigSky.push(object);
}
function isInScene(object: Object3D) {
    return object.parent !== null;
}
/** Frames between two searches for a rig sky not found or remounted. */
const searchFrames = 30;

/** Metres to the dome: inside the camera's far plane, past the skyline. */
const domeRadius = 400;

const skyVertex = /* glsl */ `
varying vec3 vSkyDirection;
void main() {
    vSkyDirection = normalize(position);
    vec4 placed = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * placed;
    // On the far plane, so it never hides what stands in front.
    gl_Position.z = gl_Position.w;
}`;

const skyFragment = /* glsl */ `
varying vec3 vSkyDirection;
uniform vec3 uZenith;
uniform vec3 uHigh;
uniform vec3 uHorizon;
uniform vec3 uBurn;
uniform vec3 uSunColor;
uniform vec3 uSun;
uniform vec3 uCloud;

float hashSky(vec2 cell) {
    return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}

float noiseSky(vec2 at) {
    vec2 cell = floor(at);
    vec2 inside = fract(at);
    vec2 blend = inside * inside * (3.0 - 2.0 * inside);
    return mix(
        mix(hashSky(cell), hashSky(cell + vec2(1.0, 0.0)), blend.x),
        mix(hashSky(cell + vec2(0.0, 1.0)), hashSky(cell + vec2(1.0, 1.0)), blend.x),
        blend.y
    );
}

float cloudsSky(vec2 at) {
    float total = 0.0;
    float weight = 0.5;
    for (int octave = 0; octave < 4; octave++) {
        total += weight * noiseSky(at);
        at *= 2.03;
        weight *= 0.5;
    }
    return total;
}

void main() {
    vec3 direction = normalize(vSkyDirection);
    float up = direction.y;
    vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z));
    vec3 flatDirection = normalize(vec3(direction.x, 0.0, direction.z) + 1e-5);
    float toward = dot(flatDirection, sunFlat) * 0.5 + 0.5;

    // Overhead to horizon, the warm band thicker and hotter toward the sun.
    float high = smoothstep(0.0, 0.55, up);
    vec3 color = mix(uHigh, uZenith, smoothstep(0.25, 1.0, up));
    vec3 band = mix(uHorizon, uBurn, pow(toward, 3.0));
    float bandHeight = mix(0.12, 0.3, pow(toward, 2.0));
    color = mix(band, color, smoothstep(0.0, bandHeight, up));
    // Below the horizon, the air the fog fades the ground into.
    color = mix(color, uHorizon, smoothstep(0.02, -0.08, up));

    // Thin clouds, stretched along the horizon, lit warm from below near
    // the sun and dark against it elsewhere.
    vec2 cloudAt = direction.xz / max(up + 0.12, 0.05) * vec2(0.6, 1.8);
    float cloud = smoothstep(0.52, 0.78, cloudsSky(cloudAt * 1.4 + 7.0));
    cloud *= smoothstep(0.02, 0.12, up) * (1.0 - smoothstep(0.35, 0.7, up));
    vec3 cloudColor = mix(uCloud, uBurn * 1.1, pow(toward, 4.0) * 0.8);
    color = mix(color, cloudColor, cloud * mix(0.35, 0.6, toward));

    // The sun's disc and its halo.
    float sunAngle = dot(direction, normalize(uSun));
    float halo = pow(max(sunAngle, 0.0), 24.0) * 0.55 + pow(max(sunAngle, 0.0), 300.0) * 1.2;
    float disc = smoothstep(0.9993, 0.9996, sunAngle);
    color += uSunColor * (halo * (1.0 - cloud * 0.6) + disc * 3.0);

    // The first stars, high and away from the sun.
    vec2 starCell = floor(direction.xz / max(up, 0.2) * 90.0);
    float star = step(0.9965, hashSky(starCell)) * smoothstep(0.35, 0.8, up) * (1.0 - toward);
    color += vec3(star) * 0.6 * (1.0 - cloud);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

function createSkyMaterial() {
    return new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: {
            uZenith: { value: new Color("#0d1330") },
            uHigh: { value: new Color("#2c2f5e") },
            uHorizon: { value: new Color(duskAir.color) },
            uBurn: { value: new Color("#e8794a") },
            uSunColor: { value: new Color("#ffc58a") },
            uSun: { value: duskSun },
            uCloud: { value: new Color("#232642") },
        },
        side: BackSide,
        depthWrite: false,
        depthTest: false,
    });
}

export function DuskSky() {
    const meshRef = useRef<Mesh>(null);
    const geometry = useMemo(() => new SphereGeometry(domeRadius, 48, 24), []);
    const material = useMemo(createSkyMaterial, []);
    useLayoutEffect(
        () => () => {
            geometry.dispose();
            material.dispose();
        },
        [geometry, material],
    );
    const scene = useThree((state) => state.scene);
    const frameRef = useRef(0);
    useLayoutEffect(
        () => () => {
            for (const object of rigSky) object.visible = true;
            rigSky.length = 0;
        },
        [scene],
    );
    //  Round the camera wherever it goes, so the sky has no near edge; and
    //  the rig's sky, searched for now and then until every part is found
    //  and again once one has left the scene, held hidden.
    useFrame(({ camera }) => {
        meshRef.current?.position.copy(camera.position);
        const complete =
            rigSky.length === rigSkyNames.size + 1 && rigSky.every(isInScene);
        if (!complete && frameRef.current++ % searchFrames === 0) {
            for (const object of rigSky) object.visible = true;
            rigSky.length = 0;
            scene.traverse(collectRigSky);
        }
        for (const object of rigSky) object.visible = false;
    });
    return (
        <mesh
            ref={meshRef}
            name="dusk-sky"
            geometry={geometry}
            material={material}
            renderOrder={-1000}
            frustumCulled={false}
        />
    );
}
