import { statNames, type StatName } from "../hero/stats";
import type { MonsterKindName } from "../monsters/kinds";

//  Every item in the game, as data: what it is, where it is worn, what it
//  gives, and the colours its sprite is painted in.

export type EquipSlot =
    "weapon" | "shield" | "head" | "body" | "hands" | "feet";
export type WeaponKind = "sword" | "crossbow";
export const weaponKinds: readonly WeaponKind[] = ["sword", "crossbow"];
export type HeadShape = "cap" | "helm" | "hat" | "headset";
/** The armor sets, each made of a body, gloves and boots she wears as
 *  models: the creator's Meshy sets, fitted to her. */
export type ArmorSet =
    "arcane" | "battlemage" | "berserker" | "knight" | "ranger" | "scout";
/** An item's rarity, rolled as it drops: each tier its stats higher and
 *  its bonus stats more. An item's own is the least it drops at. */
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const rarities: readonly Rarity[] = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
];

export type ItemDef = {
    name: string;
    rarity: Rarity;
    /** Where it is worn; a potion has none. */
    slot?: EquipSlot;
    weapon?: WeaponKind;
    headShape?: HeadShape;
    /** The armor set a body, gloves or boots piece belongs to. */
    armorSet?: ArmorSet;
    /** Stamina it adds, a dodge's worth at 30: rare gear only. */
    stamina?: number;
    /** Per cent faster its wearer's stamina comes back. */
    staminaRecovery?: number;
    /** Damage a weapon adds to each hit. */
    damage?: number;
    /** Health each hit taken loses less by. */
    armor?: number;
    /** Maximum health it adds. */
    health?: number;
    bonus?: Partial<Record<StatName, number>>;
    /** Health a potion restores. */
    heal?: number;
    /** The sprite's main colour and its trim. */
    colors: [string, string];
    /** The creator's model a weapon is drawn as, under public/models/
     *  weapons, and whether it has a map of the parts that glow. */
    model?: string;
    glows?: boolean;
    /** A single-edged blade, such as the Katana's, turned half about its
     *  length from the others, so its one edge, not its back, leads. */
    edgeFlip?: boolean;
    /** A crossbow's bolts: the monsters each passes through past the
     *  first, the bolts more each shot fans out, and the times each
     *  bounces on to the nearest other monster. */
    pierce?: number;
    multishot?: number;
    ricochet?: number;
};

export const items = {
    redPotion: {
        name: "Red Potion",
        rarity: "common",
        heal: 50,
        colors: ["#e8413a", "#f2e6d8"],
    },
    //  The swords, each the creator's model.
    rustySword: {
        name: "Basic Sword",
        rarity: "common",
        slot: "weapon",
        weapon: "sword",
        damage: 0,
        colors: ["#c9d1da", "#6b4a2b"],
        model: "sword-basic",
    },
    ironSword: {
        name: "Katana",
        rarity: "uncommon",
        slot: "weapon",
        weapon: "sword",
        damage: 5,
        colors: ["#e3eaf2", "#2a2a2e"],
        model: "sword-katana",
        edgeFlip: true,
    },
    mossSword: {
        name: "Moss Sword",
        rarity: "uncommon",
        slot: "weapon",
        weapon: "sword",
        damage: 7,
        health: 15,
        bonus: { vit: 1 },
        colors: ["#e3eaf2", "#6cc24a"],
        model: "sword-moss",
    },
    emberBlade: {
        name: "Ember Sword",
        rarity: "rare",
        slot: "weapon",
        weapon: "sword",
        damage: 10,
        bonus: { str: 3 },
        colors: ["#ff9a4a", "#5a1f14"],
        model: "sword-ember",
        glows: true,
    },
    //  The crossbows, one-handed, so she can hold one in each hand or a
    //  shield with one. Their ids are the bows' they replaced, so a hero's
    //  bow is her crossbow now.
    shortBow: {
        name: "Light Crossbow",
        rarity: "common",
        slot: "weapon",
        weapon: "crossbow",
        damage: 0,
        colors: ["#8a5a2b", "#c9d1da"],
    },
    huntersBow: {
        name: "Hunter's Crossbow",
        rarity: "uncommon",
        slot: "weapon",
        weapon: "crossbow",
        damage: 5,
        pierce: 1,
        colors: ["#4f6e2e", "#c9d1da"],
    },
    emberLongbow: {
        name: "Ember Crossbow",
        rarity: "rare",
        slot: "weapon",
        weapon: "crossbow",
        damage: 10,
        multishot: 1,
        bonus: { dex: 3 },
        colors: ["#b8401c", "#ffd24a"],
    },
    woodenBuckler: {
        name: "Wooden Buckler",
        rarity: "common",
        slot: "shield",
        armor: 1,
        health: 10,
        colors: ["#9a6a3a", "#7a7f86"],
    },
    ironKite: {
        name: "Iron Kite Shield",
        rarity: "uncommon",
        slot: "shield",
        armor: 3,
        health: 25,
        bonus: { vit: 1 },
        colors: ["#c9d1da", "#2f5aa8"],
    },
    catHeadset: {
        name: "Cat-Ear Headset",
        rarity: "rare",
        slot: "head",
        headShape: "headset",
        armor: 1,
        stamina: 15,
        bonus: { agi: 2, cri: 2 },
        colors: ["#4b3a48", "#e86fa6"],
    },
    leatherCap: {
        name: "Leather Cap",
        rarity: "common",
        slot: "head",
        headShape: "cap",
        armor: 1,
        health: 10,
        colors: ["#8a5a2b", "#5e3b1c"],
    },
    ironHelm: {
        name: "Iron Helm",
        rarity: "uncommon",
        slot: "head",
        headShape: "helm",
        armor: 2,
        health: 20,
        bonus: { vit: 1 },
        colors: ["#aeb6bf", "#6d7680"],
    },
    featherHat: {
        name: "Feathered Hat",
        rarity: "uncommon",
        slot: "head",
        headShape: "hat",
        bonus: { dex: 2, agi: 2 },
        colors: ["#34569a", "#e8413a"],
    },
    //  The armor sets: each a body, gloves and boots. The robes are light
    //  and quick, the battle mage's gear is for a crossbow, the berserker's for
    //  a sword, and the knight's is the heaviest.
    arcaneRobes: {
        name: "Arcane Robes",
        rarity: "uncommon",
        slot: "body",
        armorSet: "arcane",
        armor: 1,
        health: 25,
        bonus: { agi: 2 },
        colors: ["#2c7a8b", "#e0d0ff"],
    },
    arcaneGloves: {
        name: "Arcane Gloves",
        rarity: "uncommon",
        slot: "hands",
        armorSet: "arcane",
        bonus: { dex: 2, agi: 1 },
        colors: ["#2c7a8b", "#e0d0ff"],
    },
    arcaneBoots: {
        name: "Arcane Boots",
        rarity: "uncommon",
        slot: "feet",
        armorSet: "arcane",
        bonus: { agi: 3 },
        colors: ["#2c7a8b", "#e0d0ff"],
    },
    battleMageCoat: {
        name: "Battle Mage Coat",
        rarity: "uncommon",
        slot: "body",
        armorSet: "battlemage",
        armor: 2,
        health: 15,
        bonus: { dex: 2, agi: 1 },
        colors: ["#4b3f8a", "#f2c230"],
    },
    battleMageGloves: {
        name: "Battle Mage Gloves",
        rarity: "uncommon",
        slot: "hands",
        armorSet: "battlemage",
        armor: 1,
        bonus: { dex: 2, cri: 1 },
        colors: ["#4b3f8a", "#f2c230"],
    },
    battleMageBoots: {
        name: "Battle Mage Boots",
        rarity: "uncommon",
        slot: "feet",
        armorSet: "battlemage",
        armor: 1,
        bonus: { agi: 2 },
        colors: ["#4b3f8a", "#f2c230"],
    },
    berserkerHarness: {
        name: "Berserker Harness",
        rarity: "rare",
        slot: "body",
        armorSet: "berserker",
        armor: 2,
        health: 20,
        bonus: { str: 3 },
        colors: ["#6b4a3a", "#b8342c"],
    },
    berserkerGauntlets: {
        name: "Berserker Gauntlets",
        rarity: "rare",
        slot: "hands",
        armorSet: "berserker",
        armor: 1,
        bonus: { str: 2, cri: 2 },
        colors: ["#6b4a3a", "#b8342c"],
    },
    berserkerBoots: {
        name: "Berserker Boots",
        rarity: "rare",
        slot: "feet",
        armorSet: "berserker",
        armor: 1,
        stamina: 30,
        bonus: { str: 1, agi: 2 },
        colors: ["#6b4a3a", "#b8342c"],
    },
    //  The creator's light leathers, for a quick hand with a crossbow: the
    //  ranger's green, and the scout's cream and teal.
    rangerTunic: {
        name: "Ranger's Tunic",
        rarity: "uncommon",
        slot: "body",
        armorSet: "ranger",
        armor: 1,
        health: 15,
        bonus: { dex: 2, agi: 1 },
        colors: ["#2f5a3a", "#6b4a2b"],
    },
    rangerBracers: {
        name: "Ranger's Bracers",
        rarity: "uncommon",
        slot: "hands",
        armorSet: "ranger",
        bonus: { dex: 2, cri: 1 },
        colors: ["#6b4a2b", "#2f5a3a"],
    },
    rangerBoots: {
        name: "Ranger's Boots",
        rarity: "uncommon",
        slot: "feet",
        armorSet: "ranger",
        armor: 1,
        bonus: { agi: 2 },
        colors: ["#5a3f28", "#2f5a3a"],
    },
    scoutJacket: {
        name: "Scout's Jacket",
        rarity: "rare",
        slot: "body",
        armorSet: "scout",
        armor: 2,
        health: 20,
        bonus: { agi: 3, dex: 1 },
        colors: ["#e8e2d0", "#3a6f78"],
    },
    scoutBracers: {
        name: "Scout's Bracers",
        rarity: "rare",
        slot: "hands",
        armorSet: "scout",
        armor: 1,
        bonus: { dex: 2, cri: 2 },
        colors: ["#5a3f28", "#3a6f78"],
    },
    scoutBoots: {
        name: "Scout's Boots",
        rarity: "rare",
        slot: "feet",
        armorSet: "scout",
        armor: 1,
        stamina: 15,
        bonus: { agi: 3 },
        colors: ["#4a3624", "#3a6f78"],
    },
    //  The beginner's armor, which every new hero wears: the creator's
    //  chibi knight's plate, at a beginner's stats.
    knightPlate: {
        name: "Knight's Plate",
        rarity: "common",
        slot: "body",
        armorSet: "knight",
        armor: 2,
        health: 15,
        colors: ["#c9d1da", "#2f5aa8"],
    },
    knightGauntlets: {
        name: "Knight's Gauntlets",
        rarity: "common",
        slot: "hands",
        armorSet: "knight",
        armor: 1,
        colors: ["#c9d1da", "#2f5aa8"],
    },
    knightGreaves: {
        name: "Knight's Greaves",
        rarity: "common",
        slot: "feet",
        armorSet: "knight",
        armor: 1,
        health: 5,
        colors: ["#c9d1da", "#2f5aa8"],
    },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof items;

export const itemIds = Object.keys(items) as ItemId[];

export function itemDef(id: ItemId): ItemDef {
    return items[id];
}

export const rarityColors: Record<Rarity, string> = {
    common: "#f2f2f2",
    uncommon: "#5ee06a",
    rare: "#4aa8ff",
    epic: "#b86cff",
    legendary: "#ffa53a",
};

export const rarityNames: Record<Rarity, string> = {
    common: "Common",
    uncommon: "Uncommon",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
};

/** What each rarity multiplies an item's stats by, and how many bonus
 *  stats it rolls on top of its own: a legendary piece stands at 1.8
 *  times a common one's stats, with four more bonus stats. */
const rarityPower: Record<Rarity, { stats: number; extras: number }> = {
    common: { stats: 1, extras: 0 },
    uncommon: { stats: 1.15, extras: 1 },
    rare: { stats: 1.3, extras: 2 },
    epic: { stats: 1.5, extras: 3 },
    legendary: { stats: 1.8, extras: 4 },
};

/** The chance of a drop rolling each tier over its item's own: most stay
 *  as they are, one in a hundred climbs four. A boss's drops roll better. */
const tierOdds = [0.62, 0.25, 0.09, 0.03, 0.01];
const bossTierOdds = [0.4, 0.35, 0.15, 0.07, 0.03];

/** The rarity an item drops at: its own, or better. */
export function rollRarity(id: ItemId, boss = false): Rarity {
    const own = rarities.indexOf(itemDef(id).rarity);
    const odds = boss ? bossTierOdds : tierOdds;
    let pick = Math.random();
    let step = 0;
    while (step < odds.length - 1 && (pick -= odds[step]) >= 0) step++;
    return rarities[Math.min(rarities.length - 1, own + step)];
}

/** What the smith and the drops have made of one piece of gear: its
 *  rarity, the bonus stats that rarity rolled, how many times it has been
 *  merged up, and the effects its every tenth merge rolled. */
export type Mods = {
    rarity?: Rarity;
    extra?: Partial<Record<StatName, number>>;
    plus?: number;
    effects?: ItemEffect[];
};

/** A piece of gear as it drops at `rarity`: the bonus stats its tiers over
 *  its item's own roll, each on an attribute at random, stronger the
 *  rarer. Nothing for a potion or a piece at its own rarity. */
export function rolledMods(id: ItemId, rarity: Rarity): Mods {
    const item = itemDef(id);
    if (!item.slot || rarity === item.rarity) return {};
    const lines = rarityPower[rarity].extras - rarityPower[item.rarity].extras;
    const tier = rarities.indexOf(rarity);
    const extra: Partial<Record<StatName, number>> = {};
    for (let line = 0; line < lines; line++) {
        const stat = statNames[Math.floor(Math.random() * statNames.length)];
        extra[stat] = (extra[stat] ?? 0) + Math.max(1, tier - 1 + roll(1, 2));
    }
    return { rarity, extra };
}

/** A piece's rarity: as it dropped, else its item's own. */
export const rarityOf = (id: ItemId, mods: Mods = {}) =>
    mods.rarity ?? itemDef(id).rarity;

/** What the `step`th merge multiplies an item's every stat by: 15% more
 *  at the first, then less each time, by the square root of the step, and
 *  never nothing. On what the merges before it made, so the merges
 *  snowball, with no end: +10 stands at 2.4 times, +25 at 4, +50 at 6. */
const mergeGrowth = (step: number) => 1 + 0.15 / Math.sqrt(step);

/** What `plus` merges multiply every stat by, together. */
const growths = [1];
function growthAt(plus: number) {
    while (growths.length <= plus)
        growths.push(growths[growths.length - 1] * mergeGrowth(growths.length));
    return growths[plus];
}

const upgradedDefs = new Map<string, ItemDef>();

/** One piece of gear as it is: its item at its rarity, with the bonus
 *  stats that rolled, merged up `plus` times, every stat raised. */
export function pieceDef(id: ItemId, mods: Mods = {}): ItemDef {
    const base = itemDef(id);
    const plus = mods.plus ?? 0;
    const rarity = rarityOf(id, mods);
    if (!base.slot || (!plus && rarity === base.rarity && !mods.extra))
        return base;
    const key = `${id}+${plus}/${rarity}/${JSON.stringify(mods.extra ?? {})}`;
    let made = upgradedDefs.get(key);
    if (!made) {
        //  Its main stat, a weapon's damage or a piece's armor, gains at
        //  least 1 a merge, so every merge shows.
        const growth =
            growthAt(plus) *
            (rarityPower[rarity].stats / rarityPower[base.rarity].stats);
        const raise = (value: number | undefined, main = false) => {
            const grown = value ? Math.round(value * growth) : value;
            return main ? Math.max(grown ?? 0, (value ?? 0) + plus) : grown;
        };
        const weapon = base.slot === "weapon";
        const bonus: Partial<Record<StatName, number>> = { ...base.bonus };
        for (const [stat, value] of Object.entries(mods.extra ?? {}) as [
            StatName,
            number,
        ][])
            bonus[stat] = (bonus[stat] ?? 0) + value;
        made = {
            ...base,
            rarity,
            damage: raise(base.damage, weapon),
            armor: raise(base.armor, !weapon),
            health: raise(base.health),
            stamina: raise(base.stamina),
            staminaRecovery: raise(base.staminaRecovery),
            bonus: Object.fromEntries(
                Object.entries(bonus).map(([stat, value]) => [
                    stat,
                    raise(value),
                ]),
            ),
        };
        upgradedDefs.set(key, made);
    }
    return made;
}

/** Its name with its merges: "Iron Sword +3". */
export function itemTitle(id: ItemId, plus = 0) {
    const { name } = itemDef(id);
    return plus ? `${name} +${plus}` : name;
}

/** The chance, 0 to 1, that the smith's merge of an item at `plus` takes:
 *  95% at first, 4% less each merge, and never below 10%. A merge that
 *  fails still takes the gold and the copy merged in. */
export function mergeChance(plus: number) {
    return Math.max(0.1, 0.95 - 0.04 * plus);
}

/** Gold the smith asks to merge an item at `plus` up one: dearer each
 *  merge, by the power 1.5 of the merges it will have, and dearer for a
 *  rarer item: a rare one's first costs 250, its +10 9,100, its +20 24,000. */
export function mergeCost(
    id: ItemId,
    plus: number,
    rarity: Rarity = itemDef(id).rarity,
) {
    const base = {
        common: 40,
        uncommon: 100,
        rare: 250,
        epic: 500,
        legendary: 1000,
    }[rarity];
    return Math.round((base * (1 + plus) ** 1.5) / 5) * 5;
}

/** The merges at which an item gains an effect: every tenth. */
export const effectEvery = 10;
/** The merge from which an item glows. */
export const glowFrom = 7;

/** What an item can gain at every tenth merge, rolled at random: a hit
 *  that poisons or burns, a share of her damage back as health, quicker
 *  attacks, or the Cyclone skill. */
export type EffectKind =
    | "poison"
    | "burn"
    | "leech"
    | "frenzy"
    | "cyclone"
    | "pierce"
    | "multishot"
    | "ricochet";

/** The effects only a crossbow rolls: what its bolts do. */
const rangedEffects: readonly EffectKind[] = [
    "pierce",
    "multishot",
    "ricochet",
];
export type ItemEffect = { kind: EffectKind; value: number };
export type SkillId = "cyclone";

/** Seconds a poison and a burn last. */
export const poisonSeconds = 4;
export const burnSeconds = 2;

const effectWeights: Record<EffectKind, number> = {
    poison: 2,
    burn: 2,
    leech: 2,
    frenzy: 2,
    cyclone: 1,
    pierce: 2,
    multishot: 2,
    ricochet: 2,
};

/** A whole number from `low` to `high`, both in. */
const roll = (low: number, high: number) =>
    low + Math.floor(Math.random() * (high - low + 1));

/** The effect an item gains at its `tier`th tenth merge, stronger each
 *  tier; the Cyclone once an item at most, and the bolts' effects on a
 *  crossbow only. */
export function rollEffect(
    tier: number,
    has: readonly ItemEffect[],
    ranged = false,
): ItemEffect {
    const kinds = (Object.keys(effectWeights) as EffectKind[]).filter(
        (kind) =>
            (kind !== "cyclone" ||
                !has.some((effect) => effect.kind === kind)) &&
            (ranged || !rangedEffects.includes(kind)),
    );
    let pick =
        Math.random() *
        kinds.reduce((sum, kind) => sum + effectWeights[kind], 0);
    const kind =
        kinds.find((each) => (pick -= effectWeights[each]) < 0) ?? kinds[0];
    switch (kind) {
        case "poison":
            return { kind, value: tier * roll(15, 30) };
        case "burn":
            return { kind, value: tier * roll(35, 60) };
        case "leech":
            return { kind, value: tier * roll(2, 4) };
        case "frenzy":
            return { kind, value: tier * roll(5, 10) };
        case "cyclone":
            return { kind, value: 0 };
        //  One more a roll, and another every third tier.
        case "pierce":
        case "multishot":
        case "ricochet":
            return { kind, value: 1 + Math.floor((tier - 1) / 3) };
    }
}

/** The colour an item glows from +7: its latest effect's, else a pale
 *  blue. */
export const glowColors: Record<EffectKind | "plain", string> = {
    plain: "#9fd8ff",
    poison: "#8cff3a",
    burn: "#ff8a2a",
    leech: "#ff3a5a",
    frenzy: "#ffd23a",
    cyclone: "#5ae0ff",
    pierce: "#e8f0ff",
    multishot: "#ffd9a0",
    ricochet: "#8affd8",
};

/** How an item merged `plus` times with `effects` glows: its colour, and
 *  how strongly, from a soft glow at +7 to a blaze by +20; or null below
 *  +7. */
export function glowOf(plus: number, effects: readonly ItemEffect[] = []) {
    if (plus < glowFrom) return null;
    const last = effects[effects.length - 1];
    return {
        color: glowColors[last?.kind ?? "plain"],
        strength: Math.min(1, 0.3 + 0.05 * (plus - glowFrom)),
    };
}

/** One line on what an effect does. */
export function describeEffect({ kind, value }: ItemEffect) {
    switch (kind) {
        case "poison":
            return `Hits poison for ${value} a second over ${poisonSeconds} s`;
        case "burn":
            return `Hits burn for ${value} a second over ${burnSeconds} s`;
        case "leech":
            return `Heals ${value}% of the damage she deals`;
        case "frenzy":
            return `+${value}% attack speed`;
        case "cyclone":
            return "Skill: Cyclone";
        case "pierce":
            return `Bolts pierce ${value} more`;
        case "multishot":
            return `+${value} bolt${value > 1 ? "s" : ""} each shot`;
        case "ricochet":
            return `Bolts ricochet ${value} time${value > 1 ? "s" : ""}`;
    }
}

/** Gold the store pays for one: by its rarity, and half again for each
 *  merge in it. */
export function sellPrice(id: ItemId, mods: Mods = {}) {
    const item = itemDef(id);
    if (!item.slot) return 8;
    const base = {
        common: 10,
        uncommon: 30,
        rare: 80,
        epic: 200,
        legendary: 500,
    }[rarityOf(id, mods)];
    return Math.round(base * (1 + 0.5 * (mods.plus ?? 0)));
}

/** What the store sells, and its price. Potions for now. */
export const storeStock: { item: ItemId; price: number }[] = [
    { item: "redPotion", price: 25 },
];

/** One line on what an item gives, for the bag: its kind is told apart. */
export function describeItem(id: ItemId, mods: Mods = {}) {
    const item = pieceDef(id, mods);
    const parts: string[] = [];
    if (item.damage) parts.push(`+${item.damage} damage`);
    if (item.armor) parts.push(`+${item.armor} armor`);
    if (item.health) parts.push(`+${item.health} HP`);
    if (item.stamina) parts.push(`+${item.stamina} stamina`);
    if (item.staminaRecovery)
        parts.push(`+${item.staminaRecovery}% stamina recovery`);
    if (item.pierce) parts.push(`pierce ${item.pierce}`);
    if (item.multishot)
        parts.push(`+${item.multishot} bolt${item.multishot > 1 ? "s" : ""}`);
    if (item.ricochet) parts.push(`ricochet ${item.ricochet}`);
    for (const [stat, amount] of Object.entries(item.bonus ?? {}))
        parts.push(`+${amount} ${stat.toUpperCase()}`);
    if (item.heal) parts.push(`Restores ${item.heal} HP`);
    return parts.join(" · ");
}

type DropTable = {
    gold: [number, number];
    /** Each item and the chance, 0 to 1, that one drops. */
    items: [ItemId, number][];
};

export const dropTables: Record<MonsterKindName, DropTable> = {
    mossSlime: {
        gold: [2, 6],
        items: [
            ["redPotion", 0.25],
            ["leatherCap", 0.08],
            ["woodenBuckler", 0.04],
            ["ironSword", 0.04],
            ["huntersBow", 0.04],
            ["arcaneRobes", 0.015],
            ["arcaneGloves", 0.02],
            ["arcaneBoots", 0.02],
            ["knightPlate", 0.015],
            ["knightGauntlets", 0.02],
            ["knightGreaves", 0.02],
            ["mossSword", 0.01],
        ],
    },
    emberSlime: {
        gold: [8, 16],
        items: [
            ["redPotion", 0.35],
            ["ironHelm", 0.08],
            ["featherHat", 0.07],
            ["ironKite", 0.06],
            ["emberBlade", 0.04],
            ["emberLongbow", 0.04],
            ["battleMageCoat", 0.02],
            ["battleMageGloves", 0.03],
            ["battleMageBoots", 0.03],
            ["knightPlate", 0.03],
            ["knightGauntlets", 0.03],
            ["knightGreaves", 0.03],
        ],
    },
    //  A boss's drops are its reward: a stack of potions and gear at
    //  better odds, the best of it certain.
    mossKing: {
        gold: [60, 110],
        items: [
            ["redPotion", 1],
            ["redPotion", 1],
            ["mossSword", 0.45],
            ["ironSword", 0.5],
            ["huntersBow", 0.5],
            ["ironKite", 0.35],
            ["ironHelm", 0.35],
            ["featherHat", 0.25],
            ["battleMageCoat", 0.3],
            ["battleMageGloves", 0.35],
            ["battleMageBoots", 0.35],
            ["catHeadset", 0.25],
        ],
    },
    emberTyrant: {
        gold: [180, 300],
        items: [
            ["redPotion", 1],
            ["redPotion", 1],
            ["redPotion", 1],
            ["emberBlade", 0.6],
            ["emberLongbow", 0.6],
            ["ironKite", 0.5],
            ["featherHat", 0.5],
            ["ironHelm", 0.5],
            ["berserkerHarness", 0.45],
            ["berserkerGauntlets", 0.5],
            ["berserkerBoots", 0.5],
            ["battleMageCoat", 0.3],
            ["catHeadset", 0.3],
        ],
    },
    //  The far zones pay in gold and potions, and give the rare sets at
    //  better odds the further out they are.
    duskBat: {
        gold: [20, 36],
        items: [
            ["redPotion", 0.4],
            ["rangerTunic", 0.03],
            ["rangerBracers", 0.04],
            ["rangerBoots", 0.04],
            ["featherHat", 0.05],
            ["battleMageGloves", 0.04],
            ["battleMageBoots", 0.04],
            ["catHeadset", 0.02],
        ],
    },
    caveSkitter: {
        gold: [28, 48],
        items: [
            ["redPotion", 0.45],
            ["rangerTunic", 0.03],
            ["rangerBracers", 0.03],
            ["rangerBoots", 0.03],
            ["scoutBracers", 0.015],
            ["emberBlade", 0.04],
            ["emberLongbow", 0.04],
            ["berserkerGauntlets", 0.03],
            ["berserkerBoots", 0.03],
            ["catHeadset", 0.02],
        ],
    },
    barrowHusk: {
        gold: [45, 80],
        items: [
            ["redPotion", 0.5],
            ["scoutJacket", 0.02],
            ["scoutBracers", 0.03],
            ["scoutBoots", 0.03],
            ["berserkerGauntlets", 0.03],
            ["berserkerBoots", 0.03],
            ["catHeadset", 0.02],
            ["berserkerHarness", 0.03],
        ],
    },
    ashBrute: {
        gold: [70, 120],
        items: [
            ["redPotion", 0.55],
            ["redPotion", 0.25],
            ["berserkerHarness", 0.05],
            ["berserkerGauntlets", 0.05],
            ["berserkerBoots", 0.05],
            ["catHeadset", 0.03],
            ["emberBlade", 0.05],
            ["emberLongbow", 0.05],
        ],
    },
    duskMonarch: {
        gold: [260, 420],
        items: [
            ["redPotion", 1],
            ["redPotion", 1],
            ["redPotion", 1],
            ["rangerTunic", 0.5],
            ["rangerBracers", 0.5],
            ["rangerBoots", 0.5],
            ["featherHat", 0.5],
            ["battleMageCoat", 0.45],
            ["battleMageGloves", 0.5],
            ["battleMageBoots", 0.5],
            ["catHeadset", 0.4],
            ["emberLongbow", 0.35],
        ],
    },
    broodQueen: {
        gold: [340, 540],
        items: [
            ["redPotion", 1],
            ["redPotion", 1],
            ["redPotion", 1],
            ["scoutJacket", 0.4],
            ["scoutBracers", 0.45],
            ["scoutBoots", 0.45],
            ["emberBlade", 0.45],
            ["emberLongbow", 0.45],
            ["berserkerHarness", 0.4],
            ["berserkerGauntlets", 0.45],
            ["berserkerBoots", 0.45],
            ["catHeadset", 0.3],
        ],
    },
    barrowKing: {
        gold: [550, 850],
        items: [
            ["scoutJacket", 0.5],
            ["scoutBracers", 0.5],
            ["scoutBoots", 0.5],
            ["redPotion", 1],
            ["redPotion", 1],
            ["redPotion", 1],
            ["redPotion", 1],
            ["battleMageCoat", 0.5],
            ["berserkerGauntlets", 0.5],
            ["berserkerBoots", 0.5],
            ["ironKite", 0.5],
            ["ironHelm", 0.5],
            ["berserkerHarness", 0.3],
        ],
    },
    ashWarlord: {
        gold: [900, 1400],
        items: [
            ["redPotion", 1],
            ["redPotion", 1],
            ["redPotion", 1],
            ["redPotion", 1],
            ["berserkerHarness", 0.7],
            ["berserkerGauntlets", 0.7],
            ["berserkerBoots", 0.7],
            ["battleMageCoat", 0.5],
            ["battleMageGloves", 0.5],
            ["battleMageBoots", 0.5],
            ["emberBlade", 0.6],
            ["emberLongbow", 0.6],
            ["catHeadset", 0.5],
        ],
    },
};

/** What a slain monster of `kind` drops: gold, and each item that rolls. */
export function rollDrops(kind: MonsterKindName) {
    const table = dropTables[kind];
    const [least, most] = table.gold;
    const gold = least + Math.floor(Math.random() * (most - least + 1));
    const dropped = table.items
        .filter(([, chance]) => Math.random() < chance)
        .map(([id]) => id);
    return { gold, items: dropped };
}
