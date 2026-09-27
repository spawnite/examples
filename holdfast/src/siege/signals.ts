import type { Entity, World } from "koota";
import {
    readMessages,
    registerMessage,
    type Disposer,
    type MessageSettings,
} from "@spawnite/engine/core";
import { pickCard } from "./cards";
import { SiegePhase, SiegeState, WardenTrait } from "./traits";

//  What a page tells the room besides where she walks and what she shoots:
//  each a message with no payload, which the room checks and the siege
//  reads as her word.

/** "I am here": the Play menu's press before the first run, and the end
 *  screen's "go again". */
export const readyWeapon = "ready";
/** "I take this card", one per slot of the offer. */
export const pickWeapons = ["pick-1", "pick-2", "pick-3"];

/** A signal carries nothing but its name, a few a second at most. */
const signalSettings: MessageSettings = { shape: {}, messagesPerSecond: 4 };

/** Lets every page send each signal; the return takes them away. */
export function registerSignals(world: World): Disposer {
    const removals = [readyWeapon, ...pickWeapons].map((name) =>
        registerMessage(world, name, signalSettings),
    );
    return () => {
        for (const remove of removals) remove();
    };
}

/** A signal: who sent it, and which. */
interface Signal {
    shooter: Entity;
    name: string;
}

/** Takes `name` from `shooter` as her word: whether it is one the siege
 *  reads now is the siege's to say. */
export function readSignal(world: World, { shooter, name }: Signal) {
    const phase = world.queryFirst(SiegeState)?.get(SiegeState)?.phase;
    const waiting = phase === SiegePhase.Waiting || phase === SiegePhase.Over;
    if (name === readyWeapon && waiting)
        shooter.set(WardenTrait, { ready: true });
    const slot = pickWeapons.indexOf(name);
    if (slot >= 0 && phase === SiegePhase.Breather) pickCard(shooter, slot);
}

/** Reads each signal the room took since the last step as its sender's
 *  word. */
export function readSignals(world: World) {
    for (const { hero, name } of readMessages(world))
        readSignal(world, { shooter: hero, name });
}
