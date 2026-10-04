import type { Entity, World } from "koota";
import {
    addStatModifier,
    maxHealthStat,
    removeStatModifiers,
    readStat,
    type StatModifier,
} from "@spawnite/engine/core";
import {
    addElementPoints,
    chooseFirstElement,
    countElements,
    Element,
    elementList,
    isElement,
    rarityPoints,
    readElementLevel,
    readHeldElements,
    secondElementWave,
    secondElementWaveAlone,
    takeElement,
    topLevel,
} from "./elements";
import { readLedger, spendCoins } from "./coins";
import { drawIndex, drawRandom, type Seeded } from "./random";
import { WardenStat } from "./stats";
import {
    type CardOffer,
    LedgerTrait,
    Rarity,
    WardenElementsTrait,
    WardenTrait,
} from "./traits";
import { isConnected, queryWardens } from "./wardens";

//  The upgrade cards: three drawn for each warden when a wave is held, one
//  taken. A card is data: the modifiers it adds to her stats, which the
//  shots, the coins and her stride already read, at the step its rarity
//  sets; an element, which she picks before the run and a second time as
//  the night deepens; or an element card, which fills the line of an
//  element she holds by the points its rarity sets, toward its levels.

export enum CardId {
    HeavyRounds = "heavy-rounds",
    HairTrigger = "hair-trigger",
    FleetFoot = "fleet-foot",
    IronHeart = "iron-heart",
    MidasTouch = "midas-touch",
    SecondWind = "second-wind",
    FieldMedic = "field-medic",
    StormLance = "storm-lance",
    Marksman = "marksman",
    Attunement = "attunement",
    Storm = "storm",
    Ember = "ember",
    Frost = "frost",
    StormSurge = "storm-surge",
    EmberSurge = "ember-surge",
    FrostSurge = "frost-surge",
}

/** One modifier a card adds, and the stat it goes on. */
interface CardModifier {
    stat: string;
    modifier: Omit<StatModifier, "source">;
}

export interface Card {
    title: string;
    /** What taking it does, in a line, at the step its rarity sets: 1 for
     *  a common. */
    text: (step: number) => string;
    modifiers: CardModifier[];
    /** Times one warden may take it in a run. */
    limit: number;
    /** Whether a rare or an epic of it is dealt, with a bigger step: not
     *  for a card whose step is a whole count. */
    grows?: boolean;
    /** The element it gives, for an element's pick. */
    element?: Element;
    /** The element whose line it fills, for an element card: by the
     *  points its rarity sets. */
    line?: Element;
    /** The rarity it is always dealt at, as Midas Touch's. */
    rarity?: Rarity;
}

//  Steps sized for many small cards: a warden who buys one or two a
//  breather takes thirty or more a night, so each common is about three
//  fifths of what one card a breather wanted, and each may be taken more
//  often.

/** Health the health card adds to her greatest health, and fills. */
const ironHeartHealth = 15;

/** Times a common's step each rarity's is. */
export const raritySteps: Record<Rarity, number> = {
    [Rarity.Common]: 1,
    [Rarity.Rare]: 1.6,
    [Rarity.Epic]: 2.4,
};

/** Chances a card that grows is dealt rare or epic; the rest are
 *  commons. */
const rareChance = 0.22;
const epicChance = 0.06;

/** A share as a whole percentage. */
function percent(share: number) {
    return `${Math.round(share * 100)}%`;
}

/** A number to one decimal where it has one. */
export function trim(value: number) {
    return `${Math.round(value * 10) / 10}`;
}

export const cards: Record<CardId, Card> = {
    [CardId.HeavyRounds]: {
        title: "Heavy Rounds",
        text: (step) =>
            `Your shots and your element hit ${percent(0.15 * step)} harder.`,
        modifiers: [{ stat: WardenStat.Damage, modifier: { percent: 0.15 } }],
        limit: 14,
        grows: true,
    },
    [CardId.HairTrigger]: {
        title: "Hair Trigger",
        text: (step) => `Fire ${percent(0.12 * step)} faster.`,
        modifiers: [{ stat: WardenStat.FireRate, modifier: { percent: 0.12 } }],
        limit: 14,
        grows: true,
    },
    [CardId.FleetFoot]: {
        title: "Fleet Foot",
        text: (step) => `Run ${percent(0.07 * step)} faster.`,
        modifiers: [{ stat: WardenStat.Speed, modifier: { percent: 0.07 } }],
        limit: 8,
        grows: true,
    },
    [CardId.IronHeart]: {
        title: "Iron Heart",
        text: (step) => {
            const health = Math.round(ironHeartHealth * step);
            return `${health} more health, and heal ${health}.`;
        },
        modifiers: [
            { stat: maxHealthStat, modifier: { flat: ironHeartHealth } },
        ],
        limit: 14,
        grows: true,
    },
    [CardId.MidasTouch]: {
        title: "Midas Touch",
        text: () =>
            "Your own coins are worth 25% more. It pays off over the night.",
        modifiers: [
            { stat: WardenStat.CoinValue, modifier: { percent: 0.25 } },
        ],
        limit: 2,
        rarity: Rarity.Rare,
    },
    [CardId.SecondWind]: {
        title: "Second Wind",
        text: (step) => `Heal ${trim(1.2 * step)} health a second.`,
        modifiers: [{ stat: WardenStat.Regen, modifier: { flat: 1.2 } }],
        limit: 8,
        grows: true,
    },
    [CardId.FieldMedic]: {
        title: "Field Medic",
        text: (step) =>
            `Get a downed warden up ${trim(1 + 0.6 * step)} times as fast.`,
        modifiers: [
            { stat: WardenStat.ReviveRate, modifier: { percent: 0.6 } },
        ],
        limit: 3,
        grows: true,
    },
    [CardId.Marksman]: {
        title: "Marksman",
        text: (step) =>
            `Your weak-spot hits deal ${percent(0.25 * step)} more.`,
        modifiers: [
            { stat: WardenStat.WeakSpotDamage, modifier: { percent: 0.25 } },
        ],
        limit: 14,
        grows: true,
    },
    [CardId.Attunement]: {
        title: "Attunement",
        text: (step) =>
            `Your element's arcs, burns and bursts hit ${percent(0.25 * step)} harder.`,
        modifiers: [
            { stat: WardenStat.ElementPower, modifier: { percent: 0.25 } },
        ],
        limit: 14,
        grows: true,
    },
    [CardId.StormLance]: {
        title: "Lance",
        text: () =>
            "Right-click: a heavy lance through up to 13 monsters in a line.",
        modifiers: [
            { stat: WardenStat.LanceDamage, modifier: { flat: 40 } },
            { stat: WardenStat.LanceRate, modifier: { flat: 0.75 } },
        ],
        limit: 1,
    },
    [CardId.Storm]: {
        title: "Storm",
        text: () => "Your hits arc to the monsters near them.",
        modifiers: [],
        limit: 1,
        element: Element.Storm,
    },
    [CardId.Ember]: {
        title: "Ember",
        text: () => "Your hits burn, harder the more they stack.",
        modifiers: [],
        limit: 1,
        element: Element.Ember,
    },
    [CardId.Frost]: {
        title: "Frost",
        text: () => "Your hits chill, and enough chill freezes.",
        modifiers: [],
        limit: 1,
        element: Element.Frost,
    },
    [CardId.StormSurge]: {
        title: "Storm Surge",
        text: () =>
            "Fills your Storm line, toward Forked Storm and Thunderhead.",
        modifiers: [],
        limit: Infinity,
        grows: true,
        line: Element.Storm,
    },
    [CardId.EmberSurge]: {
        title: "Ember Surge",
        text: () => "Fills your Ember line, toward Wildfire and Meltdown.",
        modifiers: [],
        limit: Infinity,
        grows: true,
        line: Element.Ember,
    },
    [CardId.FrostSurge]: {
        title: "Frost Surge",
        text: () => "Fills your Frost line, toward Deep Freeze and Shatter.",
        modifiers: [],
        limit: Infinity,
        grows: true,
        line: Element.Frost,
    },
};

const cardIds = Object.values(CardId);

/** The card that gives each element. */
export const elementCards: Record<Element, CardId> = {
    [Element.Storm]: CardId.Storm,
    [Element.Ember]: CardId.Ember,
    [Element.Frost]: CardId.Frost,
};

/** The element card that fills each element's line. */
export const lineCards: Record<Element, CardId> = {
    [Element.Storm]: CardId.StormSurge,
    [Element.Ember]: CardId.EmberSurge,
    [Element.Frost]: CardId.FrostSurge,
};

/** Cards dealt to each warden when a wave is held. */
export const offerSize = 3;
/** The chance an offer holds the element card of each element she holds
 *  below its capstone. At about a point a breather, free picks alone reach
 *  the capstone around wave 12, as lines.test.ts measures. */
export const lineChance = 0.7;

export function isCardId(id: string): id is CardId {
    //  Widened to the list's own element type, which `includes` asks for.
    return (cardIds as string[]).includes(id);
}

/** The card an id names, as a stream carries it; undefined for none. */
export function readCard(id: string): Card | undefined {
    return isCardId(id) ? cards[id] : undefined;
}

/** Whether the card `id` names picks an element rather than filling a
 *  line or raising a stat. */
export function isElementPick(id: string) {
    return readCard(id)?.element !== undefined;
}

/** Each card `ids` names, offered as a common, or at the rarity it is
 *  always dealt at. */
export function offerCards(ids: readonly string[]): CardOffer[] {
    return ids.map((card) => ({
        card,
        rarity: readCard(card)?.rarity ?? Rarity.Common,
    }));
}

/** Whether `warden` may be dealt the stat card `id` now: under its limit.
 *  An element is dealt only in its own pick, and an element card by its
 *  own chance. */
function isOpen(id: CardId, taken: readonly string[]) {
    const card = cards[id];
    if (card.element || card.line) return false;
    return taken.filter((held) => held === id).length < card.limit;
}

/** The rarity a card of `id` is dealt at: for a card that grows a draw,
 *  mostly common. */
function drawRarity(seeded: Seeded, id: CardId) {
    const card = cards[id];
    if (card.rarity) return card.rarity;
    if (!card.grows) return Rarity.Common;
    const roll = drawRandom(seeded);
    if (roll < epicChance) return Rarity.Epic;
    if (roll < epicChance + rareChance) return Rarity.Rare;
    return Rarity.Common;
}

/** The elements `warden` holds, reused by every draw. */
const heldElements: Element[] = [];

/** Three different cards for `warden`, each at its rarity: the element
 *  card of each element she holds below its capstone at its chance, in a
 *  slot of its own, and stat cards she has not taken to their limit for
 *  the rest, none of `past` where enough others are open. */
function drawOffer(
    seeded: Seeded,
    warden: Entity,
    past: readonly string[] = [],
): CardOffer[] {
    const lines: CardOffer[] = [];
    for (const element of readHeldElements(warden, heldElements)) {
        if (readElementLevel(warden, element) >= topLevel) continue;
        if (drawRandom(seeded) >= lineChance) continue;
        const card = lineCards[element];
        lines.push({ card, rarity: drawRarity(seeded, card) });
    }
    const taken = warden.get(WardenTrait)?.cards ?? [];
    const allowed = cardIds.filter((id) => isOpen(id, taken));
    const fresh = allowed.filter((id) => !past.includes(id));
    const open = fresh.length >= offerSize - lines.length ? fresh : allowed;
    const offer: CardOffer[] = [];
    while (offer.length + lines.length < offerSize && open.length > 0) {
        const [card] = open.splice(drawIndex(seeded, open.length), 1);
        offer.push({ card, rarity: drawRarity(seeded, card) });
    }
    for (const line of lines)
        offer.splice(drawIndex(seeded, offer.length + 1), 0, line);
    return offer;
}

/** The element picks for `warden`: every element she does not hold, in
 *  their order. */
function offerElements(warden: Entity): CardOffer[] {
    return offerCards(
        elementList
            .filter((element) => readElementLevel(warden, element) === 0)
            .map((element) => elementCards[element]),
    );
}

/** Where the run stands as a warden is dealt: the siege's draws, the wave
 *  last held, and whether she holds the circle alone. */
export interface Dealing {
    seeded: Seeded;
    wave: number;
    alone: boolean;
}

/** Whether a warden holding one element is owed her second: after the
 *  wave-10 colossus, or the wave-5 one for a warden alone. */
function isSecondElementOwed(warden: Entity, { wave, alone }: Dealing) {
    return (
        countElements(warden) === 1 &&
        wave >= (alone ? secondElementWaveAlone : secondElementWave)
    );
}

/** The modifiers' source for `id`: one per card, so a new run takes each
 *  card off whatever times she took it. */
function readSource(id: CardId) {
    return `card:${id}`;
}

/** Takes every card off her, as a new run starts: her stats back at their
 *  bases. */
export function dropCards(warden: Entity) {
    for (const id of cardIds) removeStatModifiers(warden, readSource(id));
    warden.set(WardenTrait, { cards: [], offer: [], taken: "" });
}

/** Deals `warden` her next offer: her element where she holds none, her
 *  second where it is owed, or three cards. */
export function dealOffer(warden: Entity, dealing: Dealing) {
    const offer =
        countElements(warden) === 0 || isSecondElementOwed(warden, dealing)
            ? offerElements(warden)
            : drawOffer(dealing.seeded, warden);
    warden.set(WardenTrait, { offer, taken: "", rerolls: 0, bought: [] });
}

/** Deals `warden` three fresh cards in place of her offer, others than
 *  those where enough are open, a reroll she paid for, which makes the
 *  next dearer. A free card she took stays taken, so the new three are
 *  hers to buy. */
export function rerollOffer(warden: Entity, seeded: Seeded) {
    const survivor = warden.get(WardenTrait);
    const rerolls = survivor?.rerolls ?? 0;
    const past = survivor?.offer.map(({ card }) => card) ?? [];
    warden.set(WardenTrait, {
        offer: drawOffer(seeded, warden, past),
        rerolls: rerolls + 1,
        bought: [],
    });
}

/** Coins a card of `rarity` costs after the free one, against 40 coins,
 *  what one warden with no Midas Touch earns in an average wave of the
 *  first ten, as bot runs measure it: a common half of that, a rare all
 *  of it, an epic twice. */
export const cardPrices: Record<Rarity, number> = {
    [Rarity.Common]: 20,
    [Rarity.Rare]: 40,
    [Rarity.Epic]: 80,
};

/** Coins a card of `rarity` costs after the free one. */
export function readCardPrice(rarity: Rarity) {
    return cardPrices[rarity];
}

/** Adds the card `offered` to her: its modifiers on her stats at the step
 *  its rarity sets, or its element, and on her list. A card that raises
 *  her greatest health fills what it adds. */
function applyCard(warden: Entity, offered: CardOffer) {
    const survivor = warden.get(WardenTrait);
    const id = offered.card;
    if (!survivor || !isCardId(id)) return;
    const card = cards[id];
    const step = card.grows ? (raritySteps[offered.rarity] ?? 1) : 1;
    if (card.element) takeElement(warden, card.element);
    if (card.line)
        addElementPoints(warden, card.line, rarityPoints[offered.rarity] ?? 1);
    for (const { stat, modifier } of card.modifiers)
        addStatModifier(warden, stat, {
            ...(modifier.flat !== undefined && { flat: modifier.flat * step }),
            ...(modifier.percent !== undefined && {
                percent: modifier.percent * step,
            }),
            ...(modifier.more !== undefined && { more: modifier.more }),
            source: readSource(id),
        });
    const maximum = readStat(warden, maxHealthStat) ?? survivor.maximum;
    warden.set(WardenTrait, {
        //  An element she picks is her badge, not one of her cards.
        cards: isElementPick(id) ? survivor.cards : [...survivor.cards, id],
        maximum,
        health: survivor.health + Math.max(0, maximum - survivor.maximum),
    });
}

/** Buys the card in `slot` of her offer at its rarity's price, once she
 *  has taken her free card: another card than the free one and those she
 *  bought, never an element's pick, and within her wallet. */
export function buyCard(warden: Entity, slot: number) {
    const survivor = warden.get(WardenTrait);
    const offered = survivor?.offer[slot];
    if (!survivor || !offered || survivor.taken === "") return false;
    if (offered.card === survivor.taken) return false;
    if (survivor.bought.includes(offered.card)) return false;
    if (isElementPick(offered.card)) return false;
    if (!spendCoins(warden, readCardPrice(offered.rarity))) return false;
    applyCard(warden, offered);
    warden.set(WardenTrait, { bought: [...survivor.bought, offered.card] });
    warden.set(LedgerTrait, { cards: readLedger(warden).cards + 1 });
    return true;
}

/** Deals each warden her offer for the breather. One still taking the
 *  cards she missed takes this breather's after them. */
export function dealCards(
    world: World,
    { seeded, wave }: Omit<Dealing, "alone">,
) {
    const wardens = queryWardens(world);
    //  Alone as the self-revive counts it: the only one connected.
    const alone = wardens.filter(isConnected).length === 1;
    for (const warden of wardens) {
        const catchUp = warden.get(WardenTrait)?.catchUp ?? 0;
        if (catchUp > 0) warden.set(WardenTrait, { catchUp: catchUp + 1 });
        else
            dealOffer(warden, {
                seeded,
                wave,
                //  A warden whose connection dropped is not the one alone.
                alone: alone && isConnected(warden),
            });
    }
}

/** Offers `warden` her element as the wardens gather, the one she holds
 *  already marked as taken, so she may keep it or change it. */
export function offerFirstElement(warden: Entity) {
    if (!warden.has(WardenTrait)) return;
    const first = warden.get(WardenElementsTrait)?.first ?? "";
    warden.set(WardenTrait, {
        offer: offerCards(elementList.map((element) => elementCards[element])),
        taken: isElement(first) ? elementCards[first] : "",
    });
}

/** Takes the element in `slot` of her gathering offer, in place of the
 *  one she holds. */
export function chooseElementCard(warden: Entity, slot: number) {
    const id = warden.get(WardenTrait)?.offer[slot]?.card;
    const element = id === undefined ? undefined : readCard(id)?.element;
    if (!id || !element) return;
    chooseFirstElement(warden, element);
    warden.set(WardenTrait, { taken: id });
}

/** Takes the card in `slot` of her offer, where she has one and has not
 *  taken one this breather: its modifiers on her stats at the step its
 *  rarity sets, its element, or its points on her element's line, and on
 *  her list. A card that raises her greatest health fills what it adds. */
export function pickCard(warden: Entity, slot: number) {
    const survivor = warden.get(WardenTrait);
    const offered = survivor?.offer[slot];
    if (!survivor || survivor.taken !== "" || offered === undefined) return;
    if (!isCardId(offered.card)) return;
    applyCard(warden, offered);
    warden.set(WardenTrait, { taken: offered.card });
}

/** As the next wave opens: gives each warden who took none a card of her
 *  offer, and puts every offer away, but a late joiner's, whose cards go on
 *  through the wave. */
export function closeOffers(world: World, seeded: Seeded) {
    for (const warden of queryWardens(world)) {
        const survivor = warden.get(WardenTrait);
        if (!survivor || survivor.catchUp > 0) continue;
        if (survivor.taken === "" && survivor.offer.length > 0)
            pickCard(warden, drawIndex(seeded, survivor.offer.length));
        warden.set(WardenTrait, { offer: [], taken: "", bought: [] });
    }
}

/** Gives a warden who comes to a run with no element one at random, as an
 *  unmade pick is made for her. */
export function drawElement(seeded: Seeded, warden: Entity) {
    if (countElements(warden) > 0) return;
    takeElement(warden, elementList[drawIndex(seeded, elementList.length)]);
}
