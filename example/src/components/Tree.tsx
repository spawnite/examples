import {
    BodyKind,
    ColliderShape,
    Entity,
    type EntityProps,
} from "@spawnite/engine";
import "../models";

/** One tree: its body is the hull of its model, so she stops at its bark
 *  and canopy rather than at a box round them. */
export function Tree({ position }: Pick<EntityProps, "position">) {
    return (
        <Entity
            model="tree"
            position={position}
            collider={{ shape: ColliderShape.Hull, kind: BodyKind.Fixed }}
        />
    );
}
