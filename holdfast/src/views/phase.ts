import { useMachineState } from "@spawnite/engine";
import { useQueryFirst } from "koota/react";
import { PhaseMachine, PhaseTrait, type Phase } from "../siege/phase";

/** The phase the run is in on this page, from the phase machine's record,
 *  which follows the stream: undefined before the room's first word. */
export function usePhase(): Phase | undefined {
    return useMachineState(PhaseMachine, useQueryFirst(PhaseTrait));
}
