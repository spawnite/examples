import { onTestFinished } from "vitest";
import {
    createGameWorld,
    NetworkEntitiesTrait,
    trackMovementKeys,
} from "@spawnite/engine";
import { plugins } from "../../src/game";

/** Her page's world in a room: made from the game's plugins, so it knows
 *  the siege's messages and binds its keys, and fed from the room, so a
 *  screen's send goes to `useRoom`'s `sendMessage`. Its keys reach the
 *  screens through the engine's listener, as `Game` installs it, until the
 *  test ends. */
export function createPageWorld() {
    const world = createGameWorld(plugins);
    world.add(NetworkEntitiesTrait);
    onTestFinished(trackMovementKeys(window, world));
    return world;
}
