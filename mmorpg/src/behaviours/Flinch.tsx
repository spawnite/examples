import { trait } from "koota";
import { defineBehaviour, RunContext, useBehaviour } from "@spawnite/engine";

/** A character that plays `clip` once on each hit it survives. The
 *  game's `flinchOnHit` system runs it. */
export const FlinchTrait = trait({ clip: "" });

export const FlinchBehaviour = defineBehaviour({
    name: "flinch",
    trait: FlinchTrait,
    runsOn: RunContext.Server,
    wiki: "/behaviours/flinch/",
    source: "src/behaviours/Flinch.tsx",
    description: "Plays a hit clip once on each hit its character survives.",
});

export interface FlinchProps {
    /** The clip its model plays on a hit, as its file names it. */
    clip: string;
}

export function Flinch({ clip }: FlinchProps) {
    useBehaviour(FlinchBehaviour, { clip });

    return null;
}
