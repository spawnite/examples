import type { World } from "koota";
import { ReadinessMachine } from "./life";
import { PhaseMachine } from "./phase";
import {
    readMessages,
    type DeliveredMessage,
    type MessageHandle,
} from "@spawnite/engine/core";
import { chooseElementCard, pickCard } from "./cards";
import { canStartWithout } from "./gathering";
import { isGunId } from "./guns";
import {
    buyCardInBreather,
    buyFire,
    buyGun,
    buyReroll,
    upgradeGun,
} from "./shop";
import { siegePlugin } from "./siege.plugin";
import { SiegeStateTrait, WardenTrait } from "./traits";

//  What a page tells the room besides where she walks and what she shoots:
//  each a message the siege plugin declares, which the room checks and the
//  siege reads as her word. Read in the order they came, whatever their
//  names, as the room handed them over.

/** What a siege message carries: numbers, text and flags, never an
 *  entity, so one payload is what a page sends and what the wire carries. */
export type SignalPayload = Record<string, number | string | boolean>;

/** A word a page or a bot sends: one of the siege plugin's messages, with
 *  its payload. */
export interface Signal {
    message: MessageHandle;
    payload: SignalPayload;
}

/** Takes a word that buys something: whether it buys is the shop's to
 *  say. True where `message` is one. */
function handlePurchase(
    world: World,
    { hero, name, payload }: DeliveredMessage,
) {
    const { messages } = siegePlugin;
    if (name === messages.buyCard.name) {
        //  The room checked the slot against the message's fields.
        if (typeof payload.slot === "number")
            buyCardInBreather(world, { shooter: hero, slot: payload.slot });
    } else if (name === messages.reroll.name) buyReroll(world, hero);
    else if (name === messages.upgrade.name) upgradeGun(world, hero);
    else if (name === messages.feed.name) buyFire(world, hero);
    else if (name === messages.buyGun.name) {
        const { gun } = payload;
        if (typeof gun === "string" && isGunId(gun)) buyGun(world, hero, gun);
    } else return false;
    return true;
}

/** Takes `message` from its hero as her word: whether it is one the siege
 *  reads now is the siege's to say. */
export function readSignal(world: World, message: DeliveredMessage) {
    const { hero: shooter, name, payload } = message;
    const siege = world.queryFirst(SiegeStateTrait);
    const state = siege?.get(SiegeStateTrait);
    const survivor = shooter.get(WardenTrait);
    if (!siege || !state || !survivor) return;
    const { is } = PhaseMachine;
    const { messages } = siegePlugin;
    if (handlePurchase(world, message)) return;
    //  The wardens gather for the next run, or at dawn for Endless.
    const gathering =
        siege.has(is.waiting) || siege.has(is.over) || siege.has(is.dawn);
    //  In a breather, ready is for the next wave.
    const readying = gathering || siege.has(is.breather);
    const ready = name === messages.ready.name;
    if (readying && (ready || name === messages.unready.name))
        ReadinessMachine.send(shooter, ready ? "READY" : "UNREADY");
    if (
        gathering &&
        name === messages.startWithout.name &&
        shooter.has(ReadinessMachine.is.ready) &&
        canStartWithout(state)
    )
        siege.set(SiegeStateTrait, { startAsked: true });
    //  A late joiner takes the cards she missed whatever the phase; the
    //  wardens gathering for a run pick their element, and may change it.
    const { slot } = payload;
    if (name !== messages.pick.name || typeof slot !== "number") return;
    if (survivor.catchUp > 0 || siege.has(is.breather)) pickCard(shooter, slot);
    else if (siege.has(is.waiting) || siege.has(is.over))
        chooseElementCard(shooter, slot);
}

/** Reads each signal the room took since the last step as its sender's
 *  word. */
export function readSignals(world: World) {
    for (const message of readMessages(world)) readSignal(world, message);
}
