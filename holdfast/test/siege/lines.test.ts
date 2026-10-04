// @vitest-environment node
import { createWorld, type Entity, type World } from "koota";
import { afterEach, expect, it } from "vitest";
import { chooseBotSlot } from "../../src/siege/bot";
import {
    CardId,
    dealOffer,
    lineCards,
    offerCards,
    pickCard,
    readCard,
} from "../../src/siege/cards";
import {
    addElementPoints,
    chooseFirstElement,
    Element,
    keepFirstElement,
    levelPoints,
    readElementLevel,
    readElementPoints,
    takeElement,
    topLevel,
} from "../../src/siege/elements";
import {
    type CardOffer,
    Rarity,
    WardenElementsTrait,
    WardenTrait,
} from "../../src/siege/traits";

//  Element lines: an element card adds points to an element she holds, by
//  its rarity, and the points raise the element's level.

const worlds: World[] = [];

afterEach(() => {
    for (const world of worlds.splice(0)) world.destroy();
});

/** A warden alone in a world of her own, holding `elements` at level 1:
 *  what the offer and a pick read of her. */
function spawnWarden(...elements: Element[]) {
    const world = createWorld();
    worlds.push(world);
    const warden = world.spawn(WardenTrait);
    for (const element of elements) takeElement(warden, element);
    return warden;
}

/** The element whose line the card `id` names fills, if it fills one. */
function readLine(id: string) {
    return readCard(id)?.line;
}

/** Takes the card `offered` for her, as a pick of the only card offered. */
function takeCard(warden: Entity, offered: CardOffer) {
    warden.set(WardenTrait, { offer: [offered], taken: "" });
    pickCard(warden, 0);
}

it("starts an element she picks at level 1 with no points", () => {
    const ada = spawnWarden(Element.Storm);

    expect(readElementLevel(ada, Element.Storm)).toBe(1);
    expect(readElementPoints(ada, Element.Storm)).toBe(0);
});

it("reaches level 2 at 4 points and the capstone at 10, and fills no further", () => {
    const ada = spawnWarden(Element.Frost);

    addElementPoints(ada, Element.Frost, 3);
    expect(readElementLevel(ada, Element.Frost)).toBe(1);
    addElementPoints(ada, Element.Frost, 1);
    expect(readElementLevel(ada, Element.Frost)).toBe(2);
    addElementPoints(ada, Element.Frost, 5);
    expect(readElementLevel(ada, Element.Frost)).toBe(2);
    addElementPoints(ada, Element.Frost, 4);

    expect(readElementLevel(ada, Element.Frost)).toBe(topLevel);
    expect(readElementPoints(ada, Element.Frost)).toBe(10);
});

it("fills the line of her second element apart from her first", () => {
    const ada = spawnWarden(Element.Storm, Element.Ember);

    addElementPoints(ada, Element.Ember, 4);

    expect(readElementLevel(ada, Element.Ember)).toBe(2);
    expect(readElementLevel(ada, Element.Storm)).toBe(1);
    expect(ada.get(WardenElementsTrait)).toMatchObject({
        firstPoints: 0,
        secondPoints: 4,
    });
});

it("adds no points to an element she does not hold", () => {
    const ada = spawnWarden(Element.Storm);

    addElementPoints(ada, Element.Frost, 4);

    expect(readElementLevel(ada, Element.Frost)).toBe(0);
    expect(readElementPoints(ada, Element.Frost)).toBe(0);
});

it("adds a common's 1 point, a rare's 2 and an epic's 4 with an element card", () => {
    const ada = spawnWarden(Element.Ember);
    const card = lineCards[Element.Ember];

    takeCard(ada, { card, rarity: Rarity.Common });
    expect(readElementPoints(ada, Element.Ember)).toBe(1);
    takeCard(ada, { card, rarity: Rarity.Rare });
    expect(readElementPoints(ada, Element.Ember)).toBe(3);
    takeCard(ada, { card, rarity: Rarity.Epic });

    expect(readElementPoints(ada, Element.Ember)).toBe(7);
    expect(readElementLevel(ada, Element.Ember)).toBe(2);
});

it("raises her element only by the points of an element card, whatever card of an offer she takes", () => {
    const world = createWorld();
    worlds.push(world);
    for (let seed = 1; seed <= 60; seed++)
        for (let slot = 0; slot < 3; slot++) {
            const ada = world.spawn(WardenTrait);
            takeElement(ada, Element.Storm);
            dealOffer(ada, { seeded: { seed }, wave: 3, alone: false });
            const offered = ada.get(WardenTrait)?.offer[slot];
            pickCard(ada, slot);

            const line = offered && readLine(offered.card);
            const points = line
                ? { common: 1, rare: 2, epic: 4 }[offered.rarity]
                : 0;
            expect(readElementPoints(ada, Element.Storm)).toBe(points);
            expect(readElementLevel(ada, Element.Storm)).toBe(
                points >= 4 ? 2 : 1,
            );
            ada.destroy();
        }
});

/** The offers dealt to `warden` over `draws` seeds, as a new breather
 *  deals each. */
function dealMany(warden: Entity, draws: number) {
    const offers: CardOffer[][] = [];
    for (let seed = 1; seed <= draws; seed++) {
        dealOffer(warden, { seeded: { seed }, wave: 3, alone: false });
        offers.push(warden.get(WardenTrait)?.offer ?? []);
    }
    return offers;
}

it("deals element cards only for the elements she holds, one of each at most, among three different cards", () => {
    const ada = spawnWarden(Element.Storm);
    const bo = spawnWarden(Element.Ember, Element.Frost);

    for (const [warden, held] of [
        [ada, [Element.Storm]],
        [bo, [Element.Ember, Element.Frost]],
    ] as const)
        for (const offer of dealMany(warden, 300)) {
            const ids = offer.map(({ card }) => card);
            expect(new Set(ids).size).toBe(3);
            const lines = ids.map(readLine).filter((line) => line);
            for (const line of lines) expect(held).toContain(line);
        }
});

it("deals an element card in most offers, at every rarity", () => {
    const ada = spawnWarden(Element.Storm);

    const dealt = dealMany(ada, 400)
        .map((offer) => offer.find(({ card }) => readLine(card)))
        .filter((line) => line !== undefined);

    expect(dealt.length / 400).toBeGreaterThan(0.5);
    const rarities = new Set(dealt.map(({ rarity }) => rarity));
    expect(rarities).toEqual(new Set(Object.values(Rarity)));
});

it("deals no element card for an element at its capstone", () => {
    const ada = spawnWarden(Element.Storm, Element.Frost);
    addElementPoints(ada, Element.Storm, levelPoints[topLevel]);

    for (const offer of dealMany(ada, 200))
        for (const { card } of offer)
            expect(readLine(card)).not.toBe(Element.Storm);
});

/** The waves a warden first fights with her second level and her capstone,
 *  taking only the free
 *  card of each breather: her first element's card whenever one is
 *  offered, her second element after the wave-10 colossus, and a stat
 *  card otherwise. */
function findLevelWaves(world: World, seed: number) {
    const ada = world.spawn(WardenTrait);
    let second = Infinity;
    takeElement(ada, Element.Frost);
    //  One state through the night, as the siege's draws run.
    const seeded = { seed };
    for (let wave = 1; wave <= 30; wave++) {
        dealOffer(ada, { seeded, wave, alone: false });
        const offer = ada.get(WardenTrait)?.offer ?? [];
        const line = offer.findIndex(
            ({ card }) => readLine(card) === Element.Frost,
        );
        pickCard(ada, Math.max(0, line));
        const level = readElementLevel(ada, Element.Frost);
        if (level >= 2 && second === Infinity) second = wave + 1;
        if (level === topLevel) {
            ada.destroy();
            return { second, capstone: wave + 1 };
        }
    }
    return { second, capstone: Infinity };
}

it("brings free picks alone to level 2 around wave 5 and the capstone around wave 12", () => {
    const world = createWorld();
    worlds.push(world);
    const nights = Array.from({ length: 301 }, (_, seed) =>
        findLevelWaves(world, seed + 1),
    );
    const median = (waves: number[]) =>
        waves.sort((a, b) => a - b)[Math.floor(waves.length / 2)];

    const second = median(nights.map((night) => night.second));
    expect(second).toBeGreaterThanOrEqual(4);
    expect(second).toBeLessThanOrEqual(6);
    const capstone = median(nights.map((night) => night.capstone));
    expect(capstone).toBeGreaterThanOrEqual(11);
    expect(capstone).toBeLessThanOrEqual(13);
});

it("empties her line with her element as the next run gathers, and as she changes her pick", () => {
    const ada = spawnWarden(Element.Storm, Element.Ember);
    addElementPoints(ada, Element.Storm, 6);
    addElementPoints(ada, Element.Ember, 2);

    keepFirstElement(ada);
    expect(ada.get(WardenElementsTrait)).toMatchObject({
        first: Element.Storm,
        firstLevel: 1,
        firstPoints: 0,
        second: "",
        secondPoints: 0,
    });

    addElementPoints(ada, Element.Storm, 5);
    chooseFirstElement(ada, Element.Frost);
    expect(readElementPoints(ada, Element.Frost)).toBe(0);
});

it("puts an element card among her cards, and her pick of an element not", () => {
    const ada = spawnWarden();

    takeCard(ada, offerCards([CardId.Frost])[0]);
    takeCard(ada, { card: lineCards[Element.Frost], rarity: Rarity.Common });

    expect(ada.get(WardenTrait)?.cards).toEqual([lineCards[Element.Frost]]);
});

it("has a bot take the rarest element card of an offer", () => {
    const offer: CardOffer[] = [
        { card: CardId.HeavyRounds, rarity: Rarity.Epic },
        { card: lineCards[Element.Storm], rarity: Rarity.Common },
        { card: lineCards[Element.Frost], rarity: Rarity.Rare },
    ];

    expect(chooseBotSlot(offer, 0)).toBe(2);
});
