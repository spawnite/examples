// @vitest-environment node
import { expect, it } from "vitest";
import { readCardText } from "../../src/hud/cardText";
import { CardId, cards } from "../../src/siege/cards";
import { Rarity } from "../../src/siege/traits";

it("heads a common with its number and what it raises, and gives no reason", () => {
    expect(readCardText(CardId.HeavyRounds, Rarity.Common)).toEqual({
        amount: "+15%",
        stat: "damage",
        line: "Your shots and your element hit 15% harder.",
    });
    expect(readCardText(CardId.IronHeart, Rarity.Common)).toMatchObject({
        amount: "+15",
        stat: "max health",
    });
    expect(readCardText(CardId.SecondWind, Rarity.Common)).toMatchObject({
        amount: "+1.2",
        stat: "health a second",
    });
});

it("heads a rare and an epic with the bigger number, and says how much bigger than the common", () => {
    expect(readCardText(CardId.HeavyRounds, Rarity.Rare)).toEqual({
        amount: "+24%",
        stat: "damage",
        line: "Your shots and your element hit 24% harder.",
        why: "1.6× a common's +15%",
    });
    expect(readCardText(CardId.HeavyRounds, Rarity.Epic)).toMatchObject({
        amount: "+36%",
        why: "2.4× a common's +15%",
    });
    expect(readCardText(CardId.IronHeart, Rarity.Epic)).toMatchObject({
        amount: "+36",
        why: "2.4× a common's +15",
    });
    expect(readCardText(CardId.SecondWind, Rarity.Rare)).toMatchObject({
        amount: "+1.9",
        why: "1.6× a common's +1.2",
    });
});

it("heads every stat card with a number, and says why each rare or epic of one is bigger", () => {
    const stats = Object.values(CardId).filter((id) => !cards[id].element);
    for (const id of stats)
        for (const rarity of cards[id].grows
            ? Object.values(Rarity)
            : [Rarity.Common]) {
            const text = readCardText(id, rarity);
            expect(text.amount, id).toMatch(/^(\+\d|New)/);
            expect(text.stat, id).toBeTruthy();
            expect(text.why !== undefined, `${id} ${rarity}`).toBe(
                rarity !== Rarity.Common,
            );
        }
});

it("shows an element card's points by its rarity, and why a rare or an epic adds more", () => {
    expect(readCardText(CardId.StormSurge, Rarity.Common)).toEqual({
        amount: "+1",
        stat: "Storm points",
        line: "Fills your Storm line, toward Forked Storm and Thunderhead.",
    });
    expect(readCardText(CardId.EmberSurge, Rarity.Epic)).toMatchObject({
        amount: "+4",
        stat: "Ember points",
        why: "4× a common's +1",
    });
});

it("gives an element's own pick its line and no number", () => {
    expect(readCardText(CardId.Frost, Rarity.Common)).toEqual({
        line: "Your hits chill, and enough chill freezes.",
    });
});
