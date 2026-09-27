import {
    BodyKind,
    ColliderShape,
    Entity,
    type ColliderProps,
    type EntityProps,
} from "@spawnite/engine";

type PlatformProps = Required<Pick<EntityProps, "position">> &
    Required<Pick<ColliderProps, "size">>;

/** One platform: a fixed box she lands on and jumps from. */
export function Platform({ position, size }: PlatformProps) {
    return (
        <Entity
            position={position}
            collider={{
                shape: ColliderShape.Box,
                kind: BodyKind.Fixed,
                size,
            }}
        >
            <mesh>
                <boxGeometry args={size} />
                <meshStandardMaterial color="peru" />
            </mesh>
        </Entity>
    );
}
