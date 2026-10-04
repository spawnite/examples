import type { Entity, Trait } from "koota";
import { useWorld } from "koota/react";
import { useEffect, useMemo, useRef } from "react";
import { useHeadless } from "@spawnite/engine";

//  The engine's useEvent calls back as a step adds an event, so a record a
//  later emit in the same step appends to the event's list never reaches
//  it: the second shot, fall or spark burst of a step. This hears the list
//  as each emit writes it, when the step adds the event and each time a
//  later emit changes it, and hears each record once, however many steps
//  run before the next frame.
//  ponytail: the game's own; an engine listener that hears each record of
//  a list event would lift it (the pull request's engine gaps).

/** Calls `heard` with each record `read` finds on `event`'s holders that
 *  it has not heard, however many one step appends, and the holder. */
export function useEventRecords<Item>(
    event: Trait,
    read: (entity: Entity) => readonly Item[] | undefined,
    heard: (record: Item, holder: Entity) => void,
) {
    const world = useWorld();
    const headless = useHeadless();
    const readRef = useRef(read);
    const heardRef = useRef(heard);
    readRef.current = read;
    heardRef.current = heard;
    //  How many of each list's records were heard, by the list itself: a
    //  new event starts a new list.
    const counted = useMemo(() => new WeakMap<object, number>(), []);
    useEffect(() => {
        if (headless) return;
        const hear = (entity: Entity) => {
            const list = readRef.current(entity);
            if (!list) return;
            const from = counted.get(list) ?? 0;
            counted.set(list, list.length);
            for (let index = from; index < list.length; index++)
                heardRef.current(list[index], entity);
        };
        const stopAdd = world.onAdd(event, hear);
        const stopChange = world.onChange(event, hear);
        return () => {
            stopAdd();
            stopChange();
        };
    }, [world, event, headless, counted]);
}
