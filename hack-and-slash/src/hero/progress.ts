import {
    createStore,
    findPlayerHero,
    HealthTrait,
    persist,
} from "@spawnite/engine";
import type { World } from "koota";
import {
    effectEvery,
    itemDef,
    mergeChance,
    mergeCost,
    pieceDef,
    rarities,
    rarityOf,
    rollEffect,
    sellPrice,
    type ItemDef,
    type Mods,
    type EquipSlot,
    type ItemEffect,
    type ItemId,
    type SkillId,
    type WeaponKind,
} from "../items/items";
import { jobRules, readClasses, useCatalog } from "../classes/catalog";
import type { ModifierStat } from "../classes/schema";
import {
    heroClasses,
    jobLevels,
    rankOf,
    unlocked,
    whyNotLearn,
    workingSkills,
    type JobProgress,
    type LearnedSkill,
} from "./jobs";
import { defaultLook, type Look } from "./look";
import { firstPlate, isPlateFace } from "./paintFace";
import { statNames, type StatName } from "./stats";

export {
    statHints,
    statLabels,
    statNames,
    statTitles,
    type StatName,
} from "./stats";

//  The hero's progress, kept between visits as an MMO keeps a character:
//  her level, stats, gold, bag and what she wears.

/** Points each stat starts with, and the points each level up gives. */
const startingStat = 5;
export const pointsPerLevel = 5;
/** Places in the bag. */
export const bagSize = 20;

/** Experience the hero needs to go from `level` to the next. */
export function xpToNext(level: number) {
    return Math.round(20 * level ** 1.5);
}

/** Share of the level's experience a defeat takes. */
const defeatXpShare = 0.1;

type Stats = Record<StatName, number>;

export type { Mods };

/** One place in the bag: an item, how many for a potion, and what the
 *  smith has made of it. */
export type BagEntry = { key: number; item: ItemId; count: number } & Mods;

/** A skill she casts from the paw: one her gear gives, or one of her
 *  trees', by the id its class file gives it. */
export type ActiveSkillId = SkillId | (string & {});

/** What stands on one of the cat paw's pads: an item or a skill. */
export type QuickSlot = ItemId | ActiveSkillId;

export type Equipped = {
    weapon: ItemId;
    shield: ItemId | null;
    head: ItemId | null;
    /** Her armor: a set's body, its gloves and its boots, each on its own. */
    body: ItemId | null;
    hands: ItemId | null;
    feet: ItemId | null;
};

export type Progress = {
    level: number;
    xp: number;
    points: number;
    stats: Stats;
    gold: number;
    bag: BagEntry[];
    equipped: Equipped;
    /** What the smith has made of what each slot wears. */
    equippedMods: Partial<Record<EquipSlot, Mods>>;
    /** What stands on each of the cat paw's pads, for a tap or a key. */
    quickSlots: (QuickSlot | null)[];
    /** The next bag entry's key. */
    nextKey: number;
    /** How she looks, and whether the player has made her yet. */
    look: Look;
    created: boolean;
    /** Her jobs, by their class files' ids: none as an adventurer, then her
     *  first, then her second. */
    jobs: string[];
    /** The rank she knows each skill at, by its id. */
    skillRanks: Record<string, number>;
};

const fresh: Progress = {
    level: 1,
    xp: 0,
    points: 0,
    stats: {
        str: startingStat,
        dex: startingStat,
        vit: startingStat,
        agi: startingStat,
        cri: startingStat,
    },
    gold: 0,
    //  The starter kit: a sword and shield in hand, a crossbow to swap to, and a
    //  cap to try on.
    bag: [
        { key: 0, item: "shortBow", count: 1 },
        { key: 1, item: "leatherCap", count: 1 },
        { key: 2, item: "redPotion", count: 3 },
        { key: 3, item: "catHeadset", count: 1 },
    ],
    equipped: {
        weapon: "rustySword",
        shield: "woodenBuckler",
        head: null,
        //  The beginner's armor, the knight's plate.
        body: "knightPlate",
        hands: "knightGauntlets",
        feet: "knightGreaves",
    },
    equippedMods: {},
    quickSlots: ["redPotion", null, null, null],
    nextKey: 4,
    look: defaultLook,
    created: false,
    jobs: [],
    skillRanks: {},
};

export const useProgress = createStore<Progress>()(
    persist(() => fresh, {
        name: "bladebound-hero",
        version: 13,
        //  Keeps what a hero saved before looks or items existed, and hands
        //  a hero from before looks a cap to try on.
        migrate: (saved, version) => {
            const old = saved as Partial<Progress>;
            const kept: Progress = { ...fresh, ...old };
            if (version < 3)
                return {
                    ...fresh,
                    level: kept.level,
                    xp: kept.xp,
                    points: kept.points,
                    stats: kept.stats,
                };
            //  Looks from before the bald base: its hair is a wig now, and
            //  its face a painted one.
            if (version < 6)
                kept.look = {
                    ...defaultLook,
                    ...kept.look,
                    hair: 0,
                    face: kept.look.face ?? 0,
                };
            //  The wigs arrived: a bare head from before them gets the
            //  short cut.
            if (version < 7 && kept.look.hair === 0)
                kept.look = { ...kept.look, hair: 1 };
            //  The knight's plate became the beginner's armor: a hero from
            //  before wears each piece where she wears none, and carries
            //  the rest if the bag has room.
            if (version < 12) {
                const pieces = [
                    ["body", "knightPlate"],
                    ["hands", "knightGauntlets"],
                    ["feet", "knightGreaves"],
                ] as const;
                const equipped = { ...fresh.equipped, ...kept.equipped };
                for (const [slot, item] of pieces) {
                    if (equipped[slot] === item) continue;
                    if (!equipped[slot]) equipped[slot] = item;
                    else if (kept.bag.length < bagSize) {
                        kept.bag = [
                            ...kept.bag,
                            { key: kept.nextKey, item, count: 1 },
                        ];
                        kept.nextKey += 1;
                    }
                }
                kept.equipped = equipped;
            }
            //  The painted faces went into hiding: one wearing a painted
            //  face wears the first plate.
            if (!isPlateFace(kept.look.face))
                kept.look = { ...kept.look, face: firstPlate };
            //  Armor arrived: she wears none yet.
            kept.equipped = { ...fresh.equipped, ...kept.equipped };
            //  Critical arrived: it starts where every stat does.
            kept.stats = { ...fresh.stats, ...kept.stats };
            //  The creator's headset arrived: one to try on, if the bag has
            //  room.
            if (version < 10 && kept.bag.length < bagSize) {
                kept.bag = [
                    ...kept.bag,
                    { key: kept.nextKey, item: "catHeadset", count: 1 },
                ];
                kept.nextKey += 1;
            }
            //  A second weapon in her off hand now takes a skill: it goes
            //  back to her bag, if it has room, until she learns it.
            if (version < 13) {
                const off = kept.equipped.shield;
                if (off && itemDef(off).weapon && kept.bag.length < bagSize) {
                    kept.bag = [
                        ...kept.bag,
                        {
                            key: kept.nextKey,
                            item: off,
                            count: 1,
                            ...modFields(kept.equippedMods.shield ?? {}),
                        },
                    ];
                    kept.nextKey += 1;
                    kept.equipped = { ...kept.equipped, shield: null };
                    const mods = { ...kept.equippedMods };
                    delete mods.shield;
                    kept.equippedMods = mods;
                }
            }
            if (version < 4 && kept.bag.length < bagSize)
                return {
                    ...kept,
                    bag: [
                        ...kept.bag,
                        { key: kept.nextKey, item: "leatherCap", count: 1 },
                    ],
                    nextKey: kept.nextKey + 1,
                };
            return kept;
        },
    }),
);

/** How she holds a weapon in her off hand: none there; one of her main
 *  hand's kind with the skill for two; one of the other kind with the skill
 *  for mixed arms; or one she has no skill to hold, which counts for
 *  nothing. */
export type OffHand = "none" | "twin" | "mixed" | "unheld";

export function offHandOf(progress: Progress): OffHand {
    const off = progress.equipped.shield;
    const offKind = off ? itemDef(off).weapon : undefined;
    if (!offKind) return "none";
    const kind = weaponKind(progress);
    if (offKind === kind)
        return unlocked(progress, "dualWield", kind) ? "twin" : "unheld";
    return unlocked(progress, "mixedArms", kind) ||
        unlocked(progress, "mixedArms", offKind)
        ? "mixed"
        : "unheld";
}

/** Everything she wears, each as merged up, with its effects and the share
 *  of its stats she gets: all of each, but with a weapon in each hand each
 *  weapon's dual share, and none of an off-hand weapon she has no skill to
 *  hold. */
function worn(progress: Progress) {
    const { equipped, equippedMods } = progress;
    const hand = offHandOf(progress);
    const shareOf = (slot: EquipSlot, weapon: boolean) => {
        if (!weapon || hand === "none") return 1;
        if (hand === "unheld") return slot === "weapon" ? 1 : 0;
        return jobRules.dualShare;
    };
    const pieces: [EquipSlot, ItemId | null][] = [
        ["weapon", equipped.weapon],
        ["shield", equipped.shield],
        ["head", equipped.head],
        ["body", equipped.body],
        ["hands", equipped.hands],
        ["feet", equipped.feet],
    ];
    return pieces
        .filter((piece): piece is [EquipSlot, ItemId] => piece[1] !== null)
        .map(([slot, id]) => {
            const def = pieceDef(id, equippedMods[slot] ?? {});
            return {
                slot,
                def,
                effects: equippedMods[slot]?.effects ?? [],
                share: shareOf(slot, !!def.weapon),
            };
        })
        .filter((piece) => piece.share > 0);
}

/** Her stats with her gear's bonuses, each weapon's at its share, the
 *  whole rounded. */
export function totalStats(progress: Progress): Stats {
    const total = { ...progress.stats };
    for (const { def, share } of worn(progress))
        for (const stat of statNames)
            total[stat] += (def.bonus?.[stat] ?? 0) * share;
    for (const stat of statNames) total[stat] = Math.round(total[stat]);
    return total;
}

export function weaponKind(progress: Progress): WeaponKind {
    return itemDef(progress.equipped.weapon).weapon ?? "sword";
}

/** What her stats and gear make of the hero: the numbers combat reads. */
export function deriveHero(progress: Progress) {
    //  The step asks every frame; the answer changes only with her
    //  progress, whose store hands out a new object on each change, or
    //  with the classes, which the class editor changes as she plays.
    const classesVersion = useCatalog.getState().version;
    if (progress === derivedFor && classesVersion === derivedVersion && derived)
        return derived;
    derivedFor = progress;
    derivedVersion = classesVersion;
    derived = computeHero(progress);
    return derived;
}

let derivedFor: Progress | null = null;
let derivedVersion = -1;
let derived: ReturnType<typeof computeHero> | null = null;

/** Sword swings a second before AGI. */
const swordSwings = 1.4;

/** `raw` as it is up to `soft`, and past it gaining less and less toward
 *  `most`, which it never reaches: at `soft` it climbs as fast as ever, so
 *  there is no step. */
function softCap(raw: number, soft: number, most: number) {
    if (raw <= soft) return raw;
    const room = most - soft;
    return soft + room * (1 - Math.exp(-(raw - soft) / room));
}

/** Attacks a second past which AGI gains less, and the most there can be,
 *  as the creator asked; and the same for her run, in metres a second, so
 *  a great deal of AGI never outruns the camera or the fight. */
const attacksSoft = 4;
const attacksMost = 8;
const runSoft = 6;
const runMost = 9;

/** How much more often she strikes with a weapon in each hand. */
const dualPace = 1.25;
/** The most of each of a crossbow's bolt stats that counts. */
const boltMost = 6;

/** Stamina a dodge takes; the stamina she has before her gear adds, three
 *  dodges' worth; and how much comes back a second before her gear's
 *  recovery, a dodge's worth every second and a half. */
export const dodgeStamina = 30;
const baseStamina = 90;
const staminaPerSecond = 20;

/** What each modifier of `learned` adds up to, by what it raises. */
function raisedBy(learned: LearnedSkill[]) {
    return (stat: ModifierStat) =>
        learned.reduce(
            (total, { skill, rank }) =>
                total +
                skill.modifiers
                    .filter((modifier) => modifier.stat === stat)
                    .reduce(
                        (sum, modifier) => sum + modifier.perRank * rank,
                        0,
                    ),
            0,
        );
}

function computeHero(progress: Progress) {
    const kind = weaponKind(progress);
    const hand = offHandOf(progress);
    //  With mixed arms she holds both kinds: her off hand's is the other.
    const offKind: WeaponKind | null =
        hand === "mixed"
            ? (itemDef(progress.equipped.shield!).weapon ?? null)
            : null;
    const held = offKind ? [kind, offKind] : [kind];
    //  The skills she knows that work with a weapon she holds, each once.
    const learned = [
        ...new Map(
            held
                .flatMap((each) => workingSkills(progress, each))
                .map((entry) => [entry.skill.id, entry]),
        ).values(),
    ];
    const raised = raisedBy(learned);
    const stats = totalStats(progress);
    for (const stat of statNames) stats[stat] += Math.round(raised(stat));
    const pieces = worn(progress);
    //  Each piece's stat at the share of it she gets.
    const sum = (read: (item: ItemDef) => number | undefined) =>
        pieces.reduce(
            (total, { def, share }) => total + (read(def) ?? 0) * share,
            0,
        );
    //  What her gear's effects add up to, by kind, each at its piece's
    //  share.
    const effect = (effectKind: ItemEffect["kind"]) =>
        pieces.reduce(
            (total, { effects, share }) =>
                total +
                effects
                    .filter((each) => each.kind === effectKind)
                    .reduce((value, each) => value + each.value * share, 0),
            0,
        );
    //  Two of a kind: she strikes with each in turn, a quarter again as
    //  often. Each hit, with two weapons, carries each one's damage at its
    //  share.
    const dual = hand === "twin";
    const weaponDamage = sum((item) => (item.weapon ? item.damage : 0));
    //  A sword swings as its slash is drawn, 1.4 times a second before
    //  AGI, and each swing hits as hard as the two quicker swings it
    //  replaced did together in 1.4 of them, so the fight's pace holds.
    const swordWeight = 2 / swordSwings;
    //  How she strikes with a weapon of `attackKind`: as hard and as often
    //  as her stats, gear and the skills that work with it make her, and a
    //  crossbow's bolts kept to a handful so a shot stays readable.
    const strikeWith = (attackKind: WeaponKind) => {
        const own = raisedBy(workingSkills(progress, attackKind));
        const sword = attackKind === "sword";
        const attackSpeed =
            (1 + stats.agi * 0.03) *
            (1 + effect("frenzy") / 100) *
            (1 + own("attackSpeed") / 100) *
            (dual ? dualPace : 1);
        const hit =
            (sword ? 6 + stats.str * 1.5 : 5 + stats.dex * 1.5) + weaponDamage;
        const ranged = (stat: "pierce" | "multishot" | "ricochet") =>
            Math.min(
                boltMost,
                Math.round(
                    sum((item) => item[stat]) + effect(stat) + own(stat),
                ),
            );
        return {
            damage:
                (sword ? hit * swordWeight : hit) * (1 + own("damage") / 100),
            attacksPerSecond: softCap(
                (sword ? swordSwings : 1.6) * attackSpeed,
                attacksSoft,
                attacksMost,
            ),
            pierce: ranged("pierce"),
            multishot: ranged("multishot"),
            ricochet: ranged("ricochet"),
        };
    };
    return {
        stats,
        weapon: kind,
        dual,
        //  Her main hand's strike, and with mixed arms her off hand's: she
        //  slashes what is in a sword's reach, and shoots past it.
        ...strikeWith(kind),
        offWeapon: offKind,
        offStrike: offKind ? strikeWith(offKind) : null,
        maxHealth: Math.round(
            50 +
                stats.vit * 10 +
                progress.level * 5 +
                sum((item) => item.health) +
                raised("maxHealth"),
        ),
        armor: Math.round(sum((item) => item.armor) + raised("armor")),
        //  A chibi's jog: her run as it was drawn, a little quick.
        moveSpeed: softCap(
            3.6 * (1 + stats.agi * 0.01) * (1 + raised("moveSpeed") / 100),
            runSoft,
            runMost,
        ),
        maxStamina: Math.round(
            baseStamina + sum((item) => item.stamina) + raised("maxStamina"),
        ),
        //  Stamina back a second, which gear's recovery raises by its share.
        staminaRecovery:
            staminaPerSecond *
            (1 +
                (sum((item) => item.staminaRecovery) +
                    raised("staminaRecovery")) /
                    100),
        //  Her gear's effects and her skills': poison and burn a second on
        //  each monster she hits, and the share of her damage she heals.
        poison: effect("poison") + raised("poison"),
        burn: effect("burn") + raised("burn"),
        leech: (effect("leech") + raised("leech")) / 100,
        //  The skills she casts from the paw: her gear's, and those of her
        //  trees that work with a weapon she holds.
        skills: [
            ...new Set<ActiveSkillId>([
                ...pieces
                    .filter(({ effects }) =>
                        effects.some((each) => each.kind === "cyclone"),
                    )
                    .map((): SkillId => "cyclone"),
                ...learned
                    .filter(({ skill }) => skill.active)
                    .map(({ skill }) => skill.id),
            ]),
        ],
        //  The chance a hit is critical, and what a critical hit deals.
        critChance: Math.min(
            0.6,
            0.05 + stats.cri * 0.01 + raised("critChance") / 100,
        ),
        critDamage: 1.5 + stats.cri * 0.03 + raised("critDamage") / 100,
    };
}

/** Adds experience, levelling up as many times as it fills, each level up
 *  giving stat points. Returns the levels gained. */
export function gainXp(amount: number) {
    let { level, xp, points } = useProgress.getState();
    let gained = 0;
    xp += amount;
    while (xp >= xpToNext(level)) {
        xp -= xpToNext(level);
        level += 1;
        points += pointsPerLevel;
        gained += 1;
    }
    useProgress.setState({ level, xp, points });
    return gained;
}

/** Takes a share of the level's experience, never below zero: the price of
 *  a defeat. Returns what it took. */
export function loseXpOnDefeat() {
    const { level, xp } = useProgress.getState();
    const lost = Math.min(xp, Math.round(xpToNext(level) * defeatXpShare));
    useProgress.setState({ xp: xp - lost });
    return lost;
}

export function spendPoint(stat: StatName) {
    const { points, stats } = useProgress.getState();
    if (points <= 0) return;
    useProgress.setState({
        points: points - 1,
        stats: { ...stats, [stat]: stats[stat] + 1 },
    });
}

/** Learns a rank of a skill of one of her trees. Says why not, or null
 *  once learned. */
export function learnSkill(id: string) {
    const progress = useProgress.getState();
    const why = whyNotLearn(progress, id);
    if (why) return why;
    useProgress.setState({
        skillRanks: { ...progress.skillRanks, [id]: rankOf(progress, id) + 1 },
    });
    return null;
}

/** Her save with `jobs` and only the ranks of the trees those jobs give,
 *  and an off-hand weapon she can no longer hold back in her bag. Says why
 *  not when her bag has no room for it. */
function settleJobs(progress: Progress, jobs: string[], keepRanks: boolean) {
    const kept: Record<string, number> = {};
    if (keepRanks)
        for (const tree of heroClasses({ ...progress, jobs }))
            for (const skill of tree.skills)
                if (progress.skillRanks[skill.id])
                    kept[skill.id] = progress.skillRanks[skill.id];
    const next: Progress = { ...progress, jobs, skillRanks: kept };
    if (offHandOf(next) !== "unheld") return { next };
    if (progress.bag.length >= bagSize)
        return { why: "Make room in your bag for your off-hand weapon first." };
    const off = progress.equipped.shield!;
    const mods = { ...progress.equippedMods };
    const offMods = mods.shield ?? {};
    delete mods.shield;
    return {
        next: {
            ...next,
            equipped: { ...progress.equipped, shield: null },
            equippedMods: mods,
            bag: [
                ...progress.bag,
                {
                    key: progress.nextKey,
                    item: off,
                    count: 1,
                    ...modFields(offMods),
                },
            ],
            nextKey: progress.nextKey + 1,
        },
    };
}

/** Takes a job at the trainer: her first (`slot` 0) or her second, free
 *  for now, at any time once its level is reached. A job she leaves gives
 *  back the points she spent in its tree, and in the hybrid it made. Says
 *  why not, or null once taken. */
export function chooseJob(slot: number, id: string) {
    const progress = useProgress.getState();
    const job = readClasses().byId.get(id);
    if (job?.kind !== "job") return "No such job.";
    if (slot < 0 || slot >= jobLevels.length) return "No such job slot.";
    if (progress.level < jobLevels[slot])
        return `Come back at level ${jobLevels[slot]}.`;
    if (slot > progress.jobs.length) return "Take your first job first.";
    if (progress.jobs.some((each, index) => each === id && index !== slot))
        return `You are already a ${job.name}.`;
    const jobs = [...progress.jobs];
    jobs[slot] = id;
    const settled = settleJobs(progress, jobs, true);
    if (!settled.next) return settled.why;
    useProgress.setState(settled.next);
    return null;
}

/** Unlearns every skill, giving back every point, free for now. Says why
 *  not, or null once done. */
export function unlearnSkills() {
    const progress = useProgress.getState();
    const settled = settleJobs(progress, progress.jobs, false);
    if (!settled.next) return settled.why;
    useProgress.setState(settled.next);
    return null;
}

export function gainGold(amount: number) {
    useProgress.setState(({ gold }) => ({ gold: gold + amount }));
}

/** Whether an item stacks in one place, as potions do. */
export const stacks = (item: ItemId) => itemDef(item).heal !== undefined;

/** A piece's mods as a bag place's fields, none it does not have. */
const modFields = ({ rarity, extra, plus, effects }: Mods): Mods => ({
    ...(rarity ? { rarity } : {}),
    ...(extra && Object.keys(extra).length ? { extra } : {}),
    ...(plus ? { plus } : {}),
    ...(effects?.length ? { effects } : {}),
});

/** Puts an item in the bag: a potion on its stack. False when the bag has
 *  no place for it. */
export function addItem(item: ItemId, mods: Mods = {}) {
    const { bag, nextKey } = useProgress.getState();
    const stack = stacks(item) && bag.find((entry) => entry.item === item);
    if (stack) {
        useProgress.setState({
            bag: bag.map((entry) =>
                entry === stack ? { ...entry, count: entry.count + 1 } : entry,
            ),
        });
        return true;
    }
    if (bag.length >= bagSize) return false;
    useProgress.setState({
        bag: [...bag, { key: nextKey, item, count: 1, ...modFields(mods) }],
        nextKey: nextKey + 1,
    });
    return true;
}

/** Whether she may hold a weapon of `offKind` in her off hand beside one
 *  of `kind`: two of a kind with the skill for two, one of each with the
 *  skill for mixed arms. */
function holdsBeside(
    progress: JobProgress,
    kind: WeaponKind,
    offKind: WeaponKind,
) {
    return offKind === kind
        ? unlocked(progress, "dualWield", kind)
        : unlocked(progress, "mixedArms", kind) ||
              unlocked(progress, "mixedArms", offKind);
}

/** Whether `item` can go in her off hand beside what her main hand holds:
 *  a shield always, a weapon once she knows the skill to hold it there. */
export function fitsOffHand(progress: Progress, item: ItemId) {
    const def = itemDef(item);
    if (def.slot === "shield") return true;
    const kind = itemDef(progress.equipped.weapon).weapon;
    return !!def.weapon && !!kind && holdsBeside(progress, kind, def.weapon);
}

/** Wears the bag entry's item, putting what it replaces in its place: a
 *  weapon in her main hand, or with `hand` "off" in her off hand, where a
 *  shield goes. A main weapon of another kind than her off-hand weapon
 *  puts that one in the bag. */
export function equip(key: number, hand: "main" | "off" = "main") {
    const progress = useProgress.getState();
    const { bag, equipped, equippedMods, nextKey } = progress;
    const entry = bag.find((each) => each.key === key);
    let slot = entry && itemDef(entry.item).slot;
    if (!entry || !slot) return;
    if (hand === "off" && slot === "weapon") {
        if (!fitsOffHand(progress, entry.item)) return;
        slot = "shield";
    }
    const next = { ...equipped, [slot]: entry.item } as Equipped;
    const nextMods = { ...equippedMods, [slot]: modFields(entry) };
    const back: { item: ItemId; mods: Mods }[] = [];
    const replaced = equipped[slot];
    if (replaced) back.push({ item: replaced, mods: equippedMods[slot] ?? {} });
    const offWeapon = next.shield ? itemDef(next.shield).weapon : undefined;
    const mainWeapon = itemDef(next.weapon).weapon;
    if (
        offWeapon &&
        mainWeapon &&
        !holdsBeside(progress, mainWeapon, offWeapon)
    ) {
        back.push({ item: next.shield!, mods: equippedMods.shield ?? {} });
        next.shield = null;
        delete nextMods.shield;
    }
    const rest = bag.filter((each) => each !== entry);
    if (rest.length + back.length > bagSize) return;
    useProgress.setState({
        equipped: next,
        equippedMods: nextMods,
        bag: [
            ...rest,
            ...back.map(({ item, mods }, index) => ({
                key: nextKey + index,
                item,
                count: 1,
                ...modFields(mods),
            })),
        ],
        nextKey: nextKey + back.length,
    });
}

/** Takes off what the slot wears, into the bag. The weapon stays: she is
 *  never empty-handed. */
export function unequip(slot: Exclude<EquipSlot, "weapon">) {
    const { equipped, equippedMods, bag, nextKey } = useProgress.getState();
    const item = equipped[slot];
    if (!item || bag.length >= bagSize) return;
    const mods = { ...equippedMods };
    delete mods[slot];
    useProgress.setState({
        equipped: { ...equipped, [slot]: null },
        equippedMods: mods,
        bag: [
            ...bag,
            {
                key: nextKey,
                item,
                count: 1,
                ...modFields(equippedMods[slot] ?? {}),
            },
        ],
        nextKey: nextKey + 1,
    });
}

/** One of her copies of an item: worn in a slot, or in the bag. */
export type Copy = ({ slot: EquipSlot } | { key: number }) & {
    mods: Mods;
    plus: number;
    /** Its rarity's place, then its merges: the better copy is the higher. */
    rank: number;
};

const copyOf = (item: ItemId, mods: Mods) => ({
    mods,
    plus: mods.plus ?? 0,
    rank: rarities.indexOf(rarityOf(item, mods)) * 1000 + (mods.plus ?? 0),
});

/** Every copy of a piece of gear she has, worn and carried. */
export function copiesOf(progress: Progress, item: ItemId): Copy[] {
    const copies: Copy[] = [];
    for (const [slot, id] of Object.entries(progress.equipped) as [
        EquipSlot,
        ItemId | null,
    ][])
        if (id === item)
            copies.push({
                slot,
                ...copyOf(item, progress.equippedMods[slot] ?? {}),
            });
    for (const entry of progress.bag)
        if (entry.item === item)
            copies.push({ key: entry.key, ...copyOf(item, entry) });
    return copies;
}

/** The merge the smith would make of an item: her best copy kept, its
 *  rarity and bonus stats with it, merged up one past the more merged of
 *  the two, with the effects of whichever has more; and her least carried
 *  copy used up. Null without two copies, one of them carried. */
export function mergePlan(progress: Progress, item: ItemId) {
    if (stacks(item) || !itemDef(item).slot) return null;
    const copies = copiesOf(progress, item);
    const carried = copies.filter((copy) => "key" in copy);
    if (copies.length < 2 || carried.length === 0) return null;
    const used = carried.reduce((a, b) => (b.rank < a.rank ? b : a));
    //  Kept: the best of the rest, one she wears before one she carries.
    const kept = copies
        .filter((copy) => copy !== used)
        .reduce((a, b) =>
            b.rank > a.rank || (b.rank === a.rank && "slot" in b) ? b : a,
        );
    const plus = Math.max(kept.plus, used.plus);
    const keptEffects = kept.mods.effects ?? [];
    const usedEffects = used.mods.effects ?? [];
    const rarity = rarityOf(item, kept.mods);
    return {
        kept,
        used,
        plus,
        next: plus + 1,
        rarity,
        effects:
            usedEffects.length > keptEffects.length ? usedEffects : keptEffects,
        cost: mergeCost(item, plus, rarity),
        chance: mergeChance(plus),
    };
}

/** The smith's merge: the gold paid and the used copy gone, and, if it
 *  takes, the kept copy merged up past the better of the two, rolling an
 *  effect at every tenth merge. Says how it went, and the effect gained,
 *  or null when it cannot be tried. */
export function mergeItem(item: ItemId) {
    const progress = useProgress.getState();
    const plan = mergePlan(progress, item);
    if (!plan || progress.gold < plan.cost) return null;
    const { kept, used, next } = plan;
    const took = Math.random() < plan.chance;
    const gained =
        took && next % effectEvery === 0
            ? rollEffect(
                  next / effectEvery,
                  plan.effects,
                  itemDef(item).weapon === "crossbow",
              )
            : null;
    const mods: Mods = {
        ...kept.mods,
        plus: next,
        effects: gained ? [...plan.effects, gained] : plan.effects,
    };
    const usedKey = "key" in used ? used.key : null;
    let bag = progress.bag.filter((entry) => entry.key !== usedKey);
    let equippedMods = progress.equippedMods;
    if (took && "slot" in kept)
        equippedMods = { ...equippedMods, [kept.slot]: modFields(mods) };
    else if (took && "key" in kept) {
        const keptKey = kept.key;
        bag = bag.map((entry) =>
            entry.key === keptKey
                ? {
                      key: entry.key,
                      item: entry.item,
                      count: 1,
                      ...modFields(mods),
                  }
                : entry,
        );
    }
    useProgress.setState({
        bag,
        equippedMods,
        gold: progress.gold - plan.cost,
    });
    return { took, gained };
}

/** Buys one of an item for `price`: false without the gold or a place. */
export function buyItem(item: ItemId, price: number) {
    if (useProgress.getState().gold < price || !addItem(item)) return false;
    useProgress.setState(({ gold }) => ({ gold: gold - price }));
    return true;
}

/** Sells one from a place in the bag: a stack loses one. */
export function sellEntry(key: number) {
    const { bag, gold } = useProgress.getState();
    const entry = bag.find((each) => each.key === key);
    if (!entry) return;
    useProgress.setState({
        gold: gold + sellPrice(entry.item, entry),
        bag:
            entry.count > 1
                ? bag.map((each) =>
                      each === entry
                          ? { ...each, count: each.count - 1 }
                          : each,
                  )
                : bag.filter((each) => each !== entry),
    });
}

/** Puts an item or a skill on one of the paw's pads, or clears it; each
 *  stands on one pad at most. */
export function setQuickSlot(index: number, item: QuickSlot | null) {
    useProgress.setState(({ quickSlots }) => ({
        quickSlots: quickSlots.map((each, at) =>
            at === index ? item : each === item ? null : each,
        ),
    }));
}

/** Gives the hero `amount` health, up to her maximum. */
export function healHero(world: World, amount: number) {
    const health = findPlayerHero(world)?.get(HealthTrait);
    if (!health || health.current <= 0) return;
    const current = Math.min(health.maximum, health.current + amount);
    if (current !== health.current)
        findPlayerHero(world)!.set(HealthTrait, { current });
}

/** Takes one potion from the bag and returns the health it restores, or 0
 *  when there is none. */
export function takePotion() {
    const { bag } = useProgress.getState();
    const entry = bag.find((each) => itemDef(each.item).heal !== undefined);
    if (!entry) return 0;
    useProgress.setState({
        bag:
            entry.count > 1
                ? bag.map((each) =>
                      each === entry
                          ? { ...each, count: each.count - 1 }
                          : each,
                  )
                : bag.filter((each) => each !== entry),
    });
    return itemDef(entry.item).heal ?? 0;
}

export function setLook(change: Partial<Look>) {
    useProgress.setState(({ look }) => ({ look: { ...look, ...change } }));
}

export function finishCreation() {
    useProgress.setState({ created: true });
}
