import { Suspense, useMemo } from "react";
import { Clone } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import {
    Entity,
    TrackTrigger,
    useHeadless,
    useModel,
    type Track,
} from "@spawnite/engine";
import type { SledMap } from "../maps";
import {
    CourseKind,
    readCourseRegion,
    rockSizes,
    type RockKind,
    type CourseSpot,
} from "../ride/course";
import { Course } from "./Course";

/** Copies of the model a kind lays across its box, as the old sled did:
 *  a row of three low domes, or barrel cacti, reads apart from the one flat
 *  slab, or fallen trunk, of the same width. */
const across: Record<RockKind, number> = {
    [CourseKind.Slab]: 1,
    [CourseKind.Rock]: 3,
    [CourseKind.Boulder]: 1,
};

/** The map's model for the kind stretched to the kind's box, in a row of
 *  `across` copies standing on the snow, so what the rider sees is what
 *  hits. */
export function RockModel({ kind, map }: Pick<RockProps, "kind" | "map">) {
    const { scene } = useModel(map.rocks[kind]);
    const { scale, lift, offsets } = useMemo(() => {
        const bounds = new Box3().setFromObject(scene);
        const size = bounds.getSize(new Vector3());
        const [width, height, depth] = rockSizes[kind];
        const each = width / across[kind];
        const fit = new Vector3(each / size.x, height / size.y, depth / size.z);
        return {
            scale: fit,
            lift: -bounds.min.y * fit.y,
            offsets: Array.from(
                { length: across[kind] },
                (_, index) => (index - (across[kind] - 1) / 2) * each,
            ),
        };
    }, [scene, kind]);
    return offsets.map((offset, index) => (
        <Clone
            key={offset}
            object={scene}
            scale={scale}
            position={[offset, lift, 0]}
            //  Every other copy turned round, so the row reads as a line of
            //  them rather than one stamped three times.
            rotation-y={(index % 2) * Math.PI}
            castShadow
            receiveShadow
        />
    ));
}

interface RockProps {
    track: Track;
    kind: RockKind;
    spot: CourseSpot;
    /** The map the track is on, which says what each kind looks like. */
    map: SledMap;
}

/** A rock on the course, or what the map draws in its place: a slab or a
 *  low rock stuns the rider and a jump clears it; a boulder crashes the
 *  run. */
export function Rock({ track, kind, spot, map }: RockProps) {
    const { position, turn } = useMemo(() => {
        const frame = track.frameAt(spot.at);
        return {
            position: track.pointAt(spot.at, spot.side),
            //  Its width laid along the track's right.
            turn: Math.atan2(-frame.right.z, frame.right.x),
        };
    }, [track, spot]);
    //  Headless there is no page to draw it on, so no model loads.
    const headless = useHeadless();
    return (
        <Entity name="Rock" position={position.toArray()}>
            <TrackTrigger
                track={track}
                {...readCourseRegion(kind, spot, track)}
            />
            <Course kind={kind} />
            <group rotation-y={turn}>
                <Suspense fallback={null}>
                    {!headless && <RockModel kind={kind} map={map} />}
                </Suspense>
            </group>
        </Entity>
    );
}
