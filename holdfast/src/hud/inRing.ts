import { useWorld } from "koota/react";
import { useEffect, useState } from "react";
import { AuthorityTrait, HeroTrait, TransformTrait } from "@spawnite/engine";
import { isInReadyRing } from "../siege/waves";

/** Whether her own hero stands in the ready ring, by the test the room
 *  readies her by, read each animation frame where her page draws her.
 *  The browser's frames rather than the canvas's, so it reads outside a
 *  canvas as well. */
export function useInReadyRing() {
    const world = useWorld();
    const [inside, setInside] = useState(false);
    useEffect(() => {
        let frame = 0;
        const read = () => {
            const feet = world
                .queryFirst(HeroTrait, AuthorityTrait)
                ?.get(TransformTrait);
            setInside(feet !== undefined && isInReadyRing(feet));
            frame = requestAnimationFrame(read);
        };
        frame = requestAnimationFrame(read);
        return () => cancelAnimationFrame(frame);
    }, [world]);
    return inside;
}
