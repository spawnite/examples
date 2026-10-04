// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import {
    DisconnectedTrait,
    fixedStepSeconds,
    MovementTrait,
    readWeaponNumber,
    WeaponNumber,
} from "@spawnite/engine";
import { blasterSettings } from "../../src/siege/blaster";
import { lastFallSeconds } from "../../src/siege/siege";
import {
    CardId,
    cards,
    dealOffer,
    offerCards,
    raritySteps,
} from "../../src/siege/cards";
import {
    Element,
    isElement,
    readElementPower,
    secondElementWave,
    secondElementWaveAlone,
} from "../../src/siege/elements";
import { siegePlugin } from "../../src/siege/siege.plugin";
import { readWardenStat, WardenStat } from "../../src/siege/stats";
import {
    Rarity,
    WardenElementsTrait,
    WardenTrait,
} from "../../src/siege/traits";
import { breatherSeconds, countdownSeconds } from "../../src/siege/waves";
import {
    fortify,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    deliverSignal,
    skipToBreather,
    takePlaces,
    type OpenedSiege,
} from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Two fortified wardens in the breather after wave 1, its cards dealt:
 *  the wave held at once rather than fought. */
async function openBreather() {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField(-4) });
    const bo = joinWarden(game, { name: "Bo", position: onField(4) });
    takePlaces(game, ada, bo);
    fortify(game, ada);
    fortify(game, bo);
    skipToBreather(game, 1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
    return { game, ada, bo };
}

/** The cards of her offer, by id. */
function readOffer(warden: Entity) {
    return (warden.get(WardenTrait)?.offer ?? []).map(({ card }) => card);
}

it("offers no card before the first wave", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });
    takePlaces(siege, ada);
    siege.step(1);

    expect(readOffer(ada)).toEqual([]);
});

it("offers each warden three different cards once a wave is held", async () => {
    const { ada, bo } = await openBreather();

    for (const warden of [ada, bo]) {
        const offer = readOffer(warden);
        expect(offer).toHaveLength(3);
        expect(new Set(offer).size).toBe(3);
        for (const card of offer) expect(Object.keys(cards)).toContain(card);
    }
});

/** The rarities of `draws` offers dealt to `warden`, by card. */
function drawRarities(warden: Entity, draws: number) {
    const rarities = new Map<string, Rarity[]>();
    for (let seed = 1; seed <= draws; seed++) {
        dealOffer(warden, { seeded: { seed }, wave: 1, alone: false });
        for (const { card, rarity } of warden.get(WardenTrait)?.offer ?? [])
            rarities.set(card, [...(rarities.get(card) ?? []), rarity]);
    }
    return rarities;
}

it("deals most cards common, some rare and a few epic, and a card of a whole count always common", async () => {
    const { ada } = await openBreather();

    const rarities = drawRarities(ada, 400);

    const all = [...rarities.values()].flat();
    const share = (rarity: Rarity) =>
        all.filter((dealt) => dealt === rarity).length / all.length;
    expect(share(Rarity.Common)).toBeGreaterThan(0.6);
    expect(share(Rarity.Rare)).toBeGreaterThan(0.08);
    expect(share(Rarity.Epic)).toBeGreaterThan(0.01);
    expect(new Set(rarities.get(CardId.StormLance))).toEqual(
        new Set([Rarity.Common]),
    );
    expect(new Set(rarities.get(CardId.MidasTouch))).toEqual(
        new Set([Rarity.Rare]),
    );
});

it("takes a rare card at a bigger step than a common", async () => {
    const { game, ada } = await openBreather();
    ada.set(WardenTrait, {
        offer: [{ card: CardId.HeavyRounds, rarity: Rarity.Rare }],
    });

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 0 },
    });
    game.step(fixedStepSeconds);

    expect(
        readWeaponNumber(blasterSettings, ada, WeaponNumber.Damage),
    ).toBeCloseTo(10 * (1 + 0.15 * raritySteps[Rarity.Rare]), 6);
});

/** Two wardens, each holding `element`, in the breather after wave
 *  `wave`, its cards dealt: the waves before it skipped. */
async function openAfterWave(wave: number, wardens = 2) {
    siege = await openSiege();
    const game = siege;
    const joined = ["Ada", "Bo"]
        .slice(0, wardens)
        .map((name, index) =>
            joinWarden(game, { name, position: onField(index * 6 - 3) }),
        );
    takePlaces(game, ...joined);
    for (const warden of joined) fortify(game, warden);
    for (const warden of joined)
        warden.set(WardenElementsTrait, {
            first: Element.Storm,
            firstLevel: 1,
            second: "",
            secondLevel: 0,
        });
    skipToBreather(game, wave);
    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.breather,
        wave,
    });
    return { game, wardens: joined };
}

it("offers each warden her second element after the wave-10 colossus, and cards before it", async () => {
    const before = await openAfterWave(secondElementWave - 1);
    expect(readOffer(before.wardens[0])).not.toContain(CardId.Ember);
    await siege?.close();

    const { game, wardens } = await openAfterWave(secondElementWave);
    for (const warden of wardens)
        expect(readOffer(warden)).toEqual([CardId.Ember, CardId.Frost]);

    deliverSignal(game.world, {
        hero: wardens[0],
        message: siegePlugin.messages.pick,
        payload: { slot: 1 },
    });
    game.step(fixedStepSeconds);
    expect(wardens[0].get(WardenElementsTrait)).toMatchObject({
        first: Element.Storm,
        second: Element.Frost,
        secondLevel: 1,
    });
});

it("offers a warden alone her second element after the wave-5 colossus", async () => {
    const { wardens } = await openAfterWave(secondElementWaveAlone, 1);

    expect(readOffer(wardens[0])).toEqual([CardId.Ember, CardId.Frost]);
});

it("offers a warden her second element after the wave-5 colossus when her teammate's connection has dropped", async () => {
    const { game, wardens } = await openAfterWave(secondElementWaveAlone - 1);
    wardens[1].add(DisconnectedTrait);
    skipToBreather(game, secondElementWaveAlone);

    expect(readOffer(wardens[0])).toEqual([CardId.Ember, CardId.Frost]);
    //  Her teammate, gone for now, waits for the wave-10 colossus.
    expect(readOffer(wardens[1])).not.toContain(CardId.Ember);
    expect(readOffer(wardens[1])).toHaveLength(3);
});

it("never offers a warden a third element, Endless included", async () => {
    const { wardens } = await openAfterWave(secondElementWave + 1);
    wardens[0].set(WardenElementsTrait, {
        second: Element.Ember,
        secondLevel: 1,
    });

    for (let seed = 1; seed < 100; seed++) {
        dealOffer(wardens[0], { seeded: { seed }, wave: 16, alone: false });
        expect(readOffer(wardens[0])).not.toContain(CardId.Frost);
        expect(readOffer(wardens[0])).toHaveLength(3);
    }
});

it("offers each warden her element as the wardens gather, and lets her change it until the run starts", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    expect(readOffer(ada)).toEqual([CardId.Storm, CardId.Ember, CardId.Frost]);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 1 },
    });
    game.step(fixedStepSeconds);
    expect(ada.get(WardenElementsTrait)?.first).toBe(Element.Ember);
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 2 },
    });
    game.step(fixedStepSeconds);
    takePlaces(game, ada);

    expect(ada.get(WardenElementsTrait)).toMatchObject({
        first: Element.Frost,
        firstLevel: 1,
        second: "",
    });
    expect(readOffer(ada)).toEqual([]);
});

it("gives a warden who picked no element one at random as the run starts", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });

    takePlaces(siege, ada);

    expect(isElement(ada.get(WardenElementsTrait)?.first ?? "")).toBe(true);
    expect(ada.get(WardenElementsTrait)?.firstLevel).toBe(1);
});

it("brings a warden's first element, at its first level, to the next run's gathering, where she may change it", async () => {
    const { game, wardens } = await openAfterWave(secondElementWave);
    const [ada] = wardens;
    ada.set(WardenElementsTrait, {
        firstLevel: 3,
        second: Element.Frost,
        secondLevel: 2,
    });
    for (const warden of wardens) warden.set(WardenTrait, { health: 0 });
    game.step(lastFallSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
    expect(ada.get(WardenTrait)?.taken).toBe(CardId.Storm);

    takePlaces(game, ...wardens);

    expect(ada.get(WardenElementsTrait)).toMatchObject({
        first: Element.Storm,
        firstLevel: 1,
        second: "",
        secondLevel: 0,
    });
});

it("takes the card she picks, and no second one that breather", async () => {
    const { game, ada } = await openBreather();
    const offer = readOffer(ada);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 1 },
    });
    game.step(fixedStepSeconds);
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 2 },
    });
    game.step(fixedStepSeconds);

    const survivor = ada.get(WardenTrait);
    expect(survivor?.taken).toBe(offer[1]);
    expect(survivor?.cards).toEqual([offer[1]]);
});

it("takes no pick while a wave is being fought", async () => {
    const { game, ada } = await openBreather();
    game.step(breatherSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 0 },
    });
    game.step(fixedStepSeconds);

    expect(ada.get(WardenTrait)?.cards).toHaveLength(1);
});

it("gives a warden who did not pick one of her three as the next wave opens", async () => {
    const { game, ada } = await openBreather();
    const offer = readOffer(ada);

    game.step(breatherSeconds + 0.1);

    const survivor = ada.get(WardenTrait);
    expect(survivor?.cards).toHaveLength(1);
    expect(offer).toContain(survivor?.cards[0]);
    expect(survivor?.offer).toEqual([]);
});

it("raises her blaster's damage by the card she takes", async () => {
    const { game, ada } = await openBreather();
    ada.set(WardenTrait, {
        offer: offerCards([
            CardId.HeavyRounds,
            CardId.FleetFoot,
            CardId.IronHeart,
        ]),
    });
    const before = readWeaponNumber(blasterSettings, ada, WeaponNumber.Damage);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 0 },
    });
    game.step(fixedStepSeconds);

    expect(
        readWeaponNumber(blasterSettings, ada, WeaponNumber.Damage),
    ).toBeGreaterThan(before);
});

it("raises her element's damage with the element strength card, and not her gun's", async () => {
    const { game, ada } = await openBreather();
    ada.set(WardenTrait, {
        offer: offerCards([
            CardId.Attunement,
            CardId.FleetFoot,
            CardId.IronHeart,
        ]),
    });
    const gun = readWeaponNumber(blasterSettings, ada, WeaponNumber.Damage);
    const power = readElementPower(ada);
    const share = cards[CardId.Attunement].modifiers[0]?.modifier.percent ?? 0;

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 0 },
    });
    game.step(fixedStepSeconds);

    expect(share).toBeGreaterThan(0);
    expect(readElementPower(ada)).toBeCloseTo(power + share);
    expect(readWeaponNumber(blasterSettings, ada, WeaponNumber.Damage)).toBe(
        gun,
    );
});

it("walks her faster with the speed card", async () => {
    const { game, ada } = await openBreather();
    ada.set(WardenTrait, {
        offer: offerCards([
            CardId.HeavyRounds,
            CardId.FleetFoot,
            CardId.IronHeart,
        ]),
    });
    const before = ada.get(MovementTrait)?.speed ?? 0;

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 1 },
    });
    game.step(fixedStepSeconds);

    expect(ada.get(MovementTrait)?.speed).toBeGreaterThan(before);
});

it("raises her greatest health and fills what it adds with the health card", async () => {
    const { game, ada } = await openBreather();
    ada.set(WardenTrait, { health: 50, maximum: 100 });
    ada.set(WardenTrait, {
        offer: offerCards([
            CardId.HeavyRounds,
            CardId.FleetFoot,
            CardId.IronHeart,
        ]),
    });

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 2 },
    });
    game.step(fixedStepSeconds);

    const survivor = ada.get(WardenTrait);
    expect(survivor?.maximum).toBeGreaterThan(100);
    expect(survivor?.health).toBeGreaterThan(50);
});

it("takes every card away when the wardens go again", async () => {
    const { game, ada, bo } = await openBreather();
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.pick,
        payload: { slot: 0 },
    });
    game.step(fixedStepSeconds);
    for (const warden of [ada, bo]) warden.set(WardenTrait, { health: 0 });
    game.step(lastFallSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    deliverSignal(game.world, {
        hero: bo,
        message: siegePlugin.messages.ready,
    });
    game.step(countdownSeconds + fixedStepSeconds * 2);

    expect(ada.get(WardenTrait)?.cards).toEqual([]);
    for (const stat of Object.values(WardenStat))
        expect(readWardenStat(ada, stat)).toBe(readWardenStat(bo, stat));
});
