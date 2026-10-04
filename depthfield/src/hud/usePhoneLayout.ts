import { useSyncExternalStore } from "react";

//  A touch screen or a narrow window: the run shows only what a thumb's
//  game needs, and health over the soldier's head.
const phoneQuery = "(pointer: coarse), (max-width: 639px)";

function subscribe(changed: () => void) {
    const query = matchMedia(phoneQuery);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
}

/** Whether the page lays the run out for a phone. */
export function usePhoneLayout() {
    return useSyncExternalStore(
        subscribe,
        () => matchMedia(phoneQuery).matches,
        () => false,
    );
}
