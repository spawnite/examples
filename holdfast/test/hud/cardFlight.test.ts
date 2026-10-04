import { expect, it } from "vitest";
import {
    groupCardChips,
    mostChips,
    readFlightTarget,
    readNewCards,
} from "../../src/hud/cardFlight";
import { CardId } from "../../src/siege/cards";
import { Element } from "../../src/siege/elements";

//  Where a taken or bought card flies, which of her cards are new, and her
//  cards grouped into the chips her panel holds.

it("flies an element card to its element's line and any other card to her cards", () => {
    expect(readFlightTarget(CardId.FrostSurge)).toBe(Element.Frost);
    expect(readFlightTarget(CardId.EmberSurge)).toBe(Element.Ember);
    expect(readFlightTarget(CardId.HeavyRounds)).toBe("cards");
    expect(readFlightTarget(CardId.Marksman)).toBe("cards");
});

it("names the cards added at the end of her list, and none when a new run empties it", () => {
    expect(readNewCards(["a"], ["a", "b"])).toEqual(["b"]);
    expect(readNewCards(["a"], ["a", "b", "c"])).toEqual(["b", "c"]);
    expect(readNewCards(["a", "b"], ["a", "b"])).toEqual([]);
    expect(readNewCards(["a", "b"], [])).toEqual([]);
    expect(readNewCards(["a", "b"], ["c"])).toEqual([]);
});

it("groups her cards by the most held, first taken first among equals, and counts the kinds past the most it shows", () => {
    const cards = ["a", "b", "b", "c", "d", "d", "d", "e", "f", "g"];

    expect(groupCardChips(cards, 3)).toEqual({
        chips: [
            ["d", 3],
            ["b", 2],
            ["a", 1],
        ],
        rest: 4,
    });
    expect(groupCardChips(["a", "a"], 3)).toEqual({
        chips: [["a", 2]],
        rest: 0,
    });
});

it("holds a night of thirty cards in one row of chips", () => {
    const kinds = Object.values(CardId).slice(0, 10);
    const cards = Array.from({ length: 30 }, (_, index) => kinds[index % 10]);

    const { chips, rest } = groupCardChips(cards, mostChips);

    expect(chips).toHaveLength(5);
    expect(rest).toBe(5);
});
