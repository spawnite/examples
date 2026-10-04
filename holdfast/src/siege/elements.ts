import type { Entity } from "koota";
import {
    readWeaponNumber,
    WeaponKind,
    WeaponNumber,
    type WeaponSettings,
} from "@spawnite/engine/core";
import { WardenStat } from "./stats";
import { MonsterKind, Rarity, WardenElementsTrait } from "./traits";

//  The three elements a warden fights with, their levels, and the numbers
//  each works by. Every hit of a gun carries a dose, a share of what one
//  pull applies, so every gun works each element at the same strength per
//  second: the element decides what a hit does, and the gun where it lands.

export enum Element {
    /** Crowds: a hit arcs to the monsters near it. */
    Storm = "storm",
    /** One big target: a hit adds burn, which ticks harder as it stacks. */
    Ember = "ember",
    /** Control: a hit chills, and enough chill freezes. */
    Frost = "frost",
}

export const elementList: readonly Element[] = [
    Element.Storm,
    Element.Ember,
    Element.Frost,
];

/** Levels an element climbs to: the last is its capstone. */
export const topLevel = 3;
/** The points on an element's line at which each level begins, by level:
 *  picking it is level 1, and its cards fill the line from there. */
export const levelPoints: readonly number[] = [0, 0, 4, 10];
/** The points an element card adds to its line, by its rarity. */
export const rarityPoints: Record<Rarity, number> = {
    [Rarity.Common]: 1,
    [Rarity.Rare]: 2,
    [Rarity.Epic]: 4,
};
/** The most elements a warden holds, Endless included. */
export const mostElements = 2;

/** The wave after whose colossus each warden picks a second element, and
 *  the one for a warden alone. */
export const secondElementWave = 10;
export const secondElementWaveAlone = 5;

/** One level of Storm: how many monsters an arc leaps through, how far
 *  each leap reaches, and the health each takes. */
export interface StormLevel {
    jumps: number;
    metres: number;
    damage: number;
}

/** One level of Ember: the share of full burn a whole dose adds, and the
 *  health a second full burn takes, flat and as a share of the monster's
 *  greatest health, so a colossus burns as hard for its size as a brute. */
export interface EmberLevel {
    build: number;
    flat: number;
    share: number;
}

/** One level of Frost: the share of full chill a whole dose adds, and the
 *  seconds a husk stays frozen. */
export interface FrostLevel {
    build: number;
    freezeSeconds: number;
}

export const stormLevels: readonly StormLevel[] = [
    { jumps: 2, metres: 5, damage: 8 },
    { jumps: 3, metres: 6, damage: 10 },
    { jumps: 4, metres: 6.5, damage: 12 },
];

//  Full burn's flat part is about a third of the blaster's 60 a second at
//  each level, so a burning brute loses about what Storm's arcs take from
//  a crowd; the share is what a colossus burns for its size.
export const emberLevels: readonly EmberLevel[] = [
    { build: 1, flat: 16, share: 0.025 },
    { build: 1.2, flat: 22, share: 0.035 },
    { build: 1.4, flat: 28, share: 0.045 },
];

export const frostLevels: readonly FrostLevel[] = [
    { build: 6, freezeSeconds: 1.5 },
    { build: 7.2, freezeSeconds: 2 },
    { build: 8.4, freezeSeconds: 2.5 },
];

/** Storm's arcs a whole dose makes: a hit arcs at a chance of its dose
 *  times this, and a hit of more than one arc's dose arcs that much
 *  harder, as Risk of Rain's proc coefficient scales an item by the hit. */
export const arcsPerDose = 3;

/** Burn as it fades: seconds after the last Ember hit before it starts,
 *  and the share of full burn it loses a second. */
export const burnFade = { afterSeconds: 2, perSecond: 0.15 };
/** Chill as it fades, the same way. */
export const chillFade = { afterSeconds: 1.5, perSecond: 0.3 };
/** Seconds between two ticks of burn. */
export const burnTickSeconds = 0.5;
/** Seconds of a burn's ticks each page shows as one number, so a burning
 *  crowd shows a number a monster a second rather than one a tick. */
export const burnNumberSeconds = 1;
/** Share of its speed a monster at full chill loses. */
export const chillSlow = 0.5;

/** How a kind of monster takes each element: how much more burn it
 *  needs to catch full, how much more chill it needs to freeze, and how
 *  much of the frozen time it stays frozen. A small monster catches full
 *  in a hit or two, so it wears a mark before it falls. */
interface ElementResistance {
    burn: number;
    chill: number;
    freeze: number;
}

export const elementResistances: Record<MonsterKind, ElementResistance> = {
    [MonsterKind.Husk]: { burn: 0.15, chill: 1, freeze: 1 },
    [MonsterKind.Skitter]: { burn: 0.15, chill: 0.8, freeze: 1 },
    [MonsterKind.Spitter]: { burn: 0.15, chill: 1, freeze: 1 },
    [MonsterKind.Brute]: { burn: 1, chill: 2.5, freeze: 0.6 },
    [MonsterKind.Colossus]: { burn: 2, chill: 10, freeze: 0.25 },
};

/** A mark a monster wears once an element has built it up, which a
 *  different element spends in a reaction. */
export enum Mark {
    None = "",
    /** At full burn. */
    Blazing = "blazing",
    /** Frozen in place. */
    Frozen = "frozen",
}

/** The element whose hits build each mark. */
export const markElements: Record<Exclude<Mark, Mark.None>, Element> = {
    [Mark.Blazing]: Element.Ember,
    [Mark.Frozen]: Element.Frost,
};

/** Seconds a blazing mark lasts after the monster was last at full burn. A
 *  frozen mark lasts as long as the freeze. */
export const blazingSeconds = 5;
/** Seconds a monster whose mark a reaction spent can neither wear a mark
 *  nor react again. */
export const restSeconds = 4;
/** Seconds a mark glows before a different element can set it off: a
 *  reaction answers the glow, rather than landing by chance while two
 *  wardens fire at one monster. */
export const markSettleSeconds = 0.25;
/** Seconds a warden's own mark glows before her other element can set it
 *  off. With two elements she marks and answers with the same hits, and at
 *  the teammate's 0.25 s she set off 7 to 44 of her own reactions a wave
 *  after wave 10 in room bot runs (#2300): a strobe, not a spike. */
export const ownMarkSettleSeconds = 1;

/** What two elements set off when they meet on a marked monster. */
export enum Reaction {
    /** Storm on frozen: lightning through every frozen monster near. */
    ChainShock = "chain-shock",
    /** Storm on blazing: an explosion round the monster. */
    Blast = "blast",
    /** Ember on frozen, or Frost on blazing: a cloud that burns and
     *  slows. */
    SteamCloud = "steam-cloud",
}

/** The reaction `element` sets off on a monster wearing `mark`, or none
 *  where the two are the same element. */
export function findReaction(
    element: Element,
    mark: Exclude<Mark, Mark.None>,
): Reaction | undefined {
    if (markElements[mark] === element) return undefined;
    if (element === Element.Storm)
        return mark === Mark.Frozen ? Reaction.ChainShock : Reaction.Blast;
    return Reaction.SteamCloud;
}

/** Chain Shock: metres from each frozen monster to the next, the most it
 *  leaps through, and the health each takes. */
export const chainShock = { metres: 7, links: 10, damage: 40 };
/** Blast: its reach, the health each monster in it takes, and the share
 *  of its greatest health the monster it went off on takes besides. */
export const blast = { metres: 4.5, damage: 60, share: 0.08 };
/** Steam Cloud: its reach, seconds, the health a second it takes from each
 *  monster inside, and the share of speed they lose. */
export const steamCloud = { metres: 3.5, seconds: 5, perSecond: 18, slow: 0.5 };

/** Thunderhead, Storm's capstone: seconds between two bolts, the seconds
 *  after her last Storm hit she still counts as firing, the bolt's reach
 *  and the health each monster in it takes. The monster it strikes takes
 *  a whole Storm dose besides. */
export const thunderhead = {
    everySeconds: 3,
    firingSeconds: 0.5,
    metres: 2.5,
    damage: 50,
};
/** Meltdown, Ember's capstone: the share of its greatest health a monster
 *  at full burn erupts for, the reach of the eruption, and the share of
 *  that health each monster near it takes. */
export const meltdown = { share: 0.03, metres: 3, splash: 0.25 };
/** Shatter, Frost's capstone: the reach of a frozen monster's burst as it
 *  dies, and the health each monster it freezes takes. */
export const shatter = { metres: 3.5, damage: 15 };

/** A probe for her damage and element power stats alone: its damage is 1,
 *  so their modifiers read as a multiplier. */
const powerProbe: WeaponSettings = {
    kind: WeaponKind.Instant,
    damage: 1,
    range: 0,
    shotsPerSecond: 0,
    stats: { damage: [WardenStat.Damage, WardenStat.ElementPower] },
};

/** Times its own numbers her element does: her damage stat, which Heavy
 *  Rounds raises, so a card that raises her guns raises her element, and
 *  her element power, which Attunement raises for her element alone. */
export function readElementPower(warden: Entity) {
    return readWeaponNumber(powerProbe, warden, WeaponNumber.Damage);
}

/** The level `warden` holds `element` at: 0 where she holds none. */
export function readElementLevel(warden: Entity, element: Element) {
    const held = warden.get(WardenElementsTrait);
    if (!held) return 0;
    if (held.first === element) return held.firstLevel;
    if (held.second === element) return held.secondLevel;
    return 0;
}

/** The points on `warden`'s line of `element`: 0 where she holds none. */
export function readElementPoints(warden: Entity, element: Element) {
    const held = warden.get(WardenElementsTrait);
    if (!held) return 0;
    if (held.first === element) return held.firstPoints;
    if (held.second === element) return held.secondPoints;
    return 0;
}

/** The level a line with `points` on it stands at. */
function readLevelAt(points: number) {
    let level = 1;
    while (level < topLevel && points >= levelPoints[level + 1]) level++;
    return level;
}

/** Adds `points` to her line of `element`, up to the capstone's, and
 *  raises the element to the level they reach; nothing where she holds
 *  none. */
export function addElementPoints(
    warden: Entity,
    element: Element,
    points: number,
) {
    const held = warden.get(WardenElementsTrait);
    if (!held) return;
    const most = levelPoints[topLevel];
    if (held.first === element) {
        const filled = Math.min(most, held.firstPoints + points);
        warden.set(WardenElementsTrait, {
            firstPoints: filled,
            firstLevel: readLevelAt(filled),
        });
    } else if (held.second === element) {
        const filled = Math.min(most, held.secondPoints + points);
        warden.set(WardenElementsTrait, {
            secondPoints: filled,
            secondLevel: readLevelAt(filled),
        });
    }
}

/** Each element `warden` holds, first then second. Written into `into`,
 *  which it returns, so a system builds no array. */
export function readHeldElements(warden: Entity, into: Element[]) {
    into.length = 0;
    const held = warden.get(WardenElementsTrait);
    if (!held) return into;
    if (isElement(held.first)) into.push(held.first);
    if (isElement(held.second)) into.push(held.second);
    return into;
}

export function isElement(value: string): value is Element {
    return (elementList as readonly string[]).includes(value);
}

/** How many elements `warden` holds. */
export function countElements(warden: Entity) {
    const held = warden.get(WardenElementsTrait);
    if (!held) return 0;
    return (held.first === "" ? 0 : 1) + (held.second === "" ? 0 : 1);
}

/** Gives `warden` `element` at level 1, as her first where she holds none
 *  and her second where she holds one; nothing where she holds it or two
 *  already. */
export function takeElement(warden: Entity, element: Element) {
    const held = warden.get(WardenElementsTrait);
    if (!held) {
        warden.add(WardenElementsTrait({ first: element, firstLevel: 1 }));
        return;
    }
    if (held.first === element || held.second === element) return;
    if (held.first === "")
        warden.set(WardenElementsTrait, {
            first: element,
            firstLevel: 1,
            firstPoints: 0,
        });
    else if (held.second === "")
        warden.set(WardenElementsTrait, {
            second: element,
            secondLevel: 1,
            secondPoints: 0,
        });
}

/** Sets her first element to `element` at level 1, replacing the one she
 *  held: a pick while the wardens gather, which she may change. */
export function chooseFirstElement(warden: Entity, element: Element) {
    const fresh = {
        first: element,
        firstLevel: 1,
        firstPoints: 0,
        second: "",
        secondLevel: 0,
        secondPoints: 0,
    };
    if (warden.has(WardenElementsTrait)) warden.set(WardenElementsTrait, fresh);
    else warden.add(WardenElementsTrait(fresh));
}

/** Takes every element off her but her first, at level 1: what she
 *  brings to the next run's gathering, where she may change it. */
export function keepFirstElement(warden: Entity) {
    const held = warden.get(WardenElementsTrait);
    if (!held) return;
    warden.set(WardenElementsTrait, {
        firstLevel: held.first === "" ? 0 : 1,
        firstPoints: 0,
        second: "",
        secondLevel: 0,
        secondPoints: 0,
    });
}
