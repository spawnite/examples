//  The four stats a level up's points go into, as MapleStory's AP do.

export type StatName = "str" | "dex" | "vit" | "agi" | "cri";

export const statNames: readonly StatName[] = [
    "str",
    "dex",
    "vit",
    "agi",
    "cri",
];

export const statLabels: Record<StatName, string> = {
    str: "STR",
    dex: "DEX",
    vit: "VIT",
    agi: "AGI",
    cri: "CRI",
};

/** Each stat by its whole name, as the character window lists them. */
export const statTitles: Record<StatName, string> = {
    str: "Strength",
    dex: "Dexterity",
    vit: "Vitality",
    agi: "Agility",
    cri: "Critical",
};

export const statHints: Record<StatName, string> = {
    str: "sword damage",
    dex: "crossbow damage",
    vit: "max health",
    agi: "attack & move speed",
    cri: "critical rate & damage",
};
