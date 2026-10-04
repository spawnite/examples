import { useStore } from "zustand";
import {
    QualityLevel,
    selectCustomQuality,
    selectNextQualityLevel,
    useQualityStore,
} from "@spawnite/engine";
import { QualityButton } from "@spawnite/ui";

/** The HUD's quality button: each press walks Automatic and the four
 *  levels, and from Custom goes back to Automatic. */
export function QualitySetting() {
    const qualityStore = useQualityStore();
    const level = useStore(qualityStore, (state) => state.level);
    const custom = useStore(qualityStore, selectCustomQuality);
    const setLevel = useStore(qualityStore, (state) => state.setLevel);

    return (
        <QualityButton
            level={level}
            custom={custom}
            onPress={() => {
                setLevel(
                    custom ? QualityLevel.Auto : selectNextQualityLevel(level),
                );
            }}
        />
    );
}
