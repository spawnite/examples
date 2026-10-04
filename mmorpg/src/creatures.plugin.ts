import { createQuery, type World } from "koota";
import {
    DamagedTrait,
    definePlugin,
    DownedTrait,
    HealthTrait,
    NetworkEntitiesTrait,
    playClip,
} from "@spawnite/engine/core";
import { FlinchTrait } from "./behaviours/Flinch";

const flinchers = createQuery(FlinchTrait, DamagedTrait, HealthTrait);

/** Plays each flinching character's hit clip on a hit it survived this
 *  step. Server: a page fed from a room leaves it to the room. */
export function flinchOnHit(world: World) {
    if (world.has(NetworkEntitiesTrait)) return;
    for (const entity of world.query(flinchers)) {
        const health = entity.get(HealthTrait);
        const clip = entity.get(FlinchTrait)?.clip;
        if (clip && health && health.current > 0 && !entity.has(DownedTrait))
            playClip(entity, clip);
    }
}

/** Hits of the characters other than the hero, after the engine's rules:
 *  a hit a bolt landed this step flinches its victim. */
export const creatures = definePlugin({
    name: "creatures",
    description: "The flinch on a hit.",
    systems: {
        rules: {
            flinchOnHit: {
                system: flinchOnHit,
                description:
                    "Plays each flinching character's hit clip on a hit it survived.",
            },
        },
    },
});
