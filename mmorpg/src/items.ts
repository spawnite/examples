import { EquipmentSlot, maxHealthStat, registerItem } from "@spawnite/engine";
import { arcaneBolt } from "./mage/abilities";
import "./models";

//  Every item the game holds, each registered once by name: a bag, loot
//  and a save name an item by the name it is registered under here, and
//  what it does is data on its definition. The inventory page of the wiki
//  lists what a definition can say.
//
//  The Meadow imports this file: `spawnite simulate` loads a scene and what it
//  imports, never the app, so an item a scene names is registered only
//  where the scene imports it.
//
//  Each display name is a word or two: the bag's buttons show it, and a
//  ui Button holds no more.
registerItem("potion", {
    displayName: "Potion",
    color: "crimson",
    maxStack: 10,
    use: {
        effects: [{ type: "heal", amount: 40 }],
        consume: true,
        cooldownSeconds: 2,
    },
});

//  Her max health is the one stat the hero has.
registerItem("ring-of-vitality", {
    displayName: "Ring",
    color: "gold",
    equip: { slot: "ring", modifiers: { [maxHealthStat]: { flat: 25 } } },
});

//  The mage's wand, which she starts with in her hand: Arcane Bolt is
//  hers while she wears it, and taking it off takes the bolt away.
registerItem("crescent-wand", {
    displayName: "Crescent wand",
    model: "crescent-wand",
    equip: { slot: EquipmentSlot.MainHand, abilities: [arcaneBolt] },
});
