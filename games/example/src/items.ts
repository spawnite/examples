import { registerItem } from "@spawnite/engine";

//  Every item the game holds, each registered once by name: a bag, loot
//  and a save name an item by the name it is registered under here, and
//  what it does is data on its definition. The inventory page of the wiki
//  lists what a definition can say.
//
//  Each scene imports this file, as Tree.tsx imports ../models: `game
//  simulate` and a room load a scene and what it imports, never the app,
//  so an item a scene names is registered only where the scene imports it.
registerItem("potion", {
    displayName: "Potion of healing",
    maxStack: 10,
    use: {
        effects: [{ type: "heal", amount: 30 }],
        consume: true,
        cooldownSeconds: 1,
    },
});
