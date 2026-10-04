import type { Entity } from "koota";
import { useTrait } from "koota/react";
import { Text } from "@spawnite/engine";
import { readLevel } from "../siege/career";
import { CareerTrait } from "../siege/traits";

/** A warden's career level, worked out from her career's XP as the end
 *  screens do, or undefined before her career reaches the page. */
export function useLevel(warden: Entity | undefined) {
    const career = useTrait(warden, CareerTrait);
    return career && readLevel(career.xp);
}

/** Her level as a small chip beside her name, on her own panel and on
 *  the wardens list: a tag's type, outlined so it never reads as a state
 *  tag, and set tighter than one so a name beside it keeps its room. */
export function LevelChip({ level }: { level: number | undefined }) {
    if (level === undefined) return null;
    return (
        <Text className="shrink-0 rounded px-1 py-0.5 text-[0.6875rem] leading-none font-bold tracking-[0.06em] whitespace-nowrap text-amber-200 tabular-nums ring-1 ring-amber-200/40">
            LV {level}
        </Text>
    );
}
