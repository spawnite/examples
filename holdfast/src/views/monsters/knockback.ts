import type { Entity } from "koota";
import { GunId } from "../../siege/guns";
import { readShotLook, type Knock } from "../../weapons/looks";
import { measureProgress } from "./motion";

//  How far a hit pushes a monster's body back on this page: by the weight
//  of the gun that dealt it, which the room's shot results name. The
//  results and the monster's health land on the page together, so the
//  results note each hit's push and the monster's view takes the heaviest
//  when it draws the hit.

/** A blaster bolt's push: for a hit no shot named, such as a burn's
 *  tick, and for every hit on a colossus. */
export const lightKnock = readShotLook(GunId.Blaster).knock;

/** The heaviest push each monster's view has yet to draw, by the monster. */
const pending = new Map<Entity, Knock>();

/** Notes a hit on `monster` that pushes by `knock`, which its view draws
 *  with the next hit it sees, unless a heavier one comes first. */
export function noteKnock(monster: Entity, knock: Knock) {
    const held = pending.get(monster);
    if (!held || knock.metres > held.metres) pending.set(monster, knock);
}

/** The push for the hit `monster`'s view is drawing: the heaviest noted
 *  since its last, or a blaster bolt's. */
export function takeKnock(monster: Entity): Knock {
    const knock = pending.get(monster) ?? lightKnock;
    pending.delete(monster);
    return knock;
}

/** Drops a push noted for `monster`, whose view is going. */
export function forgetKnock(monster: Entity) {
    pending.delete(monster);
}

/** Metres a hit `elapsed` seconds old pushes the body back: the whole push
 *  at once, easing home over its seconds. */
export function measureKnock(elapsed: number, { metres, seconds }: Knock) {
    const left = 1 - measureProgress(elapsed, seconds);
    return metres * left * left;
}
