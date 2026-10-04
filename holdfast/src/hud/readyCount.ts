import { useWorld } from "koota/react";
import { useCallback, useSyncExternalStore } from "react";
import { DisconnectedTrait } from "@spawnite/engine";
import { countReady } from "../siege/gathering";
import { ReadinessMachine } from "../siege/life";
import { WardenTrait } from "../siege/traits";

//  How many of the wardens in the room are ready: the shop bar's "2/3
//  ready" beside Ready, counted as the room counts them for the start.

export interface ReadyCount {
    ready: number;
    wardens: number;
}

/** The ready count, read again as any warden readies, joins, leaves or
 *  drops. Koota tells a removal before the trait goes, so a removal reads
 *  the world once the removal is done. */
export function useReadyCount(): ReadyCount {
    const world = useWorld();
    const subscribe = useCallback(
        (notify: () => void) => {
            const notifyAfterRemoval = () => queueMicrotask(notify);
            const removals = [
                world.onAdd(ReadinessMachine.is.ready, notify),
                world.onRemove(ReadinessMachine.is.ready, notifyAfterRemoval),
                world.onAdd(WardenTrait, notify),
                world.onRemove(WardenTrait, notifyAfterRemoval),
                world.onAdd(DisconnectedTrait, notify),
                world.onRemove(DisconnectedTrait, notifyAfterRemoval),
            ];
            return () => {
                for (const remove of removals) remove();
            };
        },
        [world],
    );
    const line = useSyncExternalStore(subscribe, () => {
        const { ready, waiting } = countReady(world);
        return `${ready}/${ready + waiting}`;
    });
    const [ready, wardens] = line.split("/").map(Number);
    return { ready, wardens };
}
