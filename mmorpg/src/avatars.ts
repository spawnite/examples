import chifa from "@game/assets/avatars/chifa.vrm?url";
import fris from "@game/assets/avatars/fris.vrm?url";
import type { VrmBody } from "@spawnite/engine";

/** Every body the game ships. */
export enum AvatarId {
    Fris = "fris",
    Chifa = "chifa",
}

export const avatars = {
    [AvatarId.Fris]: {
        model: fris,
        scale: 1,
        armSpread: {
            left: { out: 0.27, forward: 0.06 },
            right: { out: 0.1, forward: 0 },
        },
        armColliders: {
            //  Wider than the model's own arm spheres, which follow the skin
            //  rather than the sleeve the skirt has to clear.
            radii: { upperArm: 0.06, lowerArm: 0.055, hand: 0.045 },
            //  VRMSkirtTool names every bone of her skirt's chains this way.
            bonePrefix: "Skirt_",
        },
    },
    //  Her file as delivered mapped the humanoid's hips to a ground-level
    //  `root` bone rather than to the pelvis her legs and spine hang from, so
    //  a clip's hip rotation swung her whole body about her feet. The file
    //  here carries the corrected mapping; a re-export of her brings the sway
    //  back, and no diff shows it.
    [AvatarId.Chifa]: {
        model: chifa,
        scale: 1,
        //  A turn of zero rather than no turn at all: every body's arms come
        //  from the clip and the spread is the angle away from it, so there is
        //  nothing here to leave out. Her own idle already holds her arms
        //  clear of her cape.
        armSpread: {
            left: { out: 0, forward: 0 },
            right: { out: 0, forward: 0 },
        },
        armColliders: {
            //  Her arms, measured off the bones the skin hangs on: a forearm
            //  bare where fris's carries a sleeve.
            radii: { upperArm: 0.06, lowerArm: 0.025, hand: 0.045 },
            //  VRMSpringBoneTool names every bone of her cape's chains this
            //  way, and the centre chain is the bare word.
            bonePrefix: "Cape",
        },
    },
} satisfies Record<AvatarId, VrmBody>;

/** Which of them the heroine wears. */
export const heroAvatarId = AvatarId.Fris;
