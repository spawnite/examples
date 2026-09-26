import { registerModel } from "@spawnite/engine";
import models from "./models.json";

//  Every model file the example serves, under its id, and its own names
//  for them. The kit's tall tree, a metre high, is tall enough that she
//  cannot step onto it, where the kit's boulder is not.
for (const [id, model] of Object.entries(models)) registerModel(id, model);
registerModel("tree", models["tree-tall"]);
