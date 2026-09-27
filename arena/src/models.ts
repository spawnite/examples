import { registerModel } from "@spawnite/engine";
import models from "./models.json";

//  Every model file the arena serves, under its id, and the names the
//  room's entities carry in their Model trait. The scene imports this
//  module, so the room registers the same entries a page does and cuts a
//  walker to the size the page draws. The kit holds no creature and no
//  coin, so its boulder stands in for the monster and its flat stone for
//  the coin and the sling's stone.
for (const [id, model] of Object.entries(models)) registerModel(id, model);
registerModel("monster", models["rock-boulder"]);
registerModel("coin", models["rock-flat"]);
registerModel("stone", models["rock-flat"]);
