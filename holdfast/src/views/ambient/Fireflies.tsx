import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    MathUtils,
    ShaderMaterial,
} from "three";
import {
    GroundTrait,
    hashKeys,
    useHeadless,
    useWorldEntity,
} from "@spawnite/engine";
import { nightSky } from "../world/night";

//  Fireflies over the grass between the stones and the forest: soft warm
//  points that drift and blink, all of them one draw, out from dusk until
//  the sun comes up.

const fireflyCount = 90;
/** Metres from the middle they keep to: outside the stones, short of the
 *  trees. */
const band = { inner: 21, outer: 38 };
/** Metres over the grass they hover. */
const hover = { low: 0.3, high: 2 };

/** The share of the night over which the fireflies go out: the sky
 *  paling to the sun up. */
const fireflyDawn = { from: 0.85, to: 1 };

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixels;
uniform float uAwake;
attribute float aSeed;
varying float vLight;
void main() {
    vec3 place = position;
    //  A slow wander of a metre or so, each on its own rhythm.
    place.x += sin(uTime * (0.21 + aSeed * 0.17) + aSeed * 40.0) * 1.1;
    place.z += cos(uTime * (0.18 + aSeed * 0.15) + aSeed * 23.0) * 1.1;
    place.y += sin(uTime * (0.5 + aSeed * 0.4) + aSeed * 11.0) * 0.25;
    vec4 view = modelViewMatrix * vec4(place, 1.0);
    //  A blink every few seconds: a quick rise, a slower fade, then dark.
    float cycle = fract(uTime / (2.6 + aSeed * 2.2) + aSeed * 7.0);
    float blink = smoothstep(0.0, 0.08, cycle) * (1.0 - smoothstep(0.12, 0.55, cycle));
    float distance = -view.z;
    //  Far ones fade into the dusk rather than stay pin-sharp, and one
    //  that drifts past the camera fades out rather than fill the view.
    vLight = (0.22 + blink) * (1.0 - smoothstep(30.0, 55.0, distance))
        * smoothstep(1.0, 3.0, distance) * uAwake;
    gl_PointSize = uPixels * (0.55 + blink * 0.45) / max(distance, 1.0);
    gl_Position = projectionMatrix * view;
}`;

const fragmentShader = /* glsl */ `
varying float vLight;
void main() {
    float fromMiddle = length(gl_PointCoord - 0.5) * 2.0;
    float core = pow(max(1.0 - fromMiddle, 0.0), 3.0);
    float halo = pow(max(1.0 - fromMiddle, 0.0), 1.4) * 0.35;
    //  Warm yellow-green short of full saturation, above 1 so it blooms.
    vec3 color = vec3(0.82, 1.0, 0.42) * 2.4;
    //  Alpha carries the light, up to 1, which additive blending scales the
    //  colour by: a point's dark corners stay clear of the ambient
    //  occlusion's transparency pass, which reads alpha 1 as a solid square.
    float light = (core + halo) * vLight;
    gl_FragColor = vec4(color * max(light, 1.0), min(light, 1.0));
}`;

/** The swarm, placed once on the map's ground. A page draws it; the room,
 *  headless, has nothing to draw. */
export function Fireflies() {
    return useHeadless() ? null : <Swarm />;
}

function Swarm() {
    const surface = useWorldEntity().get(GroundTrait)?.surface;
    const geometry = useMemo(() => {
        const places = new Float32Array(fireflyCount * 3);
        const seeds = new Float32Array(fireflyCount);
        for (let index = 0; index < fireflyCount; index++) {
            const angle = hashKeys(index, 0) * Math.PI * 2;
            //  Square root spreads them evenly over the band's area.
            const spread = Math.sqrt(hashKeys(index, 1));
            const radius = band.inner + (band.outer - band.inner) * spread;
            const x = Math.sin(angle) * radius;
            const z = Math.cos(angle) * radius;
            const ground = surface?.getHeightAt({ x, z }) ?? 0;
            const up =
                hover.low + (hover.high - hover.low) * hashKeys(index, 2);
            places.set([x, ground + up, z], index * 3);
            seeds[index] = hashKeys(index, 3);
        }
        const swarm = new BufferGeometry();
        swarm.setAttribute("position", new BufferAttribute(places, 3));
        swarm.setAttribute("aSeed", new BufferAttribute(seeds, 1));
        return swarm;
    }, [surface]);
    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader,
                fragmentShader,
                uniforms: {
                    uTime: { value: 0 },
                    uPixels: { value: 1 },
                    uAwake: { value: 1 },
                },
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
            }),
        [],
    );
    useLayoutEffect(() => () => geometry.dispose(), [geometry]);
    useLayoutEffect(() => () => material.dispose(), [material]);
    useFrame(({ clock, size, viewport }) => {
        material.uniforms.uTime.value = clock.elapsedTime;
        //  Out through the night, gone as the sun comes up.
        material.uniforms.uAwake.value =
            1 -
            MathUtils.smoothstep(
                nightSky.night,
                fireflyDawn.from,
                fireflyDawn.to,
            );
        //  About 0.25 m across on screen, whatever the canvas's height.
        material.uniforms.uPixels.value = size.height * viewport.dpr * 0.4;
    });

    return (
        <points geometry={geometry} material={material} frustumCulled={false} />
    );
}
