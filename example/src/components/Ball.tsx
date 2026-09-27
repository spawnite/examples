import {
    BodyKind,
    ColliderShape,
    Entity,
    type EntityProps,
} from "@spawnite/engine";

/** One ball: it falls to the ground and rolls away when she walks into it. */
export function Ball({ position }: Pick<EntityProps, "position">) {
    return (
        <Entity
            position={position}
            collider={{
                shape: ColliderShape.Sphere,
                kind: BodyKind.Dynamic,
                size: [1, 1, 1],
            }}
        >
            <mesh>
                <sphereGeometry args={[0.5, 24, 16]} />
                <meshStandardMaterial color="tomato" />
            </mesh>
        </Entity>
    );
}
