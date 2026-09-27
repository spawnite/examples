import { useState } from "react";
import { useProgress } from "@react-three/drei";
import { type GameLoadingScreenProps, Text } from "@spawnite/engine";
import { ProgressBar, ProgressBarVariant } from "@spawnite/ui";
import { hudDisplay, hudLabel } from "../hud/look";

export interface LoadShareOptions {
    /** The engine's own share: its wasm, the scene's mount, the first draw. */
    steps: number;
    /** Files three's loaders have landed, and asked for, since the page opened. */
    filesLoaded: number;
    filesTotal: number;
}

/** How much of the load has landed, from 0 to 1: the engine's steps and
 *  the files each count for half, because the steps finish on the wasm
 *  while the avatars and models are still arriving. */
export function readLoadShare({
    steps,
    filesLoaded,
    filesTotal,
}: LoadShareOptions): number {
    const files = filesTotal === 0 ? 0 : filesLoaded / filesTotal;
    return (steps + files) / 2;
}

/** Holdfast's loading screen: the name over the dusk and the fire's glow,
 *  and a bar of what has landed. A file asked for late lowers the share,
 *  so the bar holds the highest share it has shown. */
export function HoldfastLoadingScreen({ value }: GameLoadingScreenProps) {
    const filesLoaded = useProgress((state) => state.loaded);
    const filesTotal = useProgress((state) => state.total);
    const share = readLoadShare({ steps: value, filesLoaded, filesTotal });
    const [shown, setShown] = useState(share);
    //  Adjusted while rendering, as React's docs do for state that follows
    //  a prop, so the bar never draws the lower share for a frame.
    if (share > shown) setShown(share);
    const percent = Math.round(Math.max(share, shown) * 100);

    return (
        <Text
            as="div"
            className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950 bg-radial-[at_50%_110%] from-amber-700/35 via-transparent via-60% to-transparent [--color-loading-bar:var(--color-amber-300)]"
        >
            <Text as="div" className={hudLabel}>
                Hold the circle till dawn
            </Text>
            <Text
                as="div"
                className={`${hudDisplay} text-7xl text-amber-100 uppercase`}
            >
                Holdfast
            </Text>
            <ProgressBar
                role="progressbar"
                aria-label="Loading"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                value={percent / 100}
                variant={ProgressBarVariant.LoadingBar}
                className="mt-4 h-1.5 w-72 bg-slate-800/80 ring-1 ring-amber-200/20"
            />
            <Text
                as="div"
                className={`${hudDisplay} text-lg text-amber-100/70 tabular-nums`}
            >
                {`${percent}%`}
            </Text>
        </Text>
    );
}
