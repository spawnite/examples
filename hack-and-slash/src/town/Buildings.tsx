import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BodyKind, ColliderShape, Entity } from "@spawnite/engine";
import {
    BoxGeometry,
    Color,
    CylinderGeometry,
    DataTexture,
    MeshToonMaterial,
    NearestFilter,
    RedFormat,
    SphereGeometry,
    type Mesh,
    type MeshBasicMaterial,
} from "@spawnite/engine/three";
import { smolder } from "../combat/motes";

//  The town's buildings, made of boxes and prisms in her toon light: cream
//  walls in a dark timber frame under steep roofs, each solid to walk
//  into. A building's front faces the way it is turned, toward the plaza.

let bands: DataTexture | null = null;
function toonBands() {
    if (!bands) {
        bands = new DataTexture(
            new Uint8Array([110, 190, 255]),
            3,
            1,
            RedFormat,
        );
        bands.minFilter = NearestFilter;
        bands.magFilter = NearestFilter;
        bands.needsUpdate = true;
    }
    return bands;
}

const materials = new Map<string, MeshToonMaterial>();
/** One toon material a colour, shared by every building. */
function paint(color: string, glow?: string) {
    const key = `${color}/${glow ?? ""}`;
    let material = materials.get(key);
    if (!material) {
        material = new MeshToonMaterial({
            color: new Color(color),
            gradientMap: toonBands(),
            ...(glow
                ? { emissive: new Color(glow), emissiveIntensity: 1 }
                : {}),
        });
        materials.set(key, material);
    }
    return material;
}

const box = new BoxGeometry(1, 1, 1);
/** A roof's prism: a cylinder of three sides laid on its side. */
const prism = new CylinderGeometry(1, 1, 1, 3);
const post = new CylinderGeometry(0.5, 0.5, 1, 10);
const ball = new SphereGeometry(0.5, 12, 8);

const plaster = "#f1e3c6";
const timber = "#6b4a2b";
const stone = "#9aa0a6";
const pane = "#a8d8f0";

/** A block: `size` metres across, tall and deep, standing on `at`. */
function Block({
    at,
    size,
    color,
    glow,
    turn = 0,
}: {
    at: [number, number, number];
    size: [number, number, number];
    color: string;
    glow?: string;
    turn?: number;
}) {
    return (
        <mesh
            geometry={box}
            material={paint(color, glow)}
            position={[at[0], at[1] + size[1] / 2, at[2]]}
            rotation-y={turn}
            scale={size}
            castShadow
            receiveShadow
        />
    );
}

/** A roof over walls `width` across and `depth` deep, standing at
 *  `height`: its ridge runs across, its slopes face front and back. */
function Roof({
    width,
    depth,
    height,
    rise,
    color,
}: {
    width: number;
    depth: number;
    height: number;
    rise: number;
    color: string;
}) {
    //  A three-sided cylinder's triangle points along its z, reaching 1
    //  out and its flat side 0.5 back, 1.73 across: turned so it points up
    //  and lies along x, squashed to the rise and spread past the walls,
    //  its flat side on them and its eaves over them.
    return (
        <group position={[0, height + rise / 3, 0]} rotation-z={Math.PI / 2}>
            <mesh
                geometry={prism}
                material={paint(color)}
                rotation-y={Math.PI / 2}
                scale={[(depth + 0.7) / 1.732, width + 0.5, rise / 1.5]}
                castShadow
            />
        </group>
    );
}

/** A timber-framed house: walls `width` by `depth` and `height` tall under
 *  a roof, a door and two windows on its front, beams at its corners and
 *  eaves. Solid, as a fixed box the size of its walls. */
export function House({
    at,
    turn = 0,
    width = 5,
    depth = 4,
    height = 2.8,
    roof = "#b83a3a",
    walls = plaster,
    children,
}: {
    at: [number, number];
    /** Quarter turns from facing +z. */
    turn?: 0 | 1 | 2 | 3;
    width?: number;
    depth?: number;
    height?: number;
    roof?: string;
    walls?: string;
    children?: React.ReactNode;
}) {
    const across = turn % 2 === 0;
    const footprint: [number, number, number] = across
        ? [width, height, depth]
        : [depth, height, width];
    const front = depth / 2 + 0.03;
    return (
        <Entity
            position={[at[0], height / 2, at[1]]}
            collider={{
                shape: ColliderShape.Box,
                kind: BodyKind.Fixed,
                size: footprint,
            }}
        >
            <group position-y={-height / 2} rotation-y={(turn * Math.PI) / 2}>
                <Block
                    at={[0, 0, 0]}
                    size={[width, height, depth]}
                    color={walls}
                />
                {/*  A stone footing, the beams at its corners and eaves. */}
                <Block
                    at={[0, 0, 0]}
                    size={[width + 0.12, 0.35, depth + 0.12]}
                    color={stone}
                />
                {[-1, 1].map((side) =>
                    [-1, 1].map((end) => (
                        <Block
                            key={`${side}${end}`}
                            at={[(side * width) / 2, 0, (end * depth) / 2]}
                            size={[0.22, height, 0.22]}
                            color={timber}
                        />
                    )),
                )}
                <Block
                    at={[0, height - 0.15, front - 0.02]}
                    size={[width, 0.2, 0.08]}
                    color={timber}
                />
                <Block
                    at={[0, height - 0.15, -front + 0.02]}
                    size={[width, 0.2, 0.08]}
                    color={timber}
                />
                {/*  Its door and windows. */}
                <Block
                    at={[0, 0, front]}
                    size={[0.95, 1.75, 0.08]}
                    color="#4a2f1a"
                />
                <Block
                    at={[0, 1.72, front]}
                    size={[1.15, 0.12, 0.1]}
                    color={timber}
                />
                {[-1, 1].map((side) => (
                    <group
                        key={side}
                        position={[(side * width) / 3.2, 1.35, front]}
                    >
                        <Block
                            at={[0, 0, 0]}
                            size={[0.8, 0.7, 0.06]}
                            color={pane}
                        />
                        <Block
                            at={[0, -0.06, 0.02]}
                            size={[0.92, 0.1, 0.1]}
                            color={timber}
                        />
                        <Block
                            at={[0, 0.68, 0.02]}
                            size={[0.92, 0.1, 0.1]}
                            color={timber}
                        />
                        <Block
                            at={[0, 0, 0.03]}
                            size={[0.07, 0.7, 0.06]}
                            color={timber}
                        />
                    </group>
                ))}
                <Roof
                    width={width}
                    depth={depth}
                    height={height}
                    rise={1.7}
                    color={roof}
                />
                {children}
            </group>
        </Entity>
    );
}

/** The smithy's forge, glowing, with a chimney that smokes and sparks,
 *  and an anvil: what the smith stands by. At `at`, its front to `turn`. */
export function Forge({
    at,
    turn = 0,
}: {
    at: [number, number];
    turn?: number;
}) {
    const coals = useRef<Mesh>(null);
    useFrame(({ clock }, delta) => {
        const mesh = coals.current;
        if (!mesh) return;
        const flicker =
            0.75 +
            0.25 *
                Math.sin(clock.elapsedTime * 9) *
                Math.sin(clock.elapsedTime * 5.3);
        (mesh.material as MeshBasicMaterial).color.setRGB(
            1,
            0.45 * flicker + 0.1,
            0.08,
        );
        smolder(at[0], 0.9, at[1], 0.35, true, delta * 0.6);
    });
    return (
        <Entity
            position={[at[0], 0.55, at[1]]}
            collider={{
                shape: ColliderShape.Box,
                kind: BodyKind.Fixed,
                size: [1.6, 1.1, 1.6],
            }}
        >
            <group position-y={-0.55} rotation-y={turn}>
                <Block at={[0, 0, 0]} size={[1.5, 0.9, 1.3]} color="#6f7378" />
                <mesh
                    ref={coals}
                    geometry={box}
                    position={[0, 0.92, 0.1]}
                    scale={[1.1, 0.08, 0.8]}
                >
                    <meshBasicMaterial color="#ff7a1a" toneMapped={false} />
                </mesh>
                <Block
                    at={[0, 0.9, -0.45]}
                    size={[0.6, 1.8, 0.45]}
                    color="#5d6166"
                />
                <pointLight
                    position={[0, 1.4, 0.2]}
                    color="#ff8a3a"
                    intensity={6}
                    distance={6}
                />
            </group>
        </Entity>
    );
}

export function Anvil({ at }: { at: [number, number] }) {
    return (
        <Entity
            position={[at[0], 0.4, at[1]]}
            collider={{
                shape: ColliderShape.Box,
                kind: BodyKind.Fixed,
                size: [0.8, 0.8, 0.5],
            }}
        >
            <group position-y={-0.4}>
                <Block
                    at={[0, 0, 0]}
                    size={[0.45, 0.45, 0.35]}
                    color={timber}
                />
                <Block
                    at={[0, 0.45, 0]}
                    size={[0.3, 0.15, 0.22]}
                    color="#3b3f45"
                />
                <Block
                    at={[0, 0.6, 0]}
                    size={[0.75, 0.16, 0.3]}
                    color="#3b3f45"
                />
            </group>
        </Entity>
    );
}

/** The store's counter under a striped awning, potions on it. */
export function Stall({
    at,
    turn = 0,
}: {
    at: [number, number];
    turn?: number;
}) {
    const stripes = useMemo(
        () => Array.from({ length: 7 }, (_, index) => index),
        [],
    );
    return (
        <Entity
            position={[at[0], 0.5, at[1]]}
            collider={{
                shape: ColliderShape.Box,
                kind: BodyKind.Fixed,
                size: [2.6, 1, 2.6],
            }}
        >
            <group position-y={-0.5} rotation-y={turn}>
                <Block at={[0, 0, 0]} size={[2.4, 1, 0.8]} color="#8a5a32" />
                <Block
                    at={[0, 1, 0]}
                    size={[2.6, 0.08, 0.95]}
                    color="#c79a5a"
                />
                {[-1, 1].map((side) => (
                    <Block
                        key={side}
                        at={[side * 1.2, 0, -0.1]}
                        size={[0.12, 2.3, 0.12]}
                        color={timber}
                    />
                ))}
                {stripes.map((index) => (
                    <Block
                        key={index}
                        at={[-1.2 + 0.37 * index + 0.18, 2.25, 0.05]}
                        size={[0.37, 0.08, 1.2]}
                        color={index % 2 ? "#f4f0e6" : "#d8423a"}
                        turn={0}
                    />
                ))}
                {[-0.8, -0.35, 0.1, 0.55].map((x, index) => (
                    <group key={x} position={[x, 1.08, 0.1]}>
                        <mesh
                            geometry={ball}
                            material={paint(index % 2 ? "#e8413a" : "#4a9ae8")}
                            scale={0.22}
                            position-y={0.11}
                        />
                        <mesh
                            geometry={post}
                            material={paint("#f2e6d8")}
                            scale={[0.07, 0.12, 0.07]}
                            position-y={0.26}
                        />
                    </group>
                ))}
            </group>
        </Entity>
    );
}

/** The well in the middle of the plaza. */
export function Well({ at }: { at: [number, number] }) {
    return (
        <Entity
            position={[at[0], 0.4, at[1]]}
            collider={{
                shape: ColliderShape.Box,
                kind: BodyKind.Fixed,
                size: [2, 0.8, 2],
            }}
        >
            <group position-y={-0.4}>
                <mesh
                    geometry={post}
                    material={paint(stone)}
                    scale={[2, 0.8, 2]}
                    position-y={0.4}
                    castShadow
                />
                <mesh
                    geometry={post}
                    material={paint("#3a6fa0")}
                    scale={[1.6, 0.05, 1.6]}
                    position-y={0.78}
                />
                {[-1, 1].map((side) => (
                    <Block
                        key={side}
                        at={[side * 0.85, 0.8, 0]}
                        size={[0.14, 1.4, 0.14]}
                        color={timber}
                    />
                ))}
                <Block
                    at={[0, 2.2, 0]}
                    size={[2.1, 0.12, 0.2]}
                    color={timber}
                />
                <Roof
                    width={1.6}
                    depth={1.6}
                    height={2.2}
                    rise={0.7}
                    color="#7a4a2a"
                />
            </group>
        </Entity>
    );
}

/** A lamp post whose lantern glows. */
export function Lamp({ at }: { at: [number, number] }) {
    return (
        <group position={[at[0], 0, at[1]]}>
            <mesh
                geometry={post}
                material={paint("#2f3337")}
                scale={[0.12, 2.6, 0.12]}
                position-y={1.3}
                castShadow
            />
            <mesh
                geometry={box}
                material={paint("#2f3337")}
                scale={[0.36, 0.08, 0.36]}
                position-y={2.62}
            />
            <mesh geometry={box} scale={[0.26, 0.34, 0.26]} position-y={2.45}>
                <meshBasicMaterial color="#ffd98a" toneMapped={false} />
            </mesh>
        </group>
    );
}

/** The town's north gate to the wilds: two stone towers, an arch beam and
 *  a banner, with the way between them open. */
export function Gate({ at }: { at: [number, number] }) {
    return (
        <>
            {[-1, 1].map((side) => (
                <Entity
                    key={side}
                    position={[at[0] + side * 2.6, 1.9, at[1]]}
                    collider={{
                        shape: ColliderShape.Box,
                        kind: BodyKind.Fixed,
                        size: [1.4, 3.8, 1.4],
                    }}
                >
                    <group position-y={-1.9}>
                        <Block
                            at={[0, 0, 0]}
                            size={[1.4, 3.8, 1.4]}
                            color={stone}
                        />
                        <Block
                            at={[0, 3.8, 0]}
                            size={[1.6, 0.3, 1.6]}
                            color="#7d8288"
                        />
                    </group>
                </Entity>
            ))}
            <group position={[at[0], 0, at[1]]}>
                <Block
                    at={[0, 3.4, 0]}
                    size={[4.2, 0.45, 0.6]}
                    color={timber}
                />
                <Block
                    at={[0, 2.2, 0.32]}
                    size={[1.4, 1.1, 0.05]}
                    color="#3a5fa8"
                />
                <Block
                    at={[0, 2.35, 0.35]}
                    size={[0.5, 0.5, 0.05]}
                    color="#f2d24a"
                />
            </group>
        </>
    );
}

/** A low fence of posts and rails from `from` to `to`, not solid. */
export function Fence({
    from,
    to,
}: {
    from: [number, number];
    to: [number, number];
}) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const posts = Math.max(2, Math.round(length / 1.4) + 1);
    const turn = Math.atan2(dx, dz);
    return (
        <group position={[from[0], 0, from[1]]} rotation-y={turn}>
            {Array.from({ length: posts }, (_, index) => (
                <Block
                    key={index}
                    at={[0, 0, (index / (posts - 1)) * length]}
                    size={[0.14, 0.9, 0.14]}
                    color={timber}
                />
            ))}
            {[0.35, 0.7].map((height) => (
                <Block
                    key={height}
                    at={[0, height, length / 2]}
                    size={[0.06, 0.08, length]}
                    color="#8a6038"
                />
            ))}
        </group>
    );
}

/** Crates and a barrel, stacked by a wall. */
export function Crates({ at }: { at: [number, number] }) {
    return (
        <group position={[at[0], 0, at[1]]}>
            <Block at={[0, 0, 0]} size={[0.7, 0.7, 0.7]} color="#a0703a" />
            <Block
                at={[0.75, 0, 0.1]}
                size={[0.6, 0.6, 0.6]}
                color="#b07c42"
                turn={0.3}
            />
            <Block
                at={[0.2, 0.7, 0.05]}
                size={[0.5, 0.5, 0.5]}
                color="#9a6a36"
                turn={-0.2}
            />
            <mesh
                geometry={post}
                material={paint("#7a4a26")}
                scale={[0.55, 0.8, 0.55]}
                position={[-0.7, 0.4, 0.3]}
                castShadow
            />
        </group>
    );
}
