import { useStore } from "zustand";
import { selectNextQualityLevel, useQualityStore } from "@spawnite/engine";
import { QualityButton } from "@spawnite/ui";

export function QualitySetting() {
    const qualityStore = useQualityStore();
    const level = useStore(qualityStore, (state) => state.level);
    const setLevel = useStore(qualityStore, (state) => state.setLevel);

    return (
        <QualityButton
            level={level}
            onPress={() => {
                setLevel(selectNextQualityLevel(level));
            }}
        />
    );
}
