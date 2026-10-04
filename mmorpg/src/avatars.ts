import records from "@spawnite/assets/avatars.json";
import chifa from "@spawnite/assets/avatars/chifa.vrm?url";
import fris from "@spawnite/assets/avatars/fris.vrm?url";
import type { VrmBody } from "@spawnite/engine";

/** Every body the game ships. */
export enum AvatarId {
    Fris = "fris",
    Chifa = "chifa",
}

//  JSON types a bone name as a plain string.
const shipped = records as Record<AvatarId, Omit<VrmBody, "model">>;

export const avatars = {
    [AvatarId.Fris]: { ...shipped.fris, name: AvatarId.Fris, model: fris },
    [AvatarId.Chifa]: { ...shipped.chifa, name: AvatarId.Chifa, model: chifa },
} satisfies Record<AvatarId, VrmBody>;

/** Which of them the heroine wears. */
export const heroAvatarId = AvatarId.Fris;
