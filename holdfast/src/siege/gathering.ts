import type { Entity, TraitRecord, World } from "koota";
import { isCounted, PhaseMachine, type Phase } from "./phase";
import { TransformTrait } from "@spawnite/engine/core";
import { LifeMachine, ReadinessMachine } from "./life";
import { InRingTrait, type SiegeStateTrait } from "./traits";
import { isConnected, queryWardens } from "./wardens";
import { isInReadyRing, isReadyRingOpen, startWithoutSeconds } from "./waves";

//  How the wardens in a room start a run together, before the first, after
//  each end, and at dawn into Endless, and end a breather early: stepping into the lit ring by the fire readies a warden
//  and stepping out cancels it, and her key readies her or cancels it
//  wherever she stands, the last of the two standing. Once every warden is
//  ready the run counts down, and anyone not ready stops it. No timer
//  starts a run on its own. After a while, the ready may start without
//  whoever never comes, as Risk of Rain 2's lobby waits on every player
//  and Tower Defense Simulator's pads show who stands on them.

/** The siege's record as the step reads and writes it. */
type Siege = TraitRecord<typeof SiegeStateTrait>;

/** Whether the room reads the wardens' ready in `phase` at `wave`: while
 *  they gather, at dawn, and in the breather after a wave. The first
 *  breather, before wave 1, asks nothing: the wardens readied for the run
 *  a moment before, so it counts its seconds down whole. */
export function isReadyAsked(phase: Phase | undefined, wave: number) {
    return isReadyRingOpen(phase) && !(phase === "breather" && wave === 0);
}

/** Whether `warden` stands in the ring by the fire, on her feet. */
function isInRing(warden: Entity) {
    const feet = warden.get(TransformTrait);
    return (
        feet !== undefined &&
        !warden.has(LifeMachine.is.down) &&
        isInReadyRing(feet)
    );
}

/** Readies each warden who stepped into the ring since the last step, and
 *  cancels it for each who stepped out whom the ring had readied: one her
 *  key readied stays ready as she walks through it. */
export function watchRing(world: World) {
    for (const warden of queryWardens(world)) {
        const inside = isInRing(warden);
        if (inside === warden.has(InRingTrait)) continue;
        if (inside) {
            warden.add(InRingTrait);
            ReadinessMachine.send(warden, "RING");
        } else {
            warden.remove(InRingTrait);
            ReadinessMachine.send(warden, "LEFT");
        }
    }
}

/** How many wardens whose player is connected are ready, and how many
 *  the rest wait on. */
export function countReady(world: World) {
    let ready = 0;
    let waiting = 0;
    for (const warden of queryWardens(world)) {
        if (!isConnected(warden)) continue;
        if (warden.has(ReadinessMachine.is.ready)) ready++;
        else waiting++;
    }
    return { ready, waiting };
}

/** Whether every warden whose player is connected is ready, one at
 *  least. */
export function isEveryoneReady(world: World) {
    const { ready, waiting } = countReady(world);
    return ready > 0 && waiting === 0;
}

/** Takes every warden's ready back, as a wave opens or a wait begins, and
 *  notes who already stands in the ring, so only a step into it readies
 *  her. */
export function unreadyWardens(world: World) {
    for (const warden of queryWardens(world)) {
        ReadinessMachine.send(warden, "UNREADY");
        if (isInRing(warden)) warden.add(InRingTrait);
        else warden.remove(InRingTrait);
    }
}

/** Whether the ready wardens have waited long enough on the rest to start
 *  without them. */
export function canStartWithout(siege: Pick<Siege, "waitedSeconds">) {
    return siege.waitedSeconds >= startWithoutSeconds;
}

/** One step of the wait for the next run: the ring read, the phase
 *  machine's countdown started once every warden whose player is connected
 *  is ready, and stopped while any is not. Returns whether the run starts
 *  now: the countdown ran out with every warden still ready, or a ready
 *  warden asked to start without the rest once they had waited long
 *  enough. */
export function gatherWardens(
    world: World,
    {
        entity,
        siege,
        deltaSeconds,
    }: { entity: Entity; siege: Siege; deltaSeconds: number },
) {
    watchRing(world);
    const { ready, waiting } = countReady(world);
    const asked = siege.startAsked;
    siege.startAsked = false;
    siege.waitedSeconds =
        ready > 0 && waiting > 0 ? siege.waitedSeconds + deltaSeconds : 0;
    if (asked && canStartWithout(siege)) return true;
    if (ready === 0 || waiting > 0) {
        PhaseMachine.send(entity, "STOP");
        return false;
    }
    //  Started this step, the machine counts it from the next: a countdown
    //  that subtracted each step ran one step over its seconds, so the run
    //  starts on the same step.
    if (PhaseMachine.send(entity, "COUNT")) return false;
    return isCounted(entity);
}

/** Forgets who stood in the ring, as a run starts: the next wait reads it
 *  afresh. */
export function leaveRing(warden: Entity) {
    warden.remove(InRingTrait);
}
