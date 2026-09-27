import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait } from "koota/react";
import { Suspense, useRef } from "react";
import { Color, PlaneGeometry, type PointLight } from "three";
import {
    BodyKind,
    ColliderShape,
    Entity,
    Ground,
    Shader,
    useHeadless,
    useTime,
    useWorldEntity,
    type Position,
} from "@spawnite/engine";
import { SiegePhase, SiegeTrait } from "../siege/traits";
import { HearthModel } from "./circle/HearthModel";
import { StoneModel } from "./circle/StoneModel";
import { runeUniforms } from "./circle/stoneMaterial";
import { standingStones } from "./layout";

//  The stone circle the wardens hold: a ring of standing stones whose runes
//  burn blue between waves and red while one is fought, and the hearth at
//  its middle. Each is an Entity with a body, so the room and every page
//  stop a warden and a monster at the same stone. The room draws nothing,
//  so it never fetches a model: only a page mounts them.

/** The pool of rune light on the ground at a stone's foot, and the fire's
 *  on the flagstones: flat discs drawn with light that fades outward. */
const poolGeometry = new PlaneGeometry(1, 1);

const restColor = new Color("#6cc8f2");
//  A little green and blue in the red keeps every channel above zero through
//  the look's saturation grade, which drives a purer red's blue negative and
//  draws the rune black.
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

/** Every rune's colour and pulse, eased toward the siege's phase. */
function RuneGlow() {
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const fighting = siege?.phase === SiegePhase.Fight;
    useFrame((_, delta) => {
        const seconds = useTime.getState().seconds;
        const color = runeUniforms.uRuneColor.value;
        color.lerp(fighting ? fightColor : restColor, Math.min(delta * 2, 1));
        runeUniforms.uRunePower.value = 2.6 + Math.sin(seconds * 1.5) * 0.9;
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

/** One standing stone, facing the middle, its runes on its inner face. */
function StandingStone({ index, position, yaw }: StandingStoneProps) {
    const headless = useHeadless();
    return (
        <Entity
            position={position}
            collider={{
                shape: ColliderShape.Capsule,
                kind: BodyKind.Fixed,
                size: [1.1, 2.8, 1.1],
            }}
        >
            {!headless && (
                <group rotation-y={yaw}>
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

interface HearthProps {
    /** The ground's height under the fire, which the drawn pit sits on. */
    floor: number;
}

/** The fire: a ring of stones, logs, flames, and a warm light that
 *  flickers. The light mounts with the hearth, before its models load, so
 *  the scene's light count never changes. */
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
        light.intensity = 30 + flicker * 5;
        light.position.x = Math.sin(now * 5.1) * 0.06;
        light.position.z = Math.cos(now * 4.3) * 0.06;
    });
    return (
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
                    <pointLight
                        ref={lightRef}
                        position-y={1.4}
                        color="#ff8a3d"
                        intensity={30}
                        distance={30}
                        decay={1.3}
                    />
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
    );
}

/** The hearth and the stones, each stood on the map's ground. */
export function Circle() {
    const surface = useWorldEntity().get(Ground)?.surface;
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
