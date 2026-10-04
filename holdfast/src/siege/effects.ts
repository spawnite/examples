import { createQuery, type World } from "koota";
import type { Vector3 } from "three";
import {
    TransformTrait,
    updateEach,
    type StepOptions,
} from "@spawnite/engine/core";
import {
    BurstTrait,
    LifetimeTrait,
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
    /** The key the stream names a recalled monster by. */
    monsterId?: string;
}

/** A short effect every page draws at `position`. */
export function spawnBurst(
    world: World,
    { kind, position, monster, size = 1, monsterId = "" }: BurstSpawn,
) {
    return world.spawn(
        TransformTrait(position.clone()),
        BurstTrait({ kind, size, monsterId, ...(monster && { monster }) }),
        LifetimeTrait({ seconds: burstSeconds }),
    );
}

const mortals = createQuery(LifetimeTrait);

/** Counts each entity's lifetime down and takes it away once it runs out. */
export function expireEntities(world: World, { deltaSeconds }: StepOptions) {
    //  Counted in place, with no change mark: nothing watches a lifetime.
    updateEach(world, mortals, ([lifetime], entity) => {
        lifetime.seconds -= deltaSeconds;
        if (lifetime.seconds <= 0) entity.destroy();
    });
}
