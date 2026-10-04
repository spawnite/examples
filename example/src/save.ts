import { defineSave } from "@spawnite/engine/core";
import { z } from "@spawnite/schema";
import { readRunsWon, setRunsWon } from "./runs";

/** What the player's save keeps: the engine's save of where her hero
 *  stands and her health, and the runs she has won. `<Game save>` takes
 *  it, and each scene's file exports it for the room. Raise `version` and
 *  add a step to `migrations` when the shape of `schema` changes. */
export const save = defineSave({
    include: ["hero"],
    version: 1,
    schema: z.object({ runsWon: z.int().check(z.nonnegative()) }),
    read: ({ hero }) => ({ runsWon: readRunsWon(hero) }),
    restore: ({ hero }, saved) => setRunsWon(hero, saved.runsWon),
});
