import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    ShaderMaterial,
    type Group,
} from "three";
import { hashKeys, useTime } from "@spawnite/engine";
import { hearthGrowth, hearthWarmth } from "./warmth";

//  The hearth's fire: tongues of flame drawn as quads that turn to face the
//  camera about the upright, each rising, swaying and thinning over its own
//  short life round a steady hot core, and sparks drifting up out of it.
//  Between waves it roars up, as the hearth's warmth says, and it burns
//  bigger each level the wardens feed it to. Every quad and
//  spark moves in its vertex shader, so a frame writes only the time and
//  the warmth.

/** Flame quads: the core first, the tongues after. */
const tongueCount = 12;
const sparkCount = 28;

function buildFlameGeometry() {
    const quadCount = tongueCount + 1;
    const corners = new Float32Array(quadCount * 4 * 2);
    const seeds = new Float32Array(quadCount * 4 * 4);
    const indices: number[] = [];
    const cornerPlaces = [-1, 0, 1, 0, 1, 1, -1, 1];
    for (let quad = 0; quad < quadCount; quad++) {
        const core = quad === 0;
        //  Phase, rate, direction round the middle, and size.
        const seed = core
            ? [0.35, 0, 0, 0.95]
            : [
                  quad / tongueCount,
                  0.9 + hashKeys(quad, 1) * 0.7,
                  hashKeys(quad, 2) * Math.PI * 2,
                  0.6 + hashKeys(quad, 3) * 0.45,
              ];
        for (let corner = 0; corner < 4; corner++) {
            const vertex = quad * 4 + corner;
            corners[vertex * 2] = cornerPlaces[corner * 2];
            corners[vertex * 2 + 1] = cornerPlaces[corner * 2 + 1];
            seeds.set(seed, vertex * 4);
        }
        const first = quad * 4;
        indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
    const geometry = new BufferGeometry();
    //  Positions are unused but three sizes its draw by them.
    geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(quadCount * 4 * 3), 3),
    );
    geometry.setAttribute("corner", new BufferAttribute(corners, 2));
    geometry.setAttribute("seed", new BufferAttribute(seeds, 4));
    geometry.setIndex(indices);
    return geometry;
}

const flameVertex = /* glsl */ `
attribute vec2 corner;
attribute vec4 seed;
uniform float uTime;
uniform float uSwell;
varying vec2 vUv;
varying float vLife;
varying float vCore;
varying float vSeed;
void main() {
    vCore = seed.y == 0.0 ? 1.0 : 0.0;
    float life = vCore > 0.5 ? 0.35 : fract(uTime * seed.y * (1.0 + uSwell * 0.35) + seed.x);
    float size = seed.w * (1.0 + uSwell * 0.45);
    vec3 center = vec3(cos(seed.z), 0.0, sin(seed.z)) * 0.28 * (1.0 - life) * (1.0 - vCore);
    center.y = life * 0.55 * (1.0 - vCore) + 0.12;
    center.x += sin(uTime * 3.1 + seed.x * 20.0) * 0.1 * life;
    center.z += cos(uTime * 2.7 + seed.x * 13.0) * 0.1 * life;
    float width = size * (vCore > 0.5 ? 0.75 : 0.65 * (1.0 - life * 0.5));
    float height = size * (vCore > 0.5 ? 1.6 : 1.0 + life * 0.6);
    vec3 worldCenter = (modelMatrix * vec4(center, 1.0)).xyz;
    vec3 toCamera = cameraPosition - worldCenter;
    toCamera.y = 0.0;
    toCamera = normalize(toCamera + vec3(0.0001, 0.0, 0.0));
    vec3 right = vec3(toCamera.z, 0.0, -toCamera.x);
    vec3 world = worldCenter + right * corner.x * width * 0.5 + vec3(0.0, corner.y * height, 0.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
    vUv = vec2(corner.x * 0.5 + 0.5, corner.y);
    vLife = life;
    vSeed = seed.x;
}`;

const flameFragment = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vLife;
varying float vCore;
varying float vSeed;
float flameHash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}
float flameNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 part = fract(point);
    part = part * part * (3.0 - 2.0 * part);
    return mix(
        mix(flameHash(cell), flameHash(cell + vec2(1.0, 0.0)), part.x),
        mix(flameHash(cell + vec2(0.0, 1.0)), flameHash(cell + vec2(1.0, 1.0)), part.x),
        part.y);
}
void main() {
    float rise = vUv.y;
    float churn = flameNoise(vec2(vUv.x * 4.0 + vSeed * 9.0, rise * 3.0 - uTime * 3.2)) - 0.5;
    float across = (vUv.x - 0.5) * 2.0 + churn * 0.7 * rise;
    //  A teardrop: round at the foot, licking to a point at the top.
    float profile = pow(max(1.0 - rise, 0.0), 1.2) * smoothstep(0.0, 0.2, rise + 0.05) * 1.1;
    float body = 1.0 - smoothstep(profile * 0.55, profile, abs(across));
    float heat = (1.0 - smoothstep(0.0, profile * 0.7 + 0.001, abs(across))) * (1.0 - rise);
    float fade = vCore > 0.5 ? 1.0 : smoothstep(0.0, 0.15, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
    vec3 deep = vec3(0.85, 0.2, 0.05);
    vec3 flame = vec3(1.0, 0.45, 0.1);
    vec3 core = vec3(1.0, 0.74, 0.38);
    vec3 color = mix(deep, flame, smoothstep(0.0, 0.5, heat + vCore * 0.2));
    color = mix(color, core, smoothstep(0.45, 0.9, heat) * (0.5 + vCore * 0.3));
    float strength = body * fade * (vCore > 0.5 ? 0.6 : 0.75);
    //  Alpha carries the strength, so an empty corner of the quad is
    //  transparent to the ambient occlusion's transparency pass, which drew
    //  each quad at alpha 1 as a faint box; additive blending scales the
    //  colour by it, so the fire looks as it did.
    gl_FragColor = vec4(color * 1.15, strength);
}`;

function buildSparkGeometry() {
    const seeds = new Float32Array(sparkCount * 4);
    for (let spark = 0; spark < sparkCount; spark++)
        seeds.set(
            [
                hashKeys(spark, 4),
                0.35 + hashKeys(spark, 5) * 0.4,
                hashKeys(spark, 6) * Math.PI * 2,
                0.3 + hashKeys(spark, 7) * 0.9,
            ],
            spark * 4,
        );
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(sparkCount * 3), 3),
    );
    geometry.setAttribute("seed", new BufferAttribute(seeds, 4));
    return geometry;
}

const sparkVertex = /* glsl */ `
attribute vec4 seed;
uniform float uTime;
uniform float uSwell;
varying float vLife;
void main() {
    float life = fract(uTime * seed.y * (1.0 + uSwell * 0.6) + seed.x);
    float drift = seed.w * life;
    vec3 place = vec3(
        cos(seed.z) * (0.1 + drift * 0.6) + sin(uTime * 2.3 + seed.x * 30.0) * 0.12 * life,
        0.35 + life * (2.2 + seed.w) * (1.0 + uSwell * 0.5),
        sin(seed.z) * (0.1 + drift * 0.6) + cos(uTime * 1.9 + seed.x * 17.0) * 0.12 * life);
    vec4 view = modelViewMatrix * vec4(place, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (1.0 - life * 0.6) * 90.0 / max(-view.z, 1.0);
    vLife = life;
}`;

const sparkFragment = /* glsl */ `
varying float vLife;
void main() {
    float fromMiddle = length(gl_PointCoord - 0.5) * 2.0;
    float glow = pow(max(1.0 - fromMiddle, 0.0), 1.6);
    float fade = smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.5, 1.0, vLife));
    vec3 color = mix(vec3(1.0, 0.7, 0.3), vec3(1.0, 0.35, 0.08), vLife);
    gl_FragColor = vec4(color * 1.6, glow * fade);
}`;

function buildMaterial(vertexShader: string, fragmentShader: string) {
    return new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uTime: { value: 0 }, uSwell: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
    });
}

export function Fire() {
    const flameGeometry = useMemo(buildFlameGeometry, []);
    const sparkGeometry = useMemo(buildSparkGeometry, []);
    const flames = useMemo(() => buildMaterial(flameVertex, flameFragment), []);
    const sparks = useMemo(() => buildMaterial(sparkVertex, sparkFragment), []);
    useLayoutEffect(
        () => () => {
            flameGeometry.dispose();
            sparkGeometry.dispose();
            flames.dispose();
            sparks.dispose();
        },
        [flameGeometry, sparkGeometry, flames, sparks],
    );
    const growthRef = useRef<Group>(null);
    useFrame(() => {
        growthRef.current?.scale.setScalar(hearthGrowth.size);
        const seconds = useTime.getState().seconds;
        flames.uniforms.uTime.value = seconds;
        sparks.uniforms.uTime.value = seconds;
        flames.uniforms.uSwell.value = hearthWarmth.value;
        sparks.uniforms.uSwell.value = hearthWarmth.value;
    });

    return (
        <group ref={growthRef}>
            <mesh
                geometry={flameGeometry}
                material={flames}
                frustumCulled={false}
                renderOrder={2}
            />
            <points
                geometry={sparkGeometry}
                material={sparks}
                frustumCulled={false}
                renderOrder={2}
            />
        </group>
    );
}
