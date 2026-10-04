// @vitest-environment node
import { expect, it } from "vitest";
import {
    burstClasses,
    epicCharge,
    flashClasses,
    readOfferPeak,
    readRevealSounds,
    readRevealTimes,
    RevealCue,
    settleClasses,
} from "../../src/hud/cardReveal";
import { CardId, offerCards } from "../../src/siege/cards";
import { type CardOffer, Rarity } from "../../src/siege/traits";

/** An offer of stat cards at `rarities`, in slot order. */
function offerAt(...rarities: Rarity[]): CardOffer[] {
    const ids = [CardId.HeavyRounds, CardId.HairTrigger, CardId.FleetFoot];
    return rarities.map((rarity, slot) => ({ card: ids[slot], rarity }));
}

const rarities = Object.values(Rarity);

/** Every offer of one to three cards, at every mix of rarities. */
function allOffers() {
    const offers: CardOffer[][] = [];
    const grow = (offer: Rarity[]) => {
        if (offer.length > 0) offers.push(offerAt(...offer));
        if (offer.length < 3)
            for (const rarity of rarities) grow([...offer, rarity]);
    };
    grow([]);
    return offers;
}

it("names the rarest card of an offer", () => {
    expect(
        readOfferPeak(offerAt(Rarity.Common, Rarity.Epic, Rarity.Rare)),
    ).toBe(Rarity.Epic);
    expect(
        readOfferPeak(offerCards([CardId.Storm, CardId.Ember, CardId.Frost])),
    ).toBe(Rarity.Common);
});

it("turns commons in slot order, a quarter second apart", () => {
    expect(
        readRevealTimes(offerAt(Rarity.Common, Rarity.Common, Rarity.Common)),
    ).toEqual({ bursts: [620, 860, 1100], settle: 1550 });
});

it("turns the rarest card last, and an epic after a beat that gathers it", () => {
    const { bursts } = readRevealTimes(
        offerAt(Rarity.Epic, Rarity.Common, Rarity.Rare),
    );

    expect(bursts[1]).toBeLessThan(bursts[2]);
    expect(bursts[2]).toBeLessThan(bursts[0]);
    expect(bursts[0] - bursts[2]).toBeGreaterThanOrEqual(epicCharge);
});

it("settles the offer into the hand after its last card turns", () => {
    for (const offer of allOffers()) {
        const { bursts, settle } = readRevealTimes(offer);
        expect(settle).toBeGreaterThan(Math.max(...bursts));
    }
});

it("has a class carrying every time an offer of one to three cards can take", () => {
    for (const offer of allOffers()) {
        const { bursts, settle } = readRevealTimes(offer);
        for (const burst of bursts)
            expect(burstClasses[burst]).toBe(`[--card-burst:${burst}ms]`);
        expect(settleClasses[settle]).toBe(`[--card-settle:${settle}ms]`);
        if (readOfferPeak(offer) === Rarity.Epic) {
            const flash = Math.max(...bursts);
            expect(flashClasses[flash]).toBe(`[--card-flash:${flash}ms]`);
        }
    }
});

it("flicks each common a step higher, chimes a rare, and climbs to an epic's chord", () => {
    expect(
        readRevealSounds(offerAt(Rarity.Epic, Rarity.Common, Rarity.Common)),
    ).toEqual([
        { cue: RevealCue.Flip, at: 620, pitch: 1 },
        { cue: RevealCue.Flip, at: 860, pitch: 1.12 },
        { cue: RevealCue.Charge, at: 950, pitch: 1 },
        { cue: RevealCue.Epic, at: 1660, pitch: 1 },
    ]);
    expect(
        readRevealSounds(offerAt(Rarity.Rare, Rarity.Common)).map(
            ({ cue }) => cue,
        ),
    ).toEqual([RevealCue.Flip, RevealCue.Rare]);
});
