import { useQueryFirst, useTrait } from "koota/react";
import { AuthorityTrait, HeroTrait, Text } from "@spawnite/engine";
import { readLevel, readLevelStart } from "../siege/career";
import { CareerTrait } from "../siege/traits";
import { hudDisplay, hudNote } from "./look";

/** Her career on an end screen, in one line: her level, "Level up" where
 *  the run carried her over one, the XP this run added, and the XP the
 *  next level needs. The room keeps the career; the level is worked out
 *  here from its XP. */
export function CareerLine() {
    const career = useTrait(
        useQueryFirst(HeroTrait, AuthorityTrait),
        CareerTrait,
    );
    if (!career) return null;
    const level = readLevel(career.xp);
    const levelledUp = readLevel(career.xp - career.runXp) < level;
    const toNext = readLevelStart(level + 1) - career.xp;

    return (
        <Text
            as="div"
            className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1"
        >
            <Text className={`${hudDisplay} text-2xl text-amber-200 uppercase`}>
                Level {level}
            </Text>
            {levelledUp && (
                <Text
                    className={`${hudDisplay} text-xl text-amber-300 uppercase`}
                >
                    Level up
                </Text>
            )}
            {career.runXp > 0 && (
                <Text className={`${hudDisplay} text-xl text-emerald-300`}>
                    +{career.runXp} XP this run
                </Text>
            )}
            <Text className={hudNote}>
                {toNext} XP to level {level + 1}
            </Text>
        </Text>
    );
}
