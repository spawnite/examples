The potion, which the player sees as Potion of healing, is the game's one item. Using it heals 30 health and uses the potion up, and the next potion waits one second. A stack holds at most 10.

`src/items.ts` registers it, and every scene imports that file, so a bag, loot or a save can name it. No scene places a potion yet.
