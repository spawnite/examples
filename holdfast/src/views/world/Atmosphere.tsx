import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    InstancedMesh,
    MeshBasicMaterial,
    Object3D,
    PlaneGeometry,
    ShaderMaterial,
    type Points,
} from "three";
import { useHeadless } from "@spawnite/engine";
import { readGlowTexture } from "../glowTexture";
import { duskAir } from "./air";

//  What moves in the still air: banks of low mist drifting slowly round the
//  forest's edge, and motes of dust and pollen that float over the circle
//  and catch the firelight. Both are one draw each, moved in place.

/** Mist banks, where they lie, and how big each is, in metres. */
const mistCount = 36;
const mistRing = { inner: 24, outer: 46 };
const mistSize = { least: 9, most: 16 };
/** Radians a second the mist turns round the circle. */
const mistDrift = 0.006;

/** Motes over the circle, and the box they drift in, in metres. */
const moteCount = 260;
const moteReach = 26;
const moteHeight = 5;
/** Metres a second a mote drifts. */
const moteMetresPerSecond = 0.24;

/** A fixed value from 0 to 1 for a number, so every page draws the same
 *  mist. */
function hashAtmosphere(value: number) {
    const sine = Math.sin(value * 91.7 + 13.1) * 43758.5453;
    return sine - Math.floor(sine);
}

interface MistBank {
    angle: number;
    radius: number;
    size: number;
    height: number;
    phase: number;
}

//  Written in place each frame.
const placer = new Object3D();

function Mist() {
    const meshRef = useRef<InstancedMesh>(null);
    const banks = useMemo<MistBank[]>(
        () =>
            Array.from({ length: mistCount }, (_, index) => ({
                angle:
                    (index / mistCount) * Math.PI * 2 +
                    hashAtmosphere(index) * 0.4,
                radius:
                    mistRing.inner +
                    hashAtmosphere(index + 100) *
                        (mistRing.outer - mistRing.inner),
                size:
                    mistSize.least +
                    hashAtmosphere(index + 200) *
                        (mistSize.most - mistSize.least),
                height: 0.4 + hashAtmosphere(index + 300) * 1.2,
                phase: hashAtmosphere(index + 400) * Math.PI * 2,
            })),
        [],
    );
    const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
    const material = useMemo(
        () =>
            new MeshBasicMaterial({
                map: readGlowTexture(),
                color: new Color(duskAir.color).lerp(
                    new Color("#9aa6d6"),
                    0.35,
                ),
                transparent: true,
                opacity: 0.16,
                depthWrite: false,
                fog: false,
            }),
        [],
    );
    useLayoutEffect(
        () => () => {
            geometry.dispose();
            material.dispose();
        },
        [geometry, material],
    );

    useFrame(({ clock, camera }) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const seconds = clock.elapsedTime;
        for (let index = 0; index < banks.length; index++) {
            const bank = banks[index];
            const angle = bank.angle + seconds * mistDrift;
            placer.position.set(
                Math.sin(angle) * bank.radius,
                bank.height + Math.sin(seconds * 0.2 + bank.phase) * 0.2,
                Math.cos(angle) * bank.radius,
            );
            //  Upright and turned to the camera about the vertical only, so
            //  a bank lies along the ground from any side.
            placer.rotation.set(
                0,
                Math.atan2(
                    camera.position.x - placer.position.x,
                    camera.position.z - placer.position.z,
                ),
                0,
            );
            placer.scale.set(bank.size, bank.size * 0.32, 1);
            placer.updateMatrix();
            mesh.setMatrixAt(index, placer.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, mistCount]}
            frustumCulled={false}
            renderOrder={2}
        />
    );
}

/** GLSL: a mote a few pixels across wherever it is, and gone as it nears
 *  the camera, so none swells into a disc in front of the lens. */
const moteVertex = /* glsl */ `
uniform float uScale;
varying float vMoteFade;
void main() {
    vec4 placed = modelViewMatrix * vec4(position, 1.0);
    float metres = -placed.z;
    gl_PointSize = clamp(0.09 * uScale / metres, 1.0, 5.0);
    vMoteFade = smoothstep(2.0, 5.0, metres) * (1.0 - smoothstep(30.0, 45.0, metres));
    gl_Position = projectionMatrix * placed;
}`;

const moteFragment = /* glsl */ `
uniform vec3 uColor;
varying float vMoteFade;
void main() {
    float fall = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(uColor * fall * vMoteFade * 0.6, 1.0);
}`;

function createMoteMaterial() {
    return new ShaderMaterial({
        vertexShader: moteVertex,
        fragmentShader: moteFragment,
        uniforms: {
            uScale: { value: 450 },
            uColor: { value: new Color("#ffd6a0") },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
    });
}

function Motes() {
    const pointsRef = useRef<Points>(null);
    const geometry = useMemo(() => {
        const positions = new Float32Array(moteCount * 3);
        for (let index = 0; index < moteCount; index++) {
            positions[index * 3] =
                (hashAtmosphere(index + 500) * 2 - 1) * moteReach;
            positions[index * 3 + 1] =
                0.3 + hashAtmosphere(index + 600) * moteHeight;
            positions[index * 3 + 2] =
                (hashAtmosphere(index + 700) * 2 - 1) * moteReach;
        }
        const made = new BufferGeometry();
        made.setAttribute("position", new BufferAttribute(positions, 3));
        return made;
    }, []);
    const material = useMemo(createMoteMaterial, []);
    const height = useThree((state) => state.size.height);
    const pixelRatio = useThree((state) => state.viewport.dpr);
    useLayoutEffect(() => {
        material.uniforms.uScale.value = (height * pixelRatio) / 2;
    }, [material, height, pixelRatio]);
    useLayoutEffect(
        () => () => {
            geometry.dispose();
            material.dispose();
        },
        [geometry, material],
    );

    //  Each mote wanders on its own slow sine, and the whole cloud rises a
    //  hair and wraps, so the air never looks frozen.
    useFrame(({ clock }, delta) => {
        const points = pointsRef.current;
        if (!points) return;
        const seconds = clock.elapsedTime;
        //  Metres a mote moves this frame: the same speed at any frame rate.
        const step = moteMetresPerSecond * delta;
        const attribute = geometry.getAttribute("position");
        const positions = attribute.array;
        for (let index = 0; index < moteCount; index++) {
            const phase = index * 1.37;
            const y = positions[index * 3 + 1] + step;
            positions[index * 3 + 1] = y > moteHeight + 0.3 ? 0.3 : y;
            positions[index * 3] += Math.sin(seconds * 0.3 + phase) * step;
            positions[index * 3 + 2] += Math.cos(seconds * 0.27 + phase) * step;
        }
        attribute.needsUpdate = true;
    });

    return (
        <points
            ref={pointsRef}
            geometry={geometry}
            material={material}
            frustumCulled={false}
        />
    );
}

/** The mist and the motes, on a page only. */
export function Atmosphere() {
    const headless = useHeadless();
    if (headless) return null;
    return (
        <>
            <Mist />
            <Motes />
        </>
    );
}
