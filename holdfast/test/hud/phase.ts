import type { Entity } from "koota";
import { writeStateTags } from "@spawnite/engine";
import { PhaseTrait, type Phase } from "../../src/siege/phase";

//  The run's phase machine as the stream writes it on a page: the record,
//  then the tags from it.

/** The state each phase opens on. */
const opening = {
    waiting: { waiting: "gathering" },
    breather: { breather: "resting" },
    fight: { fight: "fighting" },
    over: { over: "gathering" },
    dawn: { dawn: "gathering" },
} as const;

/** Puts the run on `siege` in `phase`, and returns `siege`. */
export function showPhase(siege: Entity, phase: Phase) {
    if (!siege.has(PhaseTrait)) siege.add(PhaseTrait);
    siege.set(PhaseTrait, { state: opening[phase] });
    writeStateTags(siege, PhaseTrait);
    return siege;
}
