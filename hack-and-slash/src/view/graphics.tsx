import { useEffect, type ReactNode } from "react";
import { useStore } from "zustand";
import {
    QualityLevel,
    selectCustomQuality,
    useActiveQualityLevel,
    useQualityLevel,
    useQualityStore,
    World,
    type QualityOptions,
} from "@spawnite/engine";

//  How much the game draws: the engine's quality levels set the canvas's
//  resolution, the sun's shadows and the meadow's decorative grass and
//  bushes, with the game's own shares below; the game's own detail, the
//  grass's second read, the hero's own detail and the HUD glass's blur,
//  follow the level in force. The game plays on Automatic, which the
//  engine picks for the device once.

/** What the game draws, lowest first. */
export type Detail = "minimum" | "low" | "medium" | "high";

/** The engine's level names, as its store keeps them. */
const levelDetails: Record<Exclude<QualityLevel, QualityLevel.Auto>, Detail> = {
    [QualityLevel.Minimum]: "minimum",
    [QualityLevel.Low]: "low",
    [QualityLevel.Medium]: "medium",
    [QualityLevel.High]: "high",
};

/** The graphics levels the menu steps through, as the player reads them:
 *  Auto first, then down from the best. */
export const graphicsLevels = [
    { level: QualityLevel.Auto, name: "Auto" },
    { level: QualityLevel.High, name: "High" },
    { level: QualityLevel.Medium, name: "Medium" },
    { level: QualityLevel.Low, name: "Low" },
    { level: QualityLevel.Minimum, name: "Minimum" },
] as const;

/** What the menu's level reads: Automatic, a level, or Custom once the
 *  player set one of the Settings panel's feature rows apart. */
export function useGraphicsLevel(): QualityLevel | "custom" {
    const level = useQualityLevel();
    const custom = useStore(useQualityStore(), selectCustomQuality);
    return custom ? "custom" : level;
}

/** Moves the graphics level on to the next in the menu's order; from
 *  Custom, back to Auto. */
export function useNextGraphicsLevel() {
    const store = useQualityStore();
    return () => {
        const { level } = store.getState();
        const at = selectCustomQuality(store.getState())
            ? -1
            : graphicsLevels.findIndex((each) => each.level === level);
        store
            .getState()
            .setLevel(graphicsLevels[(at + 1) % graphicsLevels.length].level);
    };
}

export const detailNames: Record<Detail, string> = {
    minimum: "Minimum",
    low: "Low",
    medium: "Medium",
    high: "High",
};

/** The meadow's scatter is most of what a frame draws: the whole meadow's
 *  tufts, seen or not, were ten million vertices a frame against the
 *  hero's few hundred thousand, and from the wilds' camera the grass
 *  painted on the ground reads the same under a third of them. So Low and
 *  Medium stand fewer than the engine's levels, and High casts the 1024
 *  texel shadow map the game's own Automatic drew. */
export const bladeboundQuality: QualityOptions = {
    levels: {
        [QualityLevel.Low]: { scatter: 0.12 },
        [QualityLevel.Medium]: { scatter: 0.3 },
        [QualityLevel.High]: { shadowMapSize: 1024 },
    },
};

/** What the game draws at the level in force, the one each of its own
 *  details follows. */
export function useDetail(): Detail {
    return levelDetails[useActiveQualityLevel()];
}

/** The engine's World, with the level in force marked on the page for the
 *  HUD's glass, which drops its blur below High. */
export function DetailedWorld({
    map,
    children,
}: {
    map: string;
    children: ReactNode;
}) {
    const detail = useDetail();
    useEffect(() => {
        document.documentElement.dataset.detail = detail;
    }, [detail]);
    return <World map={map}>{children}</World>;
}
