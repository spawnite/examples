import type { Entity } from "koota";
import { quaternionToYaw } from "@spawnite/engine";
import { FacingTrait } from "@spawnite/engine";

export function readFacingYaw(entity: Entity) {
    const facing = entity.get(FacingTrait);
    if (!facing) throw new Error("The entity has no facing.");
    return quaternionToYaw(facing.rotation);
}
