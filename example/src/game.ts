import { inventory, round, type PluginList } from "@spawnite/engine/core";
import { runs } from "./runs";

/** The plugins every scene's page and the room run: the bag for the
 *  potion, the round the Run scene plays, and the count of runs won. */
export const plugins: PluginList = [inventory(), round(), runs];
