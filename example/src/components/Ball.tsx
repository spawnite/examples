import {
    BodyKind,
    ColliderShape,
    Entity,
    type EntityProps,
} from "@spawnite/engine";
import { Roll } from "../behaviours/Roll";

/** One ball: it falls to the ground and rolls away when she walks into it,
 *  and its Roll says whether it still rests on its spot. */
export function Ball({ position }: Required<Pick<EntityProps, "position">>) {
    return (
        <Entity
            position={position}
            collider={{
                shape: ColliderShape.Sphere,
                kind: BodyKind.Dynamic,
                size: [1, 1, 1],
            }}
        >
            <Roll spot={position} />
            <mesh>
                <sphereGeometry args={[0.5, 24, 16]} />
                <meshStandardMaterial color="tomato" />
            </mesh>
        </Entity>
    );
}
