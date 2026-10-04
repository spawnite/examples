import { useEffect, useState } from "react";

//  ponytail: useCoarsePointer copies the engine's own, which
//  @spawnite/engine does not export; import the engine's once it does.

/** A phone held upright: a finger for a pointer, a screen taller than wide
 *  and narrower than three full-size cards. styles.css lays the cards out
 *  for the same query. */
export const phoneUprightQuery =
    "(pointer: coarse) and (orientation: portrait) and (max-width: 40rem)";

function readQuery(query: string) {
    //  jsdom, where the tests run, has no media queries at all.
    return typeof matchMedia === "function" ? matchMedia(query) : null;
}

/** Whether the page matches a media query, followed as it changes. */
function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(
        () => readQuery(query)?.matches === true,
    );
    useEffect(() => {
        const list = readQuery(query);
        if (!list) return;
        const readChange = () => setMatches(list.matches);
        readChange();
        list.addEventListener("change", readChange);
        return () => list.removeEventListener("change", readChange);
    }, [query]);
    return matches;
}

/** Whether the device's main pointer is a finger, followed as it changes.
 *  The input decides, never the window's size: a narrow desktop window
 *  still has a mouse. */
export function useCoarsePointer() {
    return useMediaQuery("(pointer: coarse)");
}

/** Whether the page is a phone held upright, followed as she turns it. */
export function usePhoneUpright() {
    return useMediaQuery(phoneUprightQuery);
}
