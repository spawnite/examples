import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import {
    BackSide,
    Color,
    CylinderGeometry,
    Fog,
    ShaderMaterial,
    Vector3,
} from "three";
import { useHeadless } from "@spawnite/engine";
import { duskAir as air, duskSun } from "./air";
import { Atmosphere } from "./Atmosphere";
import { DuskSky } from "./DuskSky";
import { Treeline } from "./Treeline";

//  What stands round the arena at dusk: blue air that swallows the map's
//  edge, a cool light from the side away from the sun, and a skyline of hills
//  and firs past the playable edge, so the world never ends at a flat rim.

/** The skyline's cylinder, in metres: far past the map's 50 m edge and well
 *  inside the camera's far plane. */
const skyline = { radius: 120, bottom: -60, top: 70 };

/** The sun's bearing at the dusk look's hour: the skyline glows on its side. */
const sunBearing = new Vector3().copy(duskSun).setY(0).normalize();

/** GLSL: two silhouettes against the sky, far hills then a nearer ridge,
 *  both darker than the air and lit at their rims on the sun's side. */
const skylineVertex = /* glsl */ `
varying vec2 vSkylineUv;
varying vec3 vSkylineDirection;
void main() {
    vSkylineUv = uv;
    vSkylineDirection = normalize(position * vec3(1.0, 0.0, 1.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skylineFragment = /* glsl */ `
varying vec2 vSkylineUv;
varying vec3 vSkylineDirection;
uniform vec3 uAir;
uniform vec3 uGlow;
uniform vec3 uHill;
uniform vec3 uTree;
uniform vec3 uSun;
uniform float uBottom;
uniform float uTop;

float hashSkyline(float value) {
    return fract(sin(value * 127.1) * 43758.5453);
}

// A smooth noise round the circle that meets itself where it wraps.
float noiseSkyline(float turn, float cells) {
    float at = turn * cells;
    float cell = floor(at);
    float inside = fract(at);
    float blend = inside * inside * (3.0 - 2.0 * inside);
    return mix(
        hashSkyline(mod(cell, cells)),
        hashSkyline(mod(cell + 1.0, cells)),
        blend
    );
}

void main() {
    float turn = vSkylineUv.x;
    float height = mix(uBottom, uTop, vSkylineUv.y);
    float sunSide = max(dot(vSkylineDirection, uSun), 0.0);

    float hills = 28.0 + 18.0 * noiseSkyline(turn, 7.0)
        + 6.0 * noiseSkyline(turn, 23.0);
    float ridge = 16.0 + 8.0 * noiseSkyline(turn, 13.0)
        + 3.0 * noiseSkyline(turn, 41.0);
    float trees = ridge;

    if (height > max(hills, trees)) discard;

    // Far hills: the air, a little darker, warmed toward the sun.
    vec3 hill = mix(uAir, uHill, 0.55);
    hill = mix(hill, uGlow, sunSide * sunSide * 0.35 * smoothstep(hills - 6.0, hills, height));
    // Near firs: nearly black, a thin warm rim where the sun is behind them.
    float rim = smoothstep(trees - 0.8, trees, height) * smoothstep(0.5, 1.0, sunSide);
    vec3 tree = mix(mix(uTree, uAir, 0.25), uGlow, rim * 0.25);
    vec3 color = height > trees ? hill : tree;
    // Both sink into the air at their feet, where the map's own fog ends.
    color = mix(color, uAir, smoothstep(4.0, -14.0, height));
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

function createSkylineMaterial() {
    return new ShaderMaterial({
        vertexShader: skylineVertex,
        fragmentShader: skylineFragment,
        uniforms: {
            uAir: { value: new Color(air.color) },
            uGlow: { value: new Color("#ff9a58") },
            uHill: { value: new Color("#1c2233") },
            uTree: { value: new Color("#0a0e14") },
            uSun: { value: sunBearing },
            uBottom: { value: skyline.bottom },
            uTop: { value: skyline.top },
        },
        side: BackSide,
    });
}

/** The skyline, the dusk air and the cool side light, on a page only. */
export function Surroundings() {
    const headless = useHeadless();
    const scene = useThree((state) => state.scene);
    const fog = useMemo(() => new Fog(air.color, air.near, air.far), []);
    const geometry = useMemo(
        () =>
            new CylinderGeometry(
                skyline.radius,
                skyline.radius,
                skyline.top - skyline.bottom,
                128,
                1,
                true,
            ),
        [],
    );
    const material = useMemo(createSkylineMaterial, []);
    useLayoutEffect(
        () => () => {
            geometry.dispose();
            material.dispose();
            if (scene.fog === fog) scene.fog = null;
        },
        [geometry, material, scene, fog],
    );
    //  The look installs its own fog when it mounts, which may be after this
    //  does; taking it back each frame costs one comparison.
    useFrame(() => {
        if (!headless && scene.fog !== fog) scene.fog = fog;
    });
    if (headless) return null;

    return (
        <>
            <DuskSky />
            <Treeline />
            <Atmosphere />
            <mesh
                name="skyline"
                geometry={geometry}
                material={material}
                position-y={(skyline.top + skyline.bottom) / 2}
                renderOrder={5}
                frustumCulled={false}
            />
            {/*  The sky's dim blue from above and the earth's warm bounce from
                 below, so the shadowed ground reads rather than sinks. */}
            <hemisphereLight args={["#7f8cc8", "#3b2a1e", 0.55]} />
            {/*  The shadow side's cool blue, from opposite the sun; it casts
                 nothing. */}
            <directionalLight
                color="#7d95ff"
                intensity={0.6}
                position={[-sunBearing.x, 0.5, -sunBearing.z]}
            />
        </>
    );
}
