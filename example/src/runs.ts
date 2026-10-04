import { Not, trait, type Entity, type World } from "koota";
import {
    definePlugin,
    engineSystems,
    HeroTrait,
    isRemote,
    RoundMachine,
    RoundState,
    RoundTrait,
} from "@spawnite/engine/core";

//  The runs the player has won, on her hero, which her save keeps: one
//  more each time a round of the Run scene is won.

/** The runs her hero has won. */
const RunsWonTrait = trait({ runs: 0 });

/** Marks a won round once it is counted, so it counts once. */
const CountedTrait = trait();

/** The runs `hero` has won: none before her first. */
export function readRunsWon(hero: Entity): number {
    return hero.get(RunsWonTrait)?.runs ?? 0;
}

/** Sets the runs `hero` has won. */
export function setRunsWon(hero: Entity, runs: number) {
    if (hero.has(RunsWonTrait)) hero.set(RunsWonTrait, { runs });
    else hero.add(RunsWonTrait({ runs }));
}

/** Counts each round newly won, once, for every hero this world owns: a
 *  room's heroes in a room, her own on a page that plays alone. */
export function countRunsWon(world: World) {
    for (const round of world.query(RoundTrait, Not(CountedTrait))) {
        if (RoundMachine.read(round).value !== RoundState.Won) continue;
        round.add(CountedTrait);
        for (const hero of world.query(HeroTrait))
            //  At most the largest whole number a save holds.
            if (!isRemote(hero))
                setRunsWon(
                    hero,
                    Math.min(readRunsWon(hero) + 1, Number.MAX_SAFE_INTEGER),
                );
    }
}

/** The count of runs won, after the round has scored the step. */
export const runs = definePlugin({
    name: "runs",
    description: "Counts each run the player wins, which her save keeps.",
    systems: {
        rules: {
            countRunsWon: {
                system: countRunsWon,
                after: [engineSystems.round.advance],
                description:
                    "Adds one to each hero's runs won as a round is won.",
            },
        },
    },
});
