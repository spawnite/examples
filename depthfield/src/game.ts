import type { PluginList } from "@spawnite/engine/core";
import { field } from "./rules/field.plugin";

/** The plugins depthfield runs: the run's own, on the engine's building
 *  blocks alone. */
export const plugins: PluginList = [field];
