import { maxHealthStat, registerItem } from "@spawnite/engine";

//  Every item the game holds, each registered once by name: a bag, loot
//  and a save name an item by the name it is registered under here, and
//  what it does is data on its definition. The inventory page of the wiki
//  lists what a definition can say.
//
//  The Meadow imports this file: `game simulate` loads a scene and what it
//  imports, never the app, so an item a scene names is registered only
//  where the scene imports it.
//
//  Each display name is one word: the bag's buttons show it, and a ui
//  Button holds a word or two.
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
