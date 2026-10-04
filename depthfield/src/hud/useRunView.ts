import type { World } from "koota";
import { useWorld } from "koota/react";
import { useEffect, useState } from "react";
import type { RunState } from "../rules/traits";
import { findRun } from "../views/findRun";

/** Milliseconds between two reads: the source redrew its readout ten times
 *  a second. */
const readEveryMilliseconds = 100;

/** What `read` makes of the run, read ten times a second: the rules write
 *  the run in place, which notifies no subscriber. A new value renders only
 *  where its JSON differs. */
export function useRunView<Value>(
    read: (run: RunState, world: World) => Value,
): Value | undefined {
    const world = useWorld();
    const [value, setValue] = useState<Value | undefined>(() => {
        const run = findRun(world);
        return run ? read(run, world) : undefined;
    });
    useEffect(() => {
        let shown = JSON.stringify(value);
        const timer = setInterval(() => {
            const run = findRun(world);
            const next = run ? read(run, world) : undefined;
            const text = JSON.stringify(next);
            if (text === shown) return;
            shown = text;
            setValue(next);
        }, readEveryMilliseconds);
        return () => clearInterval(timer);
        //  `read` is a fresh function each render; the first one reads the
        //  same fields as every later one.
        // eslint-disable-next-line @eslint-react/exhaustive-deps
    }, [world]);
    return value;
}
