import type { World } from "koota";
import {
    findPlayerHero,
    sendMessage,
    type HandlePayload,
    type MessageHandle,
} from "@spawnite/engine";

/** Tells the room her word, one of the siege plugin's messages. Nothing
 *  is sent before her hero stands in the world. */
export function sendSignal<Handle extends MessageHandle>(
    world: World,
    message: Handle,
    payload: HandlePayload<Handle>,
) {
    if (!findPlayerHero(world)) return;
    sendMessage(world, message, payload);
}
