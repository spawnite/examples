import { useFrame } from "@react-three/fiber";
import { useWorld } from "koota/react";
import { Suspense, useRef } from "react";
import { Color, PlaneGeometry, type PointLight } from "three";
import {
    BodyKind,
    ColliderShape,
    Entity,
    GroundTrait,
    Shader,
    useHeadless,
    useTime,
    useWorldEntity,
    type Position,
} from "@spawnite/engine";
import { PhaseTrait, readPhase } from "../siege/phase";
import { HearthModel } from "./circle/HearthModel";
import { StoneModel } from "./circle/StoneModel";
import { runeUniforms } from "./circle/stoneMaterial";
import { HearthWarmth, hearthGrowth, hearthWarmth } from "./circle/warmth";
import { ringMetres, standingStones } from "./layout";
import { useWelcomed } from "./welcomed";

//  The stone circle the wardens hold: a ring of standing stones whose runes
//  burn blue between waves and red while one is fought, and the hearth at
//  its middle. Each is an Entity with a body, so the room and every page
//  stop a warden and a monster at the same stone. The room draws nothing,
//  so it never fetches a model: only a page mounts them.

/** The pool of rune light on the ground at a stone's foot, and the fire's
 *  on the flagstones: flat discs drawn with light that fades outward. */
const poolGeometry = new PlaneGeometry(1, 1);

const restColor = new Color("#3aa8f8");
//  A little green and blue in the red lets the rune's brightest strokes burn
//  toward white under the tone mapping, as a hot light does; a pure red
//  stays a deep red at any brightness, and draws a darker rune.
const fightColor = new Color("#ff5046");
const fireColor = new Color("#ff7a2e");
/** The runes' colour on the ground, shared by every stone's pool. */
const poolColor = restColor.clone();

/** A soft round glow, strongest at the middle and gone at the edge. */
const poolFragment = /* glsl */ `
void main() {
    float fromMiddle = length(vUv - 0.5) * 2.0;
    float glow = pow(max(1.0 - fromMiddle, 0.0), 2.2);
    gl_FragColor = vec4(uColor * uStrength, glow);
}`;

/** Every rune's colour and pulse, eased toward the siege's phase, and
 *  on the phase at once after a welcome. The phase is read in the frame,
 *  which may come before the render a welcome starts. */
function RuneGlow() {
    const world = useWorld();
    const isWelcomed = useWelcomed();
    useFrame((_, delta) => {
        const fighting = readPhase(world.queryFirst(PhaseTrait)) === "fight";
        const seconds = useTime.getState().seconds;
        const color = runeUniforms.uRuneColor.value;
        color.lerp(
            fighting ? fightColor : restColor,
            isWelcomed() ? 1 : Math.min(delta * 2, 1),
        );
        runeUniforms.uRunePower.value = 1.6 + Math.sin(seconds * 1.5) * 0.4;
        runeUniforms.uTime.value = seconds;
        poolColor.copy(color);
    });
    return null;
}

interface StandingStoneProps {
    index: number;
    position: Position;
    yaw: number;
}

/** The capsule a standing stone stands in: as wide as the drawn stone and
 *  as tall as the shortest, so a shot or the camera's sweep at the heights
 *  she fights at meets it.
 *  ponytail: a capsule narrows to a point at its ends, so it is full width
 *  only from 0.55 m to 2.65 m and misses the taller stones' tops up to
 *  3.9 m; a box or a hull from the drawn model would cover the whole
 *  stone. */
const stoneCollider = { width: 1.1, height: 3.2 };

/** One standing stone, facing the middle, its runes on its inner face.
 *  The entity stands at the capsule's middle, which a collider is centred
 *  on, and the drawing back down on the ground. */
function StandingStone({ index, position, yaw }: StandingStoneProps) {
    const headless = useHeadless();
    const [x, ground, z] = position;
    const lift = stoneCollider.height / 2;
    return (
        <Entity
            position={[x, ground + lift, z]}
            collider={{
                shape: ColliderShape.Capsule,
                kind: BodyKind.Fixed,
                size: [
                    stoneCollider.width,
                    stoneCollider.height,
                    stoneCollider.width,
                ],
            }}
        >
            {!headless && (
                <group rotation-y={yaw} position-y={-lift}>
                    <Suspense fallback={null}>
                        <StoneModel index={index} />
                    </Suspense>
                    <mesh
                        geometry={poolGeometry}
                        position={[0, 0.06, 0.9]}
                        rotation-x={-Math.PI / 2}
                        scale={3.2}
                    >
                        <Shader
                            fragment={poolFragment}
                            uniforms={{ uColor: poolColor, uStrength: 0.9 }}
                            transparent
                        />
                    </mesh>
                </group>
            )}
        </Entity>
    );
}

/** The fire's light: a slow falloff, so its warmth reaches the ring where
 *  the fighting is rather than a pool round the logs, and a reach past the
 *  ring's outer edge. At the ring it is about twice what a decay of 1.3
 *  gave, and within 2 m of the logs about the same. */
const fireCandela = 24;
const fireDecay = 1;
const fireReach = ringMetres.radius + ringMetres.halfWidth + 18;

interface HearthProps {
    /** The ground's height under the fire, which the drawn pit sits on. */
    floor: number;
}

/** The fire: a ring of stones, logs, flames, and a warm light that
 *  flickers, stronger while the hearth warms the wardens between waves. The light stands outside the hearth's entity, which a room's
 *  page mounts only once the room streams it: a light that arrives changes
 *  every lit shader, so this one is in the scene from its first frame. */
function Hearth({ floor }: HearthProps) {
    const headless = useHeadless();
    const lightRef = useRef<PointLight>(null);
    useFrame(() => {
        const light = lightRef.current;
        if (!light) return;
        const now = useTime.getState().seconds;
        //  Three unrelated rates, so the flicker never repeats to the eye.
        const flicker =
            Math.sin(now * 7.3) * 0.5 +
            Math.sin(now * 13.1 + 1.7) * 0.3 +
            Math.sin(now * 23.7 + 0.4) * 0.2;
        light.intensity =
            (fireCandela + flicker * 4) *
            (1 + hearthWarmth.value * 0.5) *
            (0.6 + hearthGrowth.size * 0.4);
        light.distance = fireReach * (0.8 + hearthGrowth.size * 0.2);
        light.position.x = Math.sin(now * 5.1) * 0.06;
        light.position.z = Math.cos(now * 4.3) * 0.06;
    });
    return (
        <>
            {!headless && (
                <pointLight
                    ref={lightRef}
                    position-y={floor + 1.4}
                    color="#ff8a3d"
                    intensity={fireCandela}
                    distance={fireReach}
                    decay={fireDecay}
                />
            )}
            <Entity
                name="hearth"
                collider={{
                    shape: ColliderShape.Sphere,
                    kind: BodyKind.Fixed,
                    size: [2.4, 2.4, 2.4],
                }}
            >
                {!headless && (
                    <group position-y={floor}>
                        <Suspense fallback={null}>
                            <HearthModel />
                        </Suspense>
                        <HearthWarmth />
                        <mesh
                            geometry={poolGeometry}
                            position-y={0.05}
                            rotation-x={-Math.PI / 2}
                            scale={9}
                        >
                            <Shader
                                fragment={poolFragment}
                                uniforms={{ uColor: fireColor, uStrength: 0.8 }}
                                transparent
                            />
                        </mesh>
                    </group>
                )}
            </Entity>
        </>
    );
}

/** The hearth and the stones, each stood on the map's ground. */
export function Circle() {
    const surface = useWorldEntity().get(GroundTrait)?.surface;
    const headless = useHeadless();
    return (
        <>
            {!headless && <RuneGlow />}
            <Hearth floor={surface?.getHeightAt({ x: 0, z: 0 }) ?? 0} />
            {standingStones.map(({ x, z, yaw }, index) => (
                <StandingStone
                    key={`${x}:${z}`}
                    index={index}
                    position={[x, surface?.getHeightAt({ x, z }) ?? 0, z]}
                    yaw={yaw}
                />
            ))}
        </>
    );
}
