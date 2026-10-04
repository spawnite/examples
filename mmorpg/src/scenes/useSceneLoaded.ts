import { useEffect, useState } from "react";
import { useQueryFirst } from "koota/react";
import {
    GroundTrait,
    HeroTrait,
    RefTrait,
    useLoading,
    useTime,
} from "@spawnite/engine";

/** True from the moment the meadow and her model are drawn, the loaders
 *  are idle and the loop runs, and from then on. `loading` alone reads idle
 *  between one batch of loads and the next. Her model and the World's views
 *  suspend behind boundaries of their own, so each says it is drawn by the
 *  Ref it registers; the ground's view commits with the rest of the World's
 *  views; the navmesh waits on its wasm in a boundary of its own. The
 *  physics wasm loads outside drei's loaders, and the loop runs only once
 *  it has. */
export function useSceneLoaded() {
    const loading = useLoading((state) => state.loading);
    const drawnHero = useQueryFirst(HeroTrait, RefTrait);
    const drawnGround = useQueryFirst(GroundTrait, RefTrait);
    const running = useTime((state) => state.running);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (drawnHero && drawnGround && !loading && running) setLoaded(true);
    }, [drawnHero, drawnGround, loading, running]);

    return loaded;
}
