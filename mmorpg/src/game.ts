import {
    abilities,
    inventory,
    npc,
    weapons,
    type PluginList,
} from "@spawnite/engine/core";
import { creatures } from "./creatures.plugin";

/** The plugins the meadow runs: the mage's spells and the bolts they
 *  fly, Mira's dialog, the bag and the wand, and the creatures'
 *  flinch. */
export const plugins: PluginList = [
    weapons(),
    abilities(),
    npc(),
    inventory(),
    creatures,
];
