import { createQuery, type World } from "koota";
import type { Vector3 } from "three";
import { Transform, updateEach, type StepOptions } from "@spawnite/engine/core";
import {
    BurstTrait,
    Lifetime,
    type BurstKind,
    type MonsterKind,
} from "./traits";

//  What every page draws for a moment and the room forgets after, a burst,
//  and the clock that takes such things away.

/** Seconds a burst stands: its whole show on a page. */
export const burstSeconds = 0.7;

export interface BurstSpawn {
    kind: BurstKind;
    position: Vector3;
    monster?: MonsterKind;
    size?: number;
}

/** A short effect every page draws at `position`. */
export function spawnBurst(
    world: World,
    { kind, position, monster, size = 1 }: BurstSpawn,
) {
    return world.spawn(
        Transform(position.clone()),
        BurstTrait({ kind, size, ...(monster && { monster }) }),
        Lifetime({ seconds: burstSeconds }),
    );
}

const mortals = createQuery(Lifetime);

/** Counts each entity's lifetime down and takes it away once it runs out. */
export function expireEntities(world: World, { deltaSeconds }: StepOptions) {
    //  Counted in place, with no change mark: nothing watches a lifetime.
    updateEach(world, mortals, ([lifetime], entity) => {
        lifetime.seconds -= deltaSeconds;
        if (lifetime.seconds <= 0) entity.destroy();
    });
}
