import type { World } from "koota";
import { findPlayerHero, useRoom } from "@spawnite/engine";

/** Tells the room her word `name`, a signal with no payload. Nothing is
 *  sent before her hero stands in the world. */
export function sendSignal(world: World, name: string) {
    if (!findPlayerHero(world)) return;
    useRoom.getState().sendMessage({ name, payload: {} });
}
