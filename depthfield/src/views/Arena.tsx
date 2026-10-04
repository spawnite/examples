import { useMemo } from "react";
import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import {
    BodyKind,
    ColliderShape,
    Entity,
    type Position,
} from "@spawnite/engine";
import { boundary, u } from "../rules/data";
import { findStage, StageId, type GridPaint } from "../rules/stages";
import { RunPhase } from "../rules/traits";
import { useRunView } from "../hud/useRunView";
import { VoidSkyMaterial } from "../shaders/VoidSky";
import { useChoice } from "../store/choice";
import { liftNeon } from "./neon";

//  The run's stage as the source drew its arena: a dark floor ruled in two
//  colours, four glowing walls, and the stage's boxes standing on it, each
//  over a faint shadow, every colour the stage's own, drawn past the
//  engine's tone mapping. The Neon Grid is the source's arena. The walls
//  and the boxes are fixed bodies the soldier walks into; the enemies push
//  round the boxes by the rules' own circles. Before a run starts, the
//  lobby's pick stands.

/** Metres between two grid lines, and how far the grid runs. */
const gridStep = u(100);
const gridReach = u(1100);

/** The grid's lines, each pair of points a segment, in one colour. */
function buildGrid(across: boolean, major: boolean) {
    const points: number[] = [];
    for (let step = -11; step <= 11; step++) {
        if ((step % 2 === 0) !== major) continue;
        const at = step * gridStep;
        if (across) points.push(-gridReach, 0, at, gridReach, 0, at);
        else points.push(at, 0, -gridReach, at, 0, gridReach);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
    return geometry;
}

interface FloorGridProps {
    paint: GridPaint;
}

/** The grid: lines along z in one colour, lines along x in another, each
 *  200 units brighter. */
export function FloorGrid({ paint }: FloorGridProps) {
    const lines = useMemo(
        () => [
            {
                geometry: buildGrid(false, true),
                name: "alongMajor",
                color: paint.alongMajor,
                opacity: 0.33,
            },
            {
                geometry: buildGrid(false, false),
                name: "alongMinor",
                color: paint.alongMinor,
                opacity: 0.13,
            },
            {
                geometry: buildGrid(true, true),
                name: "acrossMajor",
                color: paint.acrossMajor,
                opacity: 0.4,
            },
            {
                geometry: buildGrid(true, false),
                name: "acrossMinor",
                color: paint.acrossMinor,
                opacity: 0.13,
            },
        ],
        [paint],
    );
    return (
        <group position-y={0.045}>
            {lines.map(({ geometry, color, opacity, name }) => (
                <lineSegments key={name} geometry={geometry}>
                    <lineBasicMaterial
                        color={color}
                        transparent
                        opacity={opacity}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </lineSegments>
            ))}
        </group>
    );
}

interface BlockProps {
    position: Position;
    size: Position;
    side: string;
    top: string;
    /** The colour of the outline round the top, which glows. */
    rim: string;
    /** How far the top's colour is lifted toward the glow: 1 draws it as
     *  it is. */
    topLift?: number;
}

/** A box on the floor: its sides dark, its top lit, a neon line round its
 *  top, and a fixed body the soldier walks into. */
function Block({ position, size, side, top, rim, topLift = 1 }: BlockProps) {
    const [width, height, depth] = size;
    const topColor = useMemo(
        () => liftNeon(top, new Color(), topLift),
        [top, topLift],
    );
    const rimColor = useMemo(() => liftNeon(rim, new Color()), [rim]);
    return (
        //  The body's box is centred on the entity, so the entity stands half
        //  its height up and the box sits on the floor. Kinematic, not fixed:
        //  the engine's camera pulls in before every fixed body, and the
        //  source's view looked over its walls.
        //  ponytail: a camera knob that leaves a body out of the pull-in
        //  would let these be fixed (the pull request's engine gaps).
        <Entity
            position={[position[0], height / 2, position[2]]}
            collider={{
                shape: ColliderShape.Box,
                kind: BodyKind.Kinematic,
                size,
            }}
        >
            <mesh>
                <boxGeometry args={size} />
                <meshBasicMaterial
                    attach="material-0"
                    color={side}
                    toneMapped={false}
                />
                <meshBasicMaterial
                    attach="material-1"
                    color={side}
                    toneMapped={false}
                />
                <meshBasicMaterial
                    attach="material-2"
                    color={topColor}
                    toneMapped={false}
                />
                <meshBasicMaterial
                    attach="material-3"
                    color={side}
                    toneMapped={false}
                />
                <meshBasicMaterial
                    attach="material-4"
                    color={side}
                    toneMapped={false}
                />
                <meshBasicMaterial
                    attach="material-5"
                    color={side}
                    toneMapped={false}
                />
            </mesh>
            <lineLoop position-y={height / 2 + 0.002}>
                <bufferGeometry>
                    <float32BufferAttribute
                        attach="attributes-position"
                        args={[
                            [
                                -width / 2,
                                0,
                                -depth / 2,
                                width / 2,
                                0,
                                -depth / 2,
                                width / 2,
                                0,
                                depth / 2,
                                -width / 2,
                                0,
                                depth / 2,
                            ],
                            3,
                        ]}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={rimColor} toneMapped={false} />
            </lineLoop>
        </Entity>
    );
}

const wallThickness = u(56);

/** The stage the field shows: the run's, or before a run the lobby's
 *  pick. */
function useShownStage() {
    const picked = useChoice((choice) => choice.stage);
    const running = useRunView((run) =>
        run.phase === RunPhase.Title ? undefined : run.stage,
    );
    return running ?? picked ?? StageId.Grid;
}

export function Arena() {
    const stage = findStage(useShownStage());
    const { palette } = stage;
    return (
        <>
            {/*  The void round the arena, over the engine's ground. */}
            {/*  The flat layers stand centimetres apart, so their depth
                never fights at the camera's 24 metres. */}
            <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
                <planeGeometry args={[600, 600]} />
                <VoidSkyMaterial palette={palette} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
                <planeGeometry args={[boundary * 2, boundary * 2]} />
                <meshBasicMaterial color={palette.floor} toneMapped={false} />
            </mesh>
            <FloorGrid paint={palette.grid} />
            <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
                <ringGeometry args={[u(143), u(145), 64]} />
                <meshBasicMaterial
                    color={palette.ring}
                    transparent
                    opacity={0.33}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <Block
                position={[0, 0, -boundary]}
                size={[boundary * 2, u(64), wallThickness]}
                side={palette.farWall.side}
                top={palette.farWall.top}
                rim={palette.farWall.top}
                topLift={1.8}
            />
            <Block
                position={[0, 0, boundary]}
                size={[boundary * 2, u(36), wallThickness]}
                side={palette.nearWall.side}
                top={palette.nearWall.top}
                rim={palette.nearWall.top}
                topLift={1.8}
            />
            <Block
                position={[-boundary, 0, 0]}
                size={[wallThickness, u(48), boundary * 2]}
                side={palette.sideWalls.side}
                top={palette.sideWalls.top}
                rim={palette.sideWalls.top}
                topLift={1.8}
            />
            <Block
                position={[boundary, 0, 0]}
                size={[wallThickness, u(48), boundary * 2]}
                side={palette.sideWalls.side}
                top={palette.sideWalls.top}
                rim={palette.sideWalls.top}
                topLift={1.8}
            />
            {stage.props.map((prop) => (
                <mesh
                    key={`shadow ${stage.id} ${prop.x} ${prop.z}`}
                    rotation-x={-Math.PI / 2}
                    position={[prop.x, 0.035, prop.z]}
                >
                    <circleGeometry args={[prop.radius + u(5), 32]} />
                    <meshBasicMaterial
                        color={palette.shadow}
                        transparent
                        opacity={0.15}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            ))}
            {stage.props.map((prop) => (
                <Block
                    key={`${stage.id} ${prop.x} ${prop.z}`}
                    position={[prop.x, 0, prop.z]}
                    size={[prop.radius * 2, prop.height, prop.radius * 1.44]}
                    side={palette.props.side}
                    top={palette.props.top}
                    rim={palette.props.rim}
                    topLift={1.2}
                />
            ))}
        </>
    );
}
