import records from "@spawnite/assets/avatars.json";
import fris from "@spawnite/assets/avatars/fris.vrm?url";
import { registerAvatar, type VrmBody } from "@spawnite/engine";

//  The body every heroine wears, under the name the room streams. The scene
//  imports this module, as it imports the models, so the room registers the
//  same name its pages do.
export const heroineAvatar = "fris";

export const heroineBody: VrmBody = {
    //  JSON types a bone name as a plain string.
    ...(records.fris as Omit<VrmBody, "model">),
    model: fris,
};

registerAvatar(heroineAvatar, heroineBody);
