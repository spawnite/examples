import { controls, dragAndDrop, type PluginList } from "@spawnite/engine";
import { combat } from "./combat/systems";
import { hudPlugin } from "./hud/hud.plugin";

/** The plugins every scene's page runs: Space freed from the engine's jump
 *  for the dodge, the fight, dragging potions and skills onto the paw, and
 *  the page's keys. */
export const plugins: PluginList = [
    controls({ keys: { jump: [] } }),
    combat,
    dragAndDrop(),
    hudPlugin,
];
