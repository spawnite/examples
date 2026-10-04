import { defineSave } from "@spawnite/engine";
import { z } from "@spawnite/schema";
import { CareerTrait, recentRunsKept } from "./siege/traits";

/** What Holdfast keeps of a player between runs: her career, the XP she
 *  earned, the runs she played, the nights she won and the last runs
 *  counted, on her warden. The room is its only writer, and the level is
 *  worked out from the XP. A run itself is never kept: a room's next run
 *  starts at dusk. */
export const save = defineSave({
    version: 1,
    schema: z.object({
        xp: z.int().check(z.nonnegative()),
        runs: z.int().check(z.nonnegative()),
        dawns: z.int().check(z.nonnegative()),
        recentRuns: z.array(z.int()).check(z.maxLength(recentRunsKept)),
    }),
    read: ({ hero }) => {
        const career = hero.get(CareerTrait);
        return {
            xp: career?.xp ?? 0,
            runs: career?.runs ?? 0,
            dawns: career?.dawns ?? 0,
            recentRuns: [...(career?.recentRuns ?? [])],
        };
    },
    restore: ({ hero }, saved) => {
        if (hero.has(CareerTrait)) hero.set(CareerTrait, saved);
        else hero.add(CareerTrait(saved));
    },
});
