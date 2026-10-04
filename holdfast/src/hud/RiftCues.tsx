import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait, useWorld } from "koota/react";
import type { Entity } from "koota";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    type Camera,
    Color,
    type Mesh,
    PlaneGeometry,
    ShaderMaterial,
    Vector2,
    Vector3,
} from "three";
import {
    AuthorityTrait,
    HeroTrait,
    screenOverlayUserData,
    TransformTrait,
    useHeadless,
} from "@spawnite/engine";
import {
    BurstKind,
    BurstTrait,
    MonsterKind,
    SiegeTrait,
} from "../siege/traits";
import { monsterLooks } from "../views/palette";
import { measureArcAngle } from "./DamageArc";

//  A chevron at the edge of the screen toward each rift that opens out of
//  her view, in the eye colour of what climbs out of it, as Left 4 Dead
//  and Back 4 Blood point at a special they announce: the first husks of a
//  night rise wherever the room puts them, often behind her. It turns as
//  she does, fades within a few seconds, and fades faster once she has the
//  rift in view. Rifts a few degrees apart share one chevron. Larger in the
//  first waves, while she learns where the Hollow come from, and for a
//  colossus.
//  Drawn as a quad in clip space, like the damage arc, so it updates every
//  frame without a render of the HUD.

/** Seconds a cue holds at full strength, then the seconds it fades by. */
const holdSeconds = 1.2;
const goneSeconds = 2.6;
/** Times faster a cue fades once its rift is in her view. */
const seenFade = 4;

/** A cue's strength, 0 to 1, `seconds` after its rift opened. */
export function fadeCue(seconds: number) {
    if (seconds <= holdSeconds) return 1;
    const faded = Math.min(
        1,
        (seconds - holdSeconds) / (goneSeconds - holdSeconds),
    );
    return 1 - faded * faded;
}

/** A place on the screen, in pixels from its middle, y up. */
export interface ScreenPoint {
    x: number;
    y: number;
}

/** Pixels, at 1080 lines, between a cue and the screen's edge. */
const edgePixels = 90;

/** Where a cue stands for `angle`, radians from the top of the screen
 *  clockwise, as the damage arc measures it: on an oval inset from the
 *  screen's edges, so ahead is the top edge, her right the right edge and
 *  behind the bottom. */
/** The screen's size in pixels. */
export interface ScreenSize {
    width: number;
    height: number;
}

export function placeCue(
    angle: number,
    { width, height }: ScreenSize,
): ScreenPoint {
    const inset = (edgePixels * Math.min(width, height)) / 1080;
    return {
        x: Math.sin(angle) * (width / 2 - inset),
        y: Math.cos(angle) * (height / 2 - inset),
    };
}

/** Radians of bearing within which two rifts share a cue. */
const shareRadians = Math.PI / 6;

/** Cues shown at once: a crowd's rifts open a breath apart, so the next
 *  takes the oldest's place. */
const cueCount = 6;

/** A cue's size: the colossus's, the first waves', and any other's. */
const colossusScale = 1.6;
const earlyScale = 1.3;
/** The last wave whose cues draw larger. */
const lastEarlyWave = 3;

/** How large a cue draws for a rift of `kind` in wave `wave`. */
export function measureCueScale(kind: MonsterKind, wave: number) {
    if (kind === MonsterKind.Colossus) return colossusScale;
    return wave <= lastEarlyWave ? earlyScale : 1;
}

const quadGeometry = new PlaneGeometry(2, 2);

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

//  Sizes in pixels at 1080 lines, scaled with the screen and the cue.
const fragment = /* glsl */ `
#define CUES ${cueCount}
uniform vec2 uSize;
uniform vec2 uCenters[CUES];
uniform float uAngles[CUES];
uniform float uStrengths[CUES];
uniform float uScales[CUES];
uniform vec3 uColors[CUES];
varying vec2 vUv;

float segment(vec2 point, vec2 from, vec2 to) {
    vec2 along = to - from;
    float t = clamp(dot(point - from, along) / dot(along, along), 0.0, 1.0);
    return length(point - from - along * t);
}

void main() {
    vec2 point = (vUv - 0.5) * uSize;
    float screen = min(uSize.x, uSize.y) / 1080.0;
    vec3 color = vec3(0.0);
    float alpha = 0.0;
    for (int index = 0; index < CUES; index++) {
        float strength = uStrengths[index];
        if (strength <= 0.0) continue;
        float scale = screen * uScales[index];
        vec2 forward = vec2(sin(uAngles[index]), cos(uAngles[index]));
        vec2 side = vec2(forward.y, -forward.x);
        vec2 local = point - uCenters[index];
        // Two chevrons, nested, pointing outward: the outer one leads.
        float shape = 1e5;
        for (int row = 0; row < 2; row++) {
            vec2 tip = forward * (18.0 - float(row) * 17.0) * scale;
            vec2 back = tip - forward * 20.0 * scale;
            shape = min(shape, segment(local, tip, back + side * 22.0 * scale));
            shape = min(shape, segment(local, tip, back - side * 22.0 * scale));
        }
        float thickness = 4.5 * scale;
        float core = 1.0 - smoothstep(thickness - 1.0, thickness, shape);
        float rim = 1.0 - smoothstep(thickness, thickness + 3.0 * screen, shape);
        float glow = exp(-shape / (14.0 * scale)) * 0.35;
        vec3 lit = mix(uColors[index], vec3(1.0), 0.25 * core);
        float cueAlpha = strength * max(core, max(rim * 0.6, glow));
        color = mix(color, lit * max(core, glow * 1.5), cueAlpha);
        alpha = max(alpha, cueAlpha);
    }
    gl_FragColor = vec4(color, alpha);
}`;

/** One cue: the rift it points at, its colour and size, and seconds
 *  since. */
interface ShownCue {
    source: Vector3;
    color: Color;
    scale: number;
    seconds: number;
}

//  Written in place each frame.
const facing = new Vector3();
const projected = new Vector3();

/** Whether `at`, a metre over the ground, stands in the camera's view. */
function isInView(camera: Camera, at: Vector3) {
    projected.set(at.x, at.y + 1, at.z).project(camera);
    return (
        projected.z < 1 &&
        Math.abs(projected.x) < 0.9 &&
        Math.abs(projected.y) < 0.9
    );
}

/** The cue that points within `shareRadians` of `source`'s bearing from
 *  `feet`, else the oldest. */
function findCueFor(cues: ShownCue[], feet: Vector3, source: Vector3) {
    const bearing = Math.atan2(source.x - feet.x, source.z - feet.z);
    let oldest = cues[0];
    for (const cue of cues) {
        if (cue.seconds < goneSeconds) {
            const other = Math.atan2(
                cue.source.x - feet.x,
                cue.source.z - feet.z,
            );
            const apart = Math.abs(
                ((bearing - other + 3 * Math.PI) % (2 * Math.PI)) - Math.PI,
            );
            if (apart < shareRadians) return cue;
        }
        if (cue.seconds > oldest.seconds) oldest = cue;
    }
    return oldest;
}

export function RiftCues() {
    const world = useWorld();
    const headless = useHeadless();
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const wave = useTrait(useQueryFirst(SiegeTrait), SiegeTrait)?.wave ?? 0;
    const meshRef = useRef<Mesh>(null);
    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: vertex,
                fragmentShader: fragment,
                uniforms: {
                    uSize: { value: [1, 1] },
                    uCenters: {
                        value: Array.from(
                            { length: cueCount },
                            () => new Vector2(),
                        ),
                    },
                    uAngles: { value: new Array<number>(cueCount).fill(0) },
                    uStrengths: { value: new Array<number>(cueCount).fill(0) },
                    uScales: { value: new Array<number>(cueCount).fill(1) },
                    uColors: {
                        value: Array.from(
                            { length: cueCount },
                            () => new Color(),
                        ),
                    },
                },
                transparent: true,
                depthTest: false,
                depthWrite: false,
            }),
        [],
    );
    useLayoutEffect(() => () => material.dispose(), [material]);
    const cues = useMemo<ShownCue[]>(
        () =>
            Array.from({ length: cueCount }, () => ({
                source: new Vector3(),
                color: new Color(),
                scale: 1,
                seconds: goneSeconds,
            })),
        [],
    );
    //  The rifts already seen, so each opens one cue; those standing as
    //  the view mounts, as on a join, open none.
    const seenRef = useRef<Set<Entity> | null>(null);
    const waveRef = useRef(wave);
    waveRef.current = wave;

    useFrame(({ camera, size }, delta) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const feet = hero?.get(TransformTrait);
        const rifts = world.query(BurstTrait, TransformTrait);
        const first = seenRef.current === null;
        const seen = (seenRef.current ??= new Set());
        for (const rift of seen) if (!rift.isAlive()) seen.delete(rift);
        for (const rift of rifts) {
            if (seen.has(rift)) continue;
            seen.add(rift);
            const burst = rift.get(BurstTrait);
            const at = rift.get(TransformTrait);
            if (first || !feet || !at || burst?.kind !== BurstKind.Rift)
                continue;
            if (isInView(camera, at)) continue;
            const cue = findCueFor(cues, feet, at);
            cue.source.copy(at);
            cue.color.set(monsterLooks[burst.monster].eyes);
            cue.scale = measureCueScale(burst.monster, waveRef.current);
            cue.seconds = 0;
        }

        camera.getWorldDirection(facing);
        const { uAngles, uStrengths, uScales, uColors, uCenters, uSize } =
            material.uniforms;
        let shown = false;
        cues.forEach((cue, index) => {
            cue.seconds +=
                delta * (feet && isInView(camera, cue.source) ? seenFade : 1);
            const strength = feet ? fadeCue(cue.seconds) : 0;
            uStrengths.value[index] = cue.seconds < goneSeconds ? strength : 0;
            if (!feet || cue.seconds >= goneSeconds) return;
            shown = true;
            const angle = measureArcAngle({
                from: feet,
                to: cue.source,
                facing,
            });
            const place = placeCue(angle, size);
            uAngles.value[index] = angle;
            uCenters.value[index].set(place.x, place.y);
            uScales.value[index] = cue.scale;
            uColors.value[index].copy(cue.color);
        });
        uSize.value[0] = size.width;
        uSize.value[1] = size.height;
        mesh.visible = shown;
    });

    if (headless) return null;
    return (
        <mesh
            ref={meshRef}
            geometry={quadGeometry}
            material={material}
            frustumCulled={false}
            userData={screenOverlayUserData}
            renderOrder={1001}
            visible={false}
        />
    );
}
