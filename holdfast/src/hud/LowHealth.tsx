import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait } from "koota/react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { PlaneGeometry, ShaderMaterial, type Mesh } from "three";
import { Authority, Hero, useHeadless } from "@spawnite/engine";
import { playSound, Sound } from "../audio/sounds";
import { SiegePhase, SiegeTrait, WardenTrait } from "../siege/traits";

//  Low health felt without looking at the bar: under 30% of her health the
//  screen's edges darken to a deep red that beats with a heartbeat, deeper
//  and faster the lower she is. The level eases in and out over about half
//  a second and the beat swings it by a third at most, so it never strobes.
//  Down, the hurt vignette's own pulse takes over.

/** The share of her health under which it starts, as the health bar
 *  turns red. */
const lowShare = 0.3;

/** How strongly it shows, 0 to 1, at `share` of her health. */
export function measureLowHealth(share: number) {
    if (share >= lowShare) return 0;
    return Math.min(1, 0.35 + (0.65 * (lowShare - share)) / lowShare);
}

/** The level now, where it wants to go, and the frame's seconds. */
export interface LowHealthEase {
    level: number;
    target: number;
    seconds: number;
}

/** Seconds the level takes to close about two thirds of its way. */
const easeSeconds = 0.45;

/** The level a frame later, eased toward its target. */
export function easeLowHealth({ level, target, seconds }: LowHealthEase) {
    return level + (target - level) * (1 - Math.exp(-seconds / easeSeconds));
}

/** Seconds from one beat to the next: 60 a minute at the threshold, 105
 *  at the edge of falling. */
export function measureBeatSeconds(level: number) {
    const beatsPerMinute = 60 + 45 * Math.min(1, Math.max(0, level));
    return 60 / beatsPerMinute;
}

/** One thump's rise and fall, `seconds` into the beat, peaking at `at`. */
function thump(seconds: number, at: number, width: number) {
    const distance = (seconds - at) / width;
    return Math.exp(-distance * distance);
}

/** The beat's swing, 0 to 1, `seconds` into it: a strong thump, then a
 *  softer one a fifth of a second later. */
function shapeBeat(seconds: number) {
    return Math.max(
        thump(seconds, 0.06, 0.07),
        0.6 * thump(seconds, 0.26, 0.08),
    );
}

const quadGeometry = new PlaneGeometry(2, 2);

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

//  Wider and darker than a blow's flash: the edges sink toward black
//  through a deep red.
const fragment = /* glsl */ `
uniform float uStrength;
varying vec2 vUv;
void main() {
    float edge = smoothstep(0.2, 1.0, length((vUv - 0.5) * vec2(1.5, 1.25)));
    vec3 color = mix(vec3(0.5, 0.02, 0.03), vec3(0.12, 0.0, 0.01), edge);
    gl_FragColor = vec4(color, edge * uStrength);
}`;

export function LowHealth() {
    const headless = useHeadless();
    const survivor = useTrait(useQueryFirst(Hero, Authority), WardenTrait);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const meshRef = useRef<Mesh>(null);
    const levelRef = useRef(0);
    //  Seconds into the current beat.
    const beatRef = useRef(0);
    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: vertex,
                fragmentShader: fragment,
                uniforms: { uStrength: { value: 0 } },
                transparent: true,
                depthTest: false,
                depthWrite: false,
            }),
        [],
    );
    useLayoutEffect(() => () => material.dispose(), [material]);

    const standing =
        survivor !== undefined &&
        !survivor.down &&
        siege?.phase !== SiegePhase.Over;
    const target =
        standing && survivor.maximum > 0
            ? measureLowHealth(survivor.health / survivor.maximum)
            : 0;

    useFrame((_state, delta) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const level = easeLowHealth({
            level: levelRef.current,
            target,
            seconds: delta,
        });
        levelRef.current = level < 0.005 && target === 0 ? 0 : level;
        if (levelRef.current === 0) {
            beatRef.current = 0;
            mesh.visible = false;
            return;
        }
        const period = measureBeatSeconds(level);
        const beat = beatRef.current;
        //  Each beat's sound on its first frame, and none once she is down or
        //  healed: only the red eases out.
        if (beat === 0 && target > 0)
            playSound(Sound.Heartbeat, { volume: level });
        beatRef.current = beat + delta >= period ? 0 : beat + delta;
        material.uniforms.uStrength.value =
            level * (0.7 + 0.3 * shapeBeat(beat));
        mesh.visible = true;
    });

    if (headless) return null;
    return (
        <mesh
            ref={meshRef}
            geometry={quadGeometry}
            material={material}
            frustumCulled={false}
            renderOrder={999}
            visible={false}
        />
    );
}
