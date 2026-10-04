import { useMemo } from "react";
import { AdditiveBlending, Color } from "three";
import { findStage } from "../rules/stages";
import { VoidSkyMaterial } from "../shaders/VoidSky";
import { useChoice } from "../store/choice";
import { FloorGrid } from "./Arena";
import { readGlowTexture } from "./matcap";
import { liftNeon } from "./neon";

//  The lobby's world: the stage picked, as its arena draws it, round a
//  round platform the soldier stands on. The void's sky paints the floor
//  and a wall far behind by screen height, so the two meet with no seam,
//  and the stage's grid runs out to the wall. The platform's top is the
//  stage's floor, its edge a ring of the stage's neon, and a soft glow of
//  the same colour lies round its foot. A pick of another stage repaints
//  every part.

/** The platform's radius and height, in metres. */
export const platformRadius = 1.05;
export const platformHeight = 0.28;
/** Its foot flares out this much past its top, so its side catches the
 *  eye. */
const footFlare = 1.06;
/** Metres across the neon ring round its top, and the faint inner one. */
const rimWidth = 0.05;
const innerRingRadius = 0.78;
const innerRingWidth = 0.018;
/** How far the rings are lifted toward the glow. */
const rimLift = 2.6;
const innerRingLift = 1.3;
/** The glow round its foot: its radius, and how strong. */
const haloRadius = 2.6;
const haloOpacity = 0.42;
/** Where the wall behind stands, and its size: past the grid's reach, and
 *  wide and tall enough to fill the long lens on any screen. */
const wallDistance = 30;
const wallSize: [number, number] = [160, 60];
/** The wall's foot, below the floor, so no gap shows under it. */
const wallFoot = -10;
const floorSize = 200;
/** Segments round the platform's circles. */
const roundSegments = 96;
/** The flat layers stand millimetres apart, so their depth never fights. */
const floorLift = 0.01;
const ringLift = 0.002;

export function LobbyStage() {
    const { palette } = findStage(useChoice((choice) => choice.stage));
    const rim = useMemo(
        () => liftNeon(palette.ring, new Color(), rimLift),
        [palette.ring],
    );
    const innerRing = useMemo(
        () => liftNeon(palette.grid.acrossMajor, new Color(), innerRingLift),
        [palette.grid.acrossMajor],
    );
    return (
        <>
            <mesh rotation-x={-Math.PI / 2} position-y={floorLift}>
                <planeGeometry args={[floorSize, floorSize]} />
                <VoidSkyMaterial palette={palette} />
            </mesh>
            <mesh position={[0, wallSize[1] / 2 + wallFoot, -wallDistance]}>
                <planeGeometry args={wallSize} />
                <VoidSkyMaterial palette={palette} />
            </mesh>
            <FloorGrid paint={palette.grid} />
            <mesh rotation-x={-Math.PI / 2} position-y={floorLift * 3}>
                <circleGeometry args={[haloRadius, roundSegments]} />
                <meshBasicMaterial
                    map={readGlowTexture()}
                    color={palette.ring}
                    transparent
                    opacity={haloOpacity}
                    blending={AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <mesh position-y={platformHeight / 2}>
                <cylinderGeometry
                    args={[
                        platformRadius,
                        platformRadius * footFlare,
                        platformHeight,
                        roundSegments,
                    ]}
                />
                <meshBasicMaterial
                    attach="material-0"
                    color={palette.props.side}
                    toneMapped={false}
                />
                <meshBasicMaterial
                    attach="material-1"
                    color={palette.floor}
                    toneMapped={false}
                />
                <meshBasicMaterial
                    attach="material-2"
                    color={palette.props.side}
                    toneMapped={false}
                />
            </mesh>
            <mesh
                rotation-x={-Math.PI / 2}
                position-y={platformHeight + ringLift}
            >
                <ringGeometry
                    args={[
                        platformRadius - rimWidth,
                        platformRadius,
                        roundSegments,
                    ]}
                />
                <meshBasicMaterial color={rim} toneMapped={false} />
            </mesh>
            <mesh
                rotation-x={-Math.PI / 2}
                position-y={platformHeight + ringLift}
            >
                <ringGeometry
                    args={[
                        innerRingRadius - innerRingWidth,
                        innerRingRadius,
                        roundSegments,
                    ]}
                />
                <meshBasicMaterial color={innerRing} toneMapped={false} />
            </mesh>
        </>
    );
}
