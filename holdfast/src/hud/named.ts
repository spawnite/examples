import type { IconName } from "@spawnite/engine";
import { WaveName } from "../siege/traits";
import { bossEvery, nightWaves } from "../siege/waves";

//  How the HUD shows a wave that changes the fight: a named wave, or a
//  colossus's. The breather's banner names it a breather ahead, and the
//  call as it rises names it again, each in its own colour.

/** A wave as the HUD shows it: its title, a line on how to fight it, its
 *  picture, and its colours, written whole because Tailwind emits only the
 *  classes it reads. */
export interface WaveLook {
    title: string;
    line: string;
    icon: IconName;
    /** The title's colour on the HUD. */
    text: string;
    /** The call's glow behind the title. */
    glow: string;
    /** The rule under the call. */
    rule: string;
}

const namedLooks: Record<Exclude<WaveName, WaveName.Plain>, WaveLook> = {
    [WaveName.Swarm]: {
        title: "Swarm",
        line: "Skitters, fast and many. Keep moving",
        icon: "zap",
        text: "text-lime-300",
        glow: "[text-shadow:0_2px_0_rgb(20_50_0),0_0_24px_rgb(163_230_53/0.55)]",
        rule: "via-lime-300",
    },
    [WaveName.Brutes]: {
        title: "Brutes",
        line: "Few, huge, and each one hits hard",
        icon: "swords",
        text: "text-orange-400",
        glow: "[text-shadow:0_2px_0_rgb(70_20_0),0_0_24px_rgb(251_146_60/0.55)]",
        rule: "via-orange-400",
    },
    [WaveName.SpitterRain]: {
        title: "Spitter rain",
        line: "Spitters keep their distance. Close in",
        icon: "droplet",
        text: "text-emerald-300",
        glow: "[text-shadow:0_2px_0_rgb(0_50_30),0_0_24px_rgb(110_231_183/0.55)]",
        rule: "via-emerald-300",
    },
    [WaveName.Horde]: {
        title: "Horde",
        line: "A flood of husks. Hold together",
        icon: "users",
        text: "text-violet-300",
        glow: "[text-shadow:0_2px_0_rgb(40_10_70),0_0_24px_rgb(196_181_253/0.55)]",
        rule: "via-violet-300",
    },
};

const colossusLook: WaveLook = {
    title: "The colossus",
    line: "Stay clear of its slam",
    icon: "skull",
    text: "text-amber-300",
    glow: "[text-shadow:0_2px_0_rgb(70_35_0),0_0_24px_rgb(252_211_77/0.6)]",
    rule: "via-amber-300",
};

const lastColossusLook: WaveLook = {
    ...colossusLook,
    title: "The last colossus",
    line: "Bring it down, and dawn breaks",
};

/** How the HUD shows wave `wave` of the name `named`: a colossus's wave by
 *  its colossus, a named one by its name, and a plain one not at all. */
export function readWaveLook(
    wave: number,
    named: WaveName,
): WaveLook | undefined {
    if (wave > 0 && wave % bossEvery === 0)
        return wave === nightWaves ? lastColossusLook : colossusLook;
    return named === WaveName.Plain ? undefined : namedLooks[named];
}
