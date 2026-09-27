import { useEffect, useState } from "react";
import { PerformanceMonitor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useStore } from "zustand";
import { qualitySettings, useQualityStore } from "@spawnite/engine";

interface QualityRigProps {
    /** The GPU tier the quality level is chosen from under Auto. */
    tier: number;
}

/** Sets the canvas's pixel ratio from the quality level, scaled down by the
 *  performance monitor while the frame runs slow. */
export function QualityRig({ tier }: QualityRigProps) {
    const setDpr = useThree((state) => state.setDpr);
    const [factor, setFactor] = useState(1);
    const qualityStore = useQualityStore();
    //  Subscribed rather than read once, because a selection can leave the
    //  baseline where it was — Auto on a tier-3 GPU and High are both 2 —
    //  and it is the selection that decides whether the factor applies.
    const pixelRatio = useStore(qualityStore, (state) =>
        state.scalePixelRatio(
            Math.min(window.devicePixelRatio, state.selectPixelRatio(tier)),
            factor,
        ),
    );

    useEffect(() => setDpr(pixelRatio), [setDpr, pixelRatio]);
    //  The engine's post-processing resolves Auto through the same tier.
    useEffect(
        () => qualityStore.getState().setTier(tier),
        [qualityStore, tier],
    );

    return (
        <PerformanceMonitor
            factor={1}
            ms={qualitySettings.sampleMilliseconds}
            onChange={({ factor }) => setFactor(factor)}
        />
    );
}
