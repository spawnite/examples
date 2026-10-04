The crescent wand, which the player sees as Crescent wand, is the mage's weapon. It is worn in the main hand and grants Arcane Bolt while it is worn. Taking it off takes the bolt off the action bar, and cancels a bolt the player is winding up.

The player starts with it worn. `src/mage/MageKit.tsx` puts it in her main hand whenever she holds none, worn or in her bag, as in a new game. A wand she takes off stays in her bag, and she wears it again from the bag.

`src/items.ts` registers it, with the model `crescent-wand` from the asset library's `wand-crescent.glb`, 35 cm long with its pommel at the file's origin. Her right hand holds it through `HeldItem`, fixed in the hand: the middle of its leather grip sits in the hole her fist closes round, across her palm, with the orb out past her thumb. Every turn of her wrist turns it, so it hangs by her leg at rest, swings with her arm at a run, and sweeps up and thrusts forward with the cast clip. Her fingers close round it in the engine's grip.

`src/mage/CrescentWand.tsx` draws it. Its crescent glows in the bolt's arcane blue, softly at rest and brighter while the charge plays, which the look's bloom picks up. An `EnergyOrbMaterial` orb, standing in a `Billboard`, takes the place of the model's own orb, and the charge's runes gather there.
