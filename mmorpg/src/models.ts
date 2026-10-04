import manifest from "@spawnite/assets/models.json";
import wand from "@spawnite/assets/models/mmorpg/wand-crescent.glb?url";
import wolf from "@spawnite/assets/models/mmorpg/wolf.glb?url";
import { registerModel } from "@spawnite/engine";

//  Every model the meadow names, under the name its entities and items
//  carry, with the size the asset library measured it at. The Meadow
//  imports this file, so `spawnite simulate` and a room register the same
//  names a page does.
registerModel("crescent-wand", {
    ...manifest["wand-crescent"],
    path: wand,
});
registerModel("wolf", { ...manifest.wolf, path: wolf });

export { wand as wandUrl };
