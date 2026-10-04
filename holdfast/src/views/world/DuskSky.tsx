import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    BackSide,
    Color,
    ShaderMaterial,
    SphereGeometry,
    type Mesh,
    Vector3,
} from "three";
import { duskAir, duskSun } from "./air";
import { nightSky } from "./night";

//  The night sky: deep blue overhead, violet lower down, a warm band along
//  the horizon that burns toward the sun, the sun's disc and its halo, thin
//  clouds lit from below, the stars and the moon. Its colours, its sun and
//  its moon follow the night's clock, from dusk to sunrise. Drawn first and
//  behind everything, round the camera, where the World draws no sky of its
//  own.

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
uniform vec3 uAir;
uniform vec3 uBurn;
uniform vec3 uSunColor;
uniform vec3 uSun;
uniform vec3 uCloud;
uniform float uStars;
uniform vec3 uMoon;
uniform float uMoonLight;

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
    color = mix(color, uAir, smoothstep(0.02, -0.08, up));

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

    // The stars, away from the sun: a few high ones at dusk, the whole sky
    // of them at midnight, a dimmer second field between the bright ones.
    vec2 starCell = floor(direction.xz / max(up, 0.2) * 90.0);
    float starHeight = smoothstep(mix(0.35, 0.08, clamp(uStars - 0.5, 0.0, 1.0)), 0.8, up);
    float star = step(0.9965, hashSky(starCell)) * starHeight * (1.0 - toward * 0.8);
    vec2 faintCell = floor(direction.xz / max(up, 0.2) * 170.0);
    float faint = step(0.993, hashSky(faintCell + 31.0)) * starHeight * 0.45;
    color += (vec3(star) * 0.6 + vec3(0.75, 0.8, 1.0) * faint * clamp(uStars - 0.6, 0.0, 1.0))
        * uStars * (1.0 - cloud);

    // The moon: a pale disc with a soft halo, dimmed by the cloud before it.
    float moonAngle = dot(direction, normalize(uMoon));
    float moonDisc = smoothstep(0.99955, 0.99975, moonAngle);
    float moonHalo = pow(max(moonAngle, 0.0), 60.0) * 0.18;
    color += vec3(0.86, 0.9, 1.0) * (moonDisc * 1.6 + moonHalo) * uMoonLight * (1.0 - cloud * 0.7)
        * smoothstep(-0.02, 0.04, up);

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
            uAir: { value: new Color(duskAir.color) },
            uBurn: { value: new Color("#e8794a") },
            uSunColor: { value: new Color("#ffc58a") },
            uSun: { value: duskSun.clone() },
            uCloud: { value: new Color("#232642") },
            uStars: { value: 0.5 },
            uMoon: { value: new Vector3(0, -1, 0) },
            uMoonLight: { value: 0 },
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
    //  Round the camera wherever it goes, so the sky has no near edge, in
    //  the night's colours.
    useFrame(({ camera }) => {
        meshRef.current?.position.copy(camera.position);
        const { uniforms } = material;
        uniforms.uZenith.value.copy(nightSky.zenith);
        uniforms.uHigh.value.copy(nightSky.high);
        uniforms.uHorizon.value.copy(nightSky.horizon);
        uniforms.uAir.value.copy(nightSky.air);
        uniforms.uBurn.value.copy(nightSky.burn);
        uniforms.uSunColor.value.copy(nightSky.sun);
        uniforms.uSun.value.copy(nightSky.sunDirection);
        uniforms.uCloud.value.copy(nightSky.cloud);
        uniforms.uStars.value = nightSky.stars;
        uniforms.uMoon.value.copy(nightSky.moonDirection);
        uniforms.uMoonLight.value = nightSky.moon;
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
