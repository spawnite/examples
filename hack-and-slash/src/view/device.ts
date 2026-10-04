import { useSyncExternalStore } from "react";

//  What the page is played on, read from the browser's media queries and
//  kept current as a phone turns or a tablet gains a mouse.

function useMedia(query: string) {
    return useSyncExternalStore(
        (changed) => {
            const media = window.matchMedia(query);
            media.addEventListener("change", changed);
            return () => media.removeEventListener("change", changed);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}

/** A touch screen with no mouse: a phone or a tablet. */
export function useTouch() {
    return useMedia("(pointer: coarse)");
}

/** Taller than wide: a phone held upright. */
export function usePortrait() {
    return useMedia("(orientation: portrait)");
}

/** A phone or a tablet, or a window taller than wide: where the HUD's
 *  slots are too narrow to hold a window, so windows open over the whole
 *  screen, one at a time. */
export function useCompact() {
    const touch = useTouch();
    const portrait = usePortrait();
    return touch || portrait;
}
