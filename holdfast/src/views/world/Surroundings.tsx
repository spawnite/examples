import { useFrame, useThree } from "@react-three/fiber";
import { useWorld } from "koota/react";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    BackSide,
    Color,
    CylinderGeometry,
    Fog,
    MathUtils,
    ShaderMaterial,
    Vector3,
    type DirectionalLight,
    type HemisphereLight,
} from "three";
import { DayClockTrait, useHeadless, useLookGrading } from "@spawnite/engine";
import { PhaseTrait, readPhase } from "../../siege/phase";
import { SiegeTrait } from "../../siege/traits";
import { duskAir as air, duskSun } from "./air";
import { Atmosphere } from "./Atmosphere";
import { DuskSky } from "./DuskSky";
import { measureNight, nightSky, readNightSky } from "./night";
import { Treeline } from "./Treeline";
import { useWelcomed } from "../welcomed";

//  What stands round the arena through the night: air that swallows the
//  map's edge, a cool light from the side away from the sun, and a skyline
//  of hills and firs past the playable edge, so the world never ends at a
//  flat rim. The night's clock turns all of it, and the engine's sun and
//  moon, from dusk to sunrise as the waves go by.

/** Seconds the sky takes to go most of the way to where the run has moved
 *  it: it turns through the opening of each breather. */
const nightTurnSeconds = 2.5;
/** A share of the night no breather moves the sky by, one and a half
 *  waves: a new run's return to dusk, or a replay opened on another
 *  moment, which the sky stands on at once. */
const nightJump = 0.1;

/** The skyline's cylinder, in metres: far past the map's 50 m edge and well
 *  inside the camera's far plane. */
const skyline = { radius: 120, bottom: -60, top: 70 };

/** The sun's bearing at the dusk look's hour: the skyline glows on its
 *  side, and the side light comes from opposite it. */
const sunBearing = new Vector3().copy(duskSun).setY(0).normalize();
/** The sun's bearing as the night turns it, written in place. */
const liveBearing = sunBearing.clone();

/** GLSL: three ranges against the sky, far peaks, a nearer ridge and a
 *  line of firs, each darker than the one behind it and hazed toward its
 *  feet, so the depth reads at any hour, and rimmed on the sun's side. The
 *  far ranges take the sky's own colours, as distant hills do, rather than
 *  one grey that would turn tan at sunrise. */
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
uniform vec3 uHorizon;
uniform vec3 uHigh;
uniform vec3 uGlow;
uniform vec3 uTree;
uniform vec3 uSun;
uniform float uMoonRim;
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

// Sharp crests where a smooth noise folds: mountain peaks.
float peaksSkyline(float turn, float cells) {
    return 1.0 - abs(noiseSkyline(turn, cells) * 2.0 - 1.0);
}

// A row of fir tips round the circle, each its own height; two rows off
// each other's cells, so the line is ragged rather than a saw.
float firsSkyline(float turn, float cells, float seed) {
    float at = turn * cells + seed;
    float cell = floor(at);
    float tall = 0.45 + 0.55 * hashSkyline(mod(cell, cells) + seed);
    return tall * (1.0 - abs(fract(at) * 2.0 - 1.0) * 1.15);
}

void main() {
    float turn = vSkylineUv.x;
    float height = mix(uBottom, uTop, vSkylineUv.y);
    float sunSide = max(dot(vSkylineDirection, uSun), 0.0);

    float far = 15.0 + 10.0 * noiseSkyline(turn, 6.0)
        + 14.0 * peaksSkyline(turn, 27.0) * peaksSkyline(turn, 9.0)
        + 3.0 * peaksSkyline(turn, 83.0);
    // The ridge carries a paler row of firs of its own, behind the near one.
    float ridge = 9.0 + 5.0 * noiseSkyline(turn, 11.0)
        + 4.0 * peaksSkyline(turn, 43.0)
        + mix(1.5, 4.5, noiseSkyline(turn, 31.0)) * firsSkyline(turn, 290.0, 0.61);
    // The firs thin out and stand taller in stands, so the line steps up
    // and down rather than running level.
    float stand = noiseSkyline(turn, 23.0);
    float firs = 4.0 + 4.0 * noiseSkyline(turn, 29.0) + 2.0 * noiseSkyline(turn, 5.0)
        + mix(4.0, 11.0, stand) * max(firsSkyline(turn, 160.0, 0.0), firsSkyline(turn, 115.0, 0.37));

    if (height > max(far, max(ridge, firs))) discard;

    // The sky just behind, which each range sinks toward with distance.
    vec3 sky = mix(uHorizon, uHigh, smoothstep(0.0, 45.0, height));
    vec3 haze = mix(uAir, uHorizon, 0.5);
    vec3 color;
    float rimShare = 0.25;
    if (height > max(ridge, firs)) {
        // The far peaks: the sky, cooled toward the blue above it and a
        // little darker, hazed out toward their feet.
        color = mix(mix(sky, uHigh, 0.4), uTree, 0.5);
        color = mix(color, haze, smoothstep(far - 6.0, far - 22.0, height) * 0.45);
    } else if (height > firs) {
        color = mix(mix(sky, uHigh, 0.2), uTree, 0.55);
        color = mix(color, haze, smoothstep(ridge - 3.0, ridge - 14.0, height) * 0.45);
        rimShare = 0.0;
    } else {
        color = mix(uAir, uTree, 0.82);
        rimShare = 0.0;
    }
    // A thin warm rim along the far crests on the sun's side. The nearer
    // ranges take none: behind the firs a lit edge reads as a drawn line.
    // By moonlight the far crests take a faint pale edge, so the ranges
    // still read against the dark sky.
    float rimSide = max(smoothstep(0.35, 1.0, sunSide), uMoonRim);
    float rim = smoothstep(far - 1.2, far, height) * rimSide;
    color = mix(color, uGlow, rim * rimShare);
    // Every range sinks into the air at its feet, where the map's own fog
    // ends.
    color = mix(color, uAir, smoothstep(3.0, -12.0, height));
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
            uHorizon: { value: new Color(air.color) },
            uHigh: { value: new Color("#2c2f5e") },
            uGlow: { value: new Color("#ff9a58") },
            uTree: { value: new Color("#0a0e14") },
            uSun: { value: liveBearing },
            uMoonRim: { value: 0 },
            uBottom: { value: skyline.bottom },
            uTop: { value: skyline.top },
        },
        side: BackSide,
    });
}

/** What the night turns that this file draws: the air, and the
 *  skyline's material. */
interface NightDrawn {
    fog: Fog;
    material: ShaderMaterial;
}

/** Turns the night: eases its share toward where the run stands, and
 *  writes the sky every view reads, the engine's clock the sun and moon
 *  stand by, the air and light this game draws, and the look's grade. A
 *  page only. */
function useNightClock({ fog, material }: NightDrawn) {
    const world = useWorld();
    const isWelcomed = useWelcomed();
    const nightRef = useRef<number | undefined>(undefined);
    const fillRef = useRef<HemisphereLight>(null);
    const sideRef = useRef<DirectionalLight>(null);
    const grading = useLookGrading();
    useFrame((_state, delta) => {
        //  Nothing to draw from until the run streams in: the sky keeps its
        //  dusk. The first frame after stands on the run as it is, as do a
        //  jump and a welcome; a breather's move the sky turns through. The
        //  run is read in the frame, which may come before a welcome's
        //  render.
        const welcomed = isWelcomed();
        const siege = world.queryFirst(SiegeTrait)?.get(SiegeTrait);
        const phase = readPhase(world.queryFirst(PhaseTrait));
        if (siege === undefined || phase === undefined) return;
        const target = measureNight({ ...siege, phase });
        const last = nightRef.current;
        const night =
            last === undefined ||
            welcomed ||
            Math.abs(target - last) > nightJump
                ? target
                : MathUtils.damp(last, target, 1 / nightTurnSeconds, delta);
        nightRef.current = night;
        const sky = readNightSky(night, nightSky);
        for (const clock of world.query(DayClockTrait))
            if (
                Math.abs((clock.get(DayClockTrait)?.hour ?? 0) - sky.hour) >
                1e-4
            )
                clock.set(DayClockTrait, { hour: sky.hour });
        fog.color.copy(sky.air);
        liveBearing.copy(sky.sunDirection).setY(0).normalize();
        material.uniforms.uAir.value.copy(sky.air);
        material.uniforms.uHorizon.value.copy(sky.horizon);
        material.uniforms.uHigh.value.copy(sky.high);
        material.uniforms.uGlow.value.copy(sky.glow);
        material.uniforms.uMoonRim.value = sky.moon * 0.25;
        grading.tint.copy(sky.tint);
        grading.saturation = sky.saturation;
        const fill = fillRef.current;
        if (fill) {
            fill.color.copy(sky.fill);
            fill.intensity = sky.fillIntensity;
        }
        const side = sideRef.current;
        if (side) {
            side.color.copy(sky.side);
            side.intensity = sky.sideIntensity;
            side.position.set(-liveBearing.x, 0.5, -liveBearing.z);
        }
    });
    return { fillRef, sideRef };
}

/** The skyline, the air and the cool side light, on a page only. */
export function Surroundings() {
    const headless = useHeadless();
    return headless ? null : <PageSurroundings />;
}

function PageSurroundings() {
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
        },
        [geometry, material],
    );
    useLayoutEffect(() => {
        scene.fog = fog;
        return () => {
            if (scene.fog === fog) scene.fog = null;
        };
    }, [scene, fog]);
    const { fillRef, sideRef } = useNightClock({ fog, material });

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
            <hemisphereLight
                ref={fillRef}
                args={["#7f8cc8", "#3b2a1e", 0.55]}
            />
            {/*  The shadow side's cool blue, from opposite the sun; it casts
                 nothing. */}
            <directionalLight
                ref={sideRef}
                color="#7d95ff"
                intensity={0.6}
                position={[-sunBearing.x, 0.5, -sunBearing.z]}
            />
        </>
    );
}
