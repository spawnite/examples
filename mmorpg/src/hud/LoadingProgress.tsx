import { useProgress } from "@react-three/drei";

/** The loaders' progress on a hidden element, for the end-to-end cases,
 *  which cannot read the loaders. In the scene's Hud, so it appears once the
 *  scene stands and its loads have started: the loaders read 100 in the gap
 *  before them. */
export function LoadingProgress() {
    const progress = useProgress((state) => state.progress);

    return <div hidden data-loading-progress={progress} />;
}
