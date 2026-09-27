import { Suspense, useMemo } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import {
    Entity,
    extendGltfLoader,
    TrackTrigger,
    type Track,
} from "@spawnite/engine";
import crag from "@game/assets/models/sled/rock-crag.glb?url";
import low from "@game/assets/models/sled/rock-low.glb?url";
import slab from "@game/assets/models/sled/rock-slab.glb?url";
import {
    CourseKind,
    readCourseRegion,
    rockSizes,
    type RockKind,
    type CourseSpot,
} from "../ride/course";
import { Course } from "./Course";

const models: Record<RockKind, string> = {
    [CourseKind.Slab]: slab,
    [CourseKind.Rock]: low,
    [CourseKind.Boulder]: crag,
};

/** The tier's model stretched to its box, standing on the snow, so what
 *  the rider sees is what hits. */
function RockLook({ kind }: { kind: RockKind }) {
    const { scene } = useGLTF(models[kind], false, undefined, extendGltfLoader);
    const { scale, lift } = useMemo(() => {
        const bounds = new Box3().setFromObject(scene);
        const size = bounds.getSize(new Vector3());
        const [width, height, depth] = rockSizes[kind];
        const fit = new Vector3(
            width / size.x,
            height / size.y,
            depth / size.z,
        );
        return { scale: fit, lift: -bounds.min.y * fit.y };
    }, [scene, kind]);
    return (
        <Clone
            object={scene}
            scale={scale}
            position-y={lift}
            castShadow
            receiveShadow
        />
    );
}

interface RockProps {
    track: Track;
    kind: RockKind;
    spot: CourseSpot;
}

/** A rock on the course: a slab or a low rock stuns the rider and a
 *  jump clears it; a boulder crashes the run. */
export function Rock({ track, kind, spot }: RockProps) {
    const { position, turn } = useMemo(() => {
        const frame = track.frameAt(spot.at);
        return {
            position: track.pointAt(spot.at, spot.side),
            //  Its width laid along the track's right.
            turn: Math.atan2(-frame.right.z, frame.right.x),
        };
    }, [track, spot]);
    return (
        <Entity name="Rock" position={position.toArray()}>
            <TrackTrigger
                track={track}
                {...readCourseRegion(kind, spot, track)}
            />
            <Course kind={kind} />
            <group rotation-y={turn}>
                <Suspense fallback={null}>
                    <RockLook kind={kind} />
                </Suspense>
            </group>
        </Entity>
    );
}
