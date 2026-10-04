import { useWorld } from "koota/react";
import { useCallback, useRef } from "react";
import { WelcomesTrait } from "@spawnite/engine";

/** A check for a view that eases toward the world's state, to call once a
 *  frame: true on the view's first frame and on the first frame after the
 *  page takes a welcome, its join, a rejoin or a replay's seek, where the
 *  view stands on the state at once, since the world it shows then did not
 *  come from the frames before. A held replay page plays a second at most
 *  before the moment it shows, too little for an ease of a second or more
 *  to settle. */
export function useWelcomed() {
    const world = useWorld();
    const seenRef = useRef<number | null>(null);
    return useCallback(() => {
        const welcomes = world.get(WelcomesTrait)?.count ?? 0;
        const welcomed = seenRef.current !== welcomes;
        seenRef.current = welcomes;
        return welcomed;
    }, [world]);
}
