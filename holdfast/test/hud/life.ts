import type { Entity } from "koota";
import { writeStateTags } from "@spawnite/engine";
import { LifeTrait, ReadinessTrait } from "../../src/siege/life";

//  A warden's machines as the stream writes them on a page: the record,
//  then the tags from it.

/** Lays `warden` down, or stands her up. */
export function showDown(warden: Entity, down: boolean) {
    if (!warden.has(LifeTrait)) warden.add(LifeTrait);
    warden.set(LifeTrait, { state: down ? { down: "lying" } : "standing" });
    writeStateTags(warden, LifeTrait);
}

/** Readies `warden` by her key, or takes it back. */
export function showReady(warden: Entity, ready: boolean) {
    if (!warden.has(ReadinessTrait)) warden.add(ReadinessTrait);
    warden.set(ReadinessTrait, {
        state: ready ? { ready: "key" } : "unready",
    });
    writeStateTags(warden, ReadinessTrait);
}
