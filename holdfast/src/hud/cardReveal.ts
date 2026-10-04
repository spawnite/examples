import { type CardOffer, Rarity } from "../siege/traits";

//  When each card of an offer turns face up. The cards are dealt face down
//  one after another, then turn in rising rarity, commons first, so the
//  best card turns last; an epic gathers light for a beat before it bursts.
//  Once the last has turned, the offer settles from the middle of the
//  screen into the hand along the bottom. Every time is in milliseconds
//  after the offer opens, and the keys take a card at any point of it.

/** When the first card turns, as the last of three lands. */
const firstTurn = 620;
/** Milliseconds between one card turning and the next. */
const turnStep = 240;
/** The beat an epic shakes and gathers light before it turns. */
export const epicCharge = 560;
/** The half of a turn before a card is edge on: styles.css starts each
 *  turn this long before its burst, and an epic's charge this long before
 *  that. */
const flipLead = 150;
/** How long the offer holds in the middle after the last card turns. */
const settleHold = 450;

/** Each rarity's rank, the rarest highest. */
const rarityRanks: Record<Rarity, number> = {
    [Rarity.Common]: 0,
    [Rarity.Rare]: 1,
    [Rarity.Epic]: 2,
};

/** The rarest rarity among `offer`'s cards: the one its reveal builds to. */
export function readOfferPeak(offer: readonly CardOffer[]): Rarity {
    return offer.reduce<Rarity>(
        (peak, { rarity }) =>
            rarityRanks[rarity] > rarityRanks[peak] ? rarity : peak,
        Rarity.Common,
    );
}

/** The offer's identity: a new one, as a new breather or a reroll deals,
 *  plays its reveal again. */
export function readOfferKey(offer: readonly CardOffer[]) {
    return offer.map(({ card, rarity }) => `${card}:${rarity}`).join();
}

/** When each card of an offer turns, and when the offer settles. */
export interface RevealTimes {
    /** When each card, by its slot, turns face up. */
    bursts: number[];
    /** When the offer leaves the middle for the hand. */
    settle: number;
}

/** When each card of `offer` turns, in rising rarity and in slot order
 *  within a rarity, and when the offer settles into the hand. */
export function readRevealTimes(offer: readonly CardOffer[]): RevealTimes {
    const order = offer
        .map(({ rarity }, slot) => ({ rarity, slot }))
        .sort(
            (a, b) =>
                rarityRanks[a.rarity] - rarityRanks[b.rarity] ||
                a.slot - b.slot,
        );
    const bursts: number[] = [];
    let next = firstTurn;
    let last = firstTurn;
    for (const { rarity, slot } of order) {
        last = rarity === Rarity.Epic ? next + epicCharge : next;
        bursts[slot] = last;
        next = last + turnStep;
    }
    return { bursts, settle: last + settleHold };
}

/** A sound of the reveal: a common's flick, a rare's chime, an epic's
 *  climb as it gathers and its chord as it bursts. */
export enum RevealCue {
    Flip = "flip",
    Rare = "rare",
    Charge = "charge",
    Epic = "epic",
}

/** One sound of the reveal, when it plays, and how much higher than its
 *  own pitch: each common's flick a step higher than the one before. */
export interface RevealSound {
    cue: RevealCue;
    at: number;
    pitch: number;
}

/** The sounds of `offer`'s reveal, in the order they play. */
export function readRevealSounds(offer: readonly CardOffer[]): RevealSound[] {
    const { bursts } = readRevealTimes(offer);
    let flips = 0;
    return offer
        .map(({ rarity }, slot) => ({ rarity, at: bursts[slot] }))
        .sort((a, b) => a.at - b.at)
        .flatMap(({ rarity, at }): RevealSound[] => {
            if (rarity === Rarity.Epic)
                return [
                    {
                        cue: RevealCue.Charge,
                        at: at - epicCharge - flipLead,
                        pitch: 1,
                    },
                    { cue: RevealCue.Epic, at, pitch: 1 },
                ];
            if (rarity === Rarity.Rare)
                return [{ cue: RevealCue.Rare, at, pitch: 1 }];
            flips += 1;
            return [{ cue: RevealCue.Flip, at, pitch: 1 + (flips - 1) * 0.12 }];
        });
}

//  Each time as the class that sets it on a card or on the offer, for
//  styles.css to read. Written whole, because Tailwind emits only the
//  classes it reads; a test checks every time an offer can take has one.

/** When each slot's card is dealt, and how it tilts as it comes. */
export const dealClasses = [
    "[--card-deal:0ms] [--card-tilt:-6deg]",
    "[--card-deal:110ms] [--card-tilt:0deg]",
    "[--card-deal:220ms] [--card-tilt:6deg]",
];

/** A card's turn, by its time. */
export const burstClasses: Record<number, string> = {
    620: "[--card-burst:620ms]",
    860: "[--card-burst:860ms]",
    1100: "[--card-burst:1100ms]",
    1180: "[--card-burst:1180ms]",
    1420: "[--card-burst:1420ms]",
    1660: "[--card-burst:1660ms]",
    1980: "[--card-burst:1980ms]",
    2220: "[--card-burst:2220ms]",
    2780: "[--card-burst:2780ms]",
};

/** The offer's settling into the hand, by its time: its last turn and
 *  the hold after it. */
export const settleClasses: Record<number, string> = {
    1070: "[--card-settle:1070ms]",
    1310: "[--card-settle:1310ms]",
    1550: "[--card-settle:1550ms]",
    1630: "[--card-settle:1630ms]",
    1870: "[--card-settle:1870ms]",
    2110: "[--card-settle:2110ms]",
    2430: "[--card-settle:2430ms]",
    2670: "[--card-settle:2670ms]",
    3230: "[--card-settle:3230ms]",
};

/** The screen's flash for an epic, by the time its last epic bursts. */
export const flashClasses: Record<number, string> = {
    1180: "[--card-flash:1180ms]",
    1420: "[--card-flash:1420ms]",
    1660: "[--card-flash:1660ms]",
    1980: "[--card-flash:1980ms]",
    2220: "[--card-flash:2220ms]",
    2780: "[--card-flash:2780ms]",
};
