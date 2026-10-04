import { defineSave } from "@spawnite/engine";

/** What the player's save keeps, which `<Game save>` takes: the engine's
 *  saves of where she stands and her health, her stats, mana, bag and what
 *  she wears, and the loot she took. The game keeps no state of its own
 *  beside them, so it declares no schema, read or restore. The engine restores each as the
 *  game loads and writes them on its own schedule. */
export const save = defineSave({
    include: ["hero", "stats", "resources", "inventory", "loot"],
});
