import { useWorld } from "koota/react";
import { useEffect } from "react";
import { filterChaseTargets } from "@spawnite/engine";
import { registerSignals } from "./signals";
import { isWardenStanding, placeWardenSpawns } from "./wardens";

/** What the room holds the siege to beside its weapon, on the room's world
 *  and every page's alike: the signals a page sends, the places the
 *  wardens spawn at, and the wardens the monsters chase. */
export function SiegeRules() {
    const world = useWorld();
    useEffect(() => {
        const removals = [
            registerSignals(world),
            placeWardenSpawns(world),
            filterChaseTargets(world, (hero) => isWardenStanding(world, hero)),
        ];
        return () => {
            for (const remove of removals) remove();
        };
    }, [world]);
    return null;
}
