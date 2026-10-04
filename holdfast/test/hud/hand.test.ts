import { afterEach, describe, expect, it } from "vitest";
import {
    canSpend,
    dealHand,
    foldHand,
    readCheapest,
    toggleHand,
    useHand,
    recordCardAffordability,
} from "../../src/hud/hand";
import { CardId } from "../../src/siege/cards";
import { Rarity } from "../../src/siege/traits";

afterEach(() => {
    useHand.setState(useHand.getInitialState(), true);
});

const offer = [
    { card: CardId.HeavyRounds, rarity: Rarity.Common },
    { card: CardId.HairTrigger, rarity: Rarity.Rare },
    { card: CardId.FleetFoot, rarity: Rarity.Epic },
];

describe("readCheapest", () => {
    it("prices the cheapest card neither taken nor bought", () => {
        expect(readCheapest(offer, CardId.HeavyRounds, [])).toBe(40);
        expect(
            readCheapest(offer, CardId.HeavyRounds, [CardId.HairTrigger]),
        ).toBe(80);
    });

    it("is undefined once every card is taken or bought", () => {
        expect(
            readCheapest(offer, CardId.HeavyRounds, [
                CardId.HairTrigger,
                CardId.FleetFoot,
            ]),
        ).toBeUndefined();
    });
});

describe("canSpend", () => {
    it("holds while her free pick is still to make, whatever her purse", () => {
        expect(canSpend({ free: true, coins: 0, cheapest: 20 })).toBe(true);
    });

    it("holds where her coins meet the cheapest card or the reroll", () => {
        expect(
            canSpend({ free: false, coins: 20, cheapest: 20, reroll: 30 }),
        ).toBe(true);
        expect(
            canSpend({ free: false, coins: 30, cheapest: 40, reroll: 30 }),
        ).toBe(true);
    });

    it("fails where her coins meet neither", () => {
        expect(
            canSpend({ free: false, coins: 19, cheapest: 20, reroll: 20 }),
        ).toBe(false);
        expect(canSpend({ free: false, coins: 500 })).toBe(false);
    });
});

describe("the hand's store", () => {
    it("opens on a new deal, and a deal read again keeps it folded", () => {
        foldHand();
        expect(dealHand("a")).toBe(true);
        expect(useHand.getState().folded).toBe(false);
        foldHand();
        expect(dealHand("a")).toBe(false);
        expect(useHand.getState().folded).toBe(true);
    });

    it("folds and opens again on the fold key", () => {
        dealHand("a");
        toggleHand();
        expect(useHand.getState().folded).toBe(true);
        toggleHand();
        expect(useHand.getState().folded).toBe(false);
    });

    it("pulses once as her purse comes to meet a card while folded, and never opens by itself", () => {
        dealHand("a");
        recordCardAffordability(false);
        foldHand();
        recordCardAffordability(false);
        recordCardAffordability(true);
        recordCardAffordability(true);
        expect(useHand.getState().pulses).toBe(1);
        expect(useHand.getState().folded).toBe(true);
    });

    it("pulses for nothing while the hand is open", () => {
        dealHand("a");
        recordCardAffordability(false);
        recordCardAffordability(true);
        expect(useHand.getState().pulses).toBe(0);
    });
});
