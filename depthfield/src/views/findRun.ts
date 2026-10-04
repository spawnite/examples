import type { World } from "koota";
import { RunTrait, type RunState } from "../rules/traits";

/** The run's state, for a view: none before the field spawns it. A view
 *  never spawns it, as the rules' `readRun` would. */
export function findRun(world: World): RunState | undefined {
    return world.queryFirst(RunTrait)?.get(RunTrait);
}
