import fris from "@game/assets/avatars/fris.vrm?url";
import { registerAvatar, type VrmBody } from "@spawnite/engine";

//  The body every heroine wears, under the name the room streams. The scene
//  imports this module, as it imports the models, so the room registers the
//  same name its pages do. The record is the mmorpg's own for the same file.
export const heroineAvatar = "fris";

export const heroineBody = {
    model: fris,
    scale: 1,
    armSpread: {
        left: { out: 0.27, forward: 0.06 },
        right: { out: 0.1, forward: 0 },
    },
    armColliders: {
        radii: { upperArm: 0.06, lowerArm: 0.055, hand: 0.045 },
        bonePrefix: "Skirt_",
    },
} satisfies VrmBody;

registerAvatar(heroineAvatar, heroineBody);
