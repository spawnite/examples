import type { Entity } from "koota";
import { quaternionToYaw } from "@spawnite/engine";
import { Facing } from "@spawnite/engine";

export function readFacingYaw(entity: Entity) {
    const facing = entity.get(Facing);
    if (!facing) throw new Error("The entity has no facing.");
    return quaternionToYaw(facing.rotation);
}
