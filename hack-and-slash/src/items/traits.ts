import { trait } from "koota";

/** Loot on the ground: gold, or an item by its place in `itemIds`, and
 *  how many of it, as drops that fell together pile up. It pops out of the
 *  monster, lands, and waits for the hero to walk over it. */
export const LootTrait = trait({
    x: 0,
    y: 0,
    z: 0,
    /** Its place in `itemIds`, or -1 for gold. */
    item: -1,
    gold: 0,
    /** How many of the item lie in this pile. */
    count: 1,
    /** The rarity it dropped at, as its place in `rarities`. */
    rarity: 0,
    /** Metres a second it flies out at while it pops. */
    popX: 0,
    popZ: 0,
    age: 0,
});

export const goldLoot = -1;
