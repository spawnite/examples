import { useEffect } from "react";
import { useQueryFirst, useTrait } from "koota/react";
import { useHeadless } from "@spawnite/engine";
import { SiegeTrait } from "../siege/traits";
import { usePhase } from "./phase";

//  Each phase of the run as a mark on the page's performance timeline,
//  `phase` with the phase and the wave, such as "fight 3", so
//  `spawnite play profile` reads a slow frame by the part of the run it fell
//  in: the gathering, a breather or a wave. One mark a phase.

function Marks() {
    const phase = usePhase();
    const wave = useTrait(useQueryFirst(SiegeTrait), SiegeTrait)?.wave;
    useEffect(() => {
        if (phase !== undefined)
            performance.mark("phase", { detail: `${phase} ${wave ?? 0}` });
    }, [phase, wave]);
    return null;
}

/** Marks the run's phases on the page; the room marks nothing. */
export function PhaseMarks() {
    return useHeadless() ? null : <Marks />;
}
