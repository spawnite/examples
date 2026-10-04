import { useEffect } from "react";
import { useWorld } from "koota/react";
import { findPlayerHero } from "@spawnite/engine";
import { ArrowTrait, HeroCombatTrait } from "../combat/traits";
import { LootTrait } from "../items/traits";
import { ModelFalls } from "./ModelBody";
import { Monster } from "./Monster";
import { SlimePops } from "./SlimePops";
import { laySpawns, markSlain, useSpawns, type SpawnArea } from "./spawns";

/** Lays out the areas' slots as it mounts and keeps a monster in each slot
 *  that is up: a respawn is a new Entity, keyed by the slot's generation.
 *  The slimes that fall pop here, after their Entities are gone. */
export function Spawner({ areas }: { areas: SpawnArea[] }) {
    const slots = useSpawns((state) => state.slots);

    useEffect(() => laySpawns(areas), [areas]);

    //  A development playtest's handle on the wilds: waking a boss without a
    //  dozen kills first, and reading the hero's fight. Not in a build.
    const world = useWorld();
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        Object.assign(window, {
            bladeboundSpawns: { useSpawns, markSlain },
            bladeboundHero: () => findPlayerHero(world)?.get(HeroCombatTrait),
            bladeboundArrows: () =>
                world
                    .query(ArrowTrait)
                    .map((arrow) => ({ ...arrow.get(ArrowTrait)! })),
            bladeboundLoot: () =>
                world
                    .query(LootTrait)
                    .map((piece) => ({ ...piece.get(LootTrait)! })),
        });
    }, [world]);

    return (
        <>
            {slots.map(
                (slot) =>
                    slot.alive && (
                        <Monster
                            key={`${slot.id}:${slot.generation}`}
                            slot={slot}
                        />
                    ),
            )}
            <SlimePops />
            <ModelFalls />
        </>
    );
}
