import { useQueryFirst, useTrait, useWorld } from "koota/react";
import { useEffect } from "react";
import { Authority, Hero, useCursor } from "@spawnite/engine";
import { readyWeapon } from "../siege/signals";
import { SiegePhase, SiegeTrait, WardenTrait } from "../siege/traits";
import { sendSignal } from "./signal";

/** Takes her place for the first run the moment she presses Play: the
 *  press that captures the cursor is the one that says she is here, so a
 *  run never starts while she is still loading or reading the menu. */
export function TakePlace() {
    const world = useWorld();
    const captured = useCursor((state) => state.captured);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const survivor = useTrait(useQueryFirst(Hero, Authority), WardenTrait);
    const waiting = siege?.phase === SiegePhase.Waiting;
    const ready = survivor?.ready ?? true;

    //  Sent again each second until the room has it: a page drops a
    //  message while its socket opens or rejoins.
    useEffect(() => {
        if (!captured || !waiting || ready) return;
        sendSignal(world, readyWeapon);
        const timer = setInterval(() => sendSignal(world, readyWeapon), 1000);
        return () => clearInterval(timer);
    }, [world, captured, waiting, ready]);

    return null;
}
