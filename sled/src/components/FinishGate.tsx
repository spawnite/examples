import { useMemo } from "react";
import { Entity, TrackTrigger, type Track } from "@spawnite/engine";
import { palette } from "../palette";
import { CourseKind, readCourseRegion } from "../ride/course";
import { shoulderWidth } from "../track/profile";
import { Course } from "./Course";

/** Metres tall each post stands, and deep the banner hangs under the tops. */
const postHeight = 3;
const postRadius = 0.12;
const bannerDepth = 0.6;

interface FinishGateProps {
    track: Track;
    /** Metres along the track the finish line lies. */
    at: number;
}

/** The finish: a banner on two posts at the lane's edges, and a trigger
 *  from the line to the track's end across its whole width. Crossing it
 *  finishes the run. */
export function FinishGate({ track, at }: FinishGateProps) {
    const { position, turn, span } = useMemo(() => {
        const frame = track.frameAt(at);
        return {
            position: frame.position.toArray(),
            turn: Math.atan2(-frame.right.z, frame.right.x),
            span: frame.halfWidth - shoulderWidth,
        };
    }, [track, at]);
    return (
        <Entity name="Finish" position={position}>
            <TrackTrigger
                track={track}
                {...readCourseRegion(CourseKind.Finish, { at, side: 0 }, track)}
            />
            <Course kind={CourseKind.Finish} />
            <group rotation-y={turn}>
                {[-span, span].map((across) => (
                    <mesh
                        key={across}
                        position={[across, postHeight / 2, 0]}
                        castShadow
                    >
                        <cylinderGeometry
                            args={[postRadius, postRadius, postHeight]}
                        />
                        <meshStandardMaterial color={palette.gatePost} />
                    </mesh>
                ))}
                <mesh
                    position={[0, postHeight - bannerDepth / 2, 0]}
                    castShadow
                >
                    <boxGeometry args={[span * 2, bannerDepth, 0.08]} />
                    <meshStandardMaterial color={palette.band} />
                </mesh>
            </group>
        </Entity>
    );
}
