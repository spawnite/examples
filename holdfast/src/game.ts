import { defineRoom, weapons, type PluginList } from "@spawnite/engine/core";
import { siegePlugin } from "./siege/siege.plugin";

/** The plugins the room and every page list: the weapons the room takes
 *  the wardens' shots from, and the siege, whose systems run on the room
 *  alone. */
export const plugins: PluginList = [weapons(), siegePlugin];

/** The room: four wardens hold the circle, at the platform's 30 sends a
 *  second. */
export const room = defineRoom({ maxPlayers: 4 });
