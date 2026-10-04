import { createQuery, type Entity, type World } from "koota";
import { ChaseTrait, readEach, TransformTrait } from "@spawnite/engine/core";
import { findNearestWarden } from "./monsters";
import { FrozenTrait, MonsterTrait, StandstillTrait } from "./traits";

//  The wave's last resort against a monster held where no warden reaches
//  it and it reaches no warden: a slope too steep for it to climb below a
//  warden on a hilltop, or a corner of the scatter. The causes this game
//  knows are fixed where they start; this catches the rest, so no wave
//  waits on one for good.

/** Seconds a monster stands, off from every warden, before it rises again
 *  near them. */
export const stalledSeconds = 10;
/** Metres it must move to count as coming on. */
const movedMetres = 1;
/** Metres from a warden within which a monster is in her fight however
 *  long it stands: the back of a crowd round her, or a colossus winding
 *  up. */
const nearMetres = 8;

const standing = createQuery(
    MonsterTrait,
    StandstillTrait,
    ChaseTrait,
    TransformTrait,
);
//  The monsters found stalled this step, refilled for each.
const stalled: Entity[] = [];

/** Counts how long each monster has stood off from every warden, and
 *  returns those that have stood `stalledSeconds`: each that has not moved
 *  a metre in that time while it stood farther from the nearest warden it
 *  chases than its reach and `nearMetres`. A frozen monster, and one with
 *  no warden to chase, starts its count again. Read the list at once: the
 *  next call refills it. */
export function findStalledMonsters(world: World, deltaSeconds: number) {
    stalled.length = 0;
    readEach(world, standing, ([, still, chase, at], monster) => {
        if (Math.hypot(at.x - still.x, at.z - still.z) >= movedMetres) {
            monster.set(StandstillTrait, { x: at.x, z: at.z, seconds: 0 });
            return;
        }
        const { warden, distance } = findNearestWarden(world, at);
        const counting =
            warden !== null &&
            !monster.has(FrozenTrait) &&
            distance > Math.max(chase.reach, nearMetres);
        const seconds = counting ? still.seconds + deltaSeconds : 0;
        if (seconds !== still.seconds)
            monster.set(StandstillTrait, { seconds });
        if (seconds >= stalledSeconds) stalled.push(monster);
    });
    return stalled;
}
