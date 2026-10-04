import { readCard } from "../siege/cards";
import { Element } from "../siege/elements";

//  Where a card she takes or buys flies to, and her cards as the chips of
//  her panel. A flight ends on the page element that carries its target's
//  class: an element card's line, or the row of chips her other cards
//  join.

/** What a card flies to: its element's line, or her cards. */
export type FlightTarget = Element | "cards";

/** The class a flight's end carries, by what flies to it, and her panel's,
 *  where a card lands when its own end does not show. */
export const flightTargetClasses: Record<FlightTarget | "vitals", string> = {
    [Element.Storm]: "card-target-storm",
    [Element.Ember]: "card-target-ember",
    [Element.Frost]: "card-target-frost",
    cards: "card-target-cards",
    vitals: "card-target-vitals",
};

/** Where the card `id` flies once she takes or buys it. */
export function readFlightTarget(id: string): FlightTarget {
    return readCard(id)?.line ?? "cards";
}

/** The cards `after` adds at the end of `before`: none where it is not
 *  `before` grown, as a new run empties her list. */
export function readNewCards(
    before: readonly string[],
    after: readonly string[],
): string[] {
    if (after.length <= before.length) return [];
    if (before.some((card, index) => after[index] !== card)) return [];
    return after.slice(before.length);
}

/** The kinds of card her chips show before the rest go into a count, so a
 *  night of thirty cards keeps to one row of the health panel at 540
 *  rows. */
export const mostChips = 5;

/** Her cards as chips: each kind with the times she holds it, the most
 *  held first and the first taken first among equals, `most` at most, and
 *  the kinds past those. */
export function groupCardChips(cards: readonly string[], most: number) {
    const counts = new Map<string, number>();
    for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
    //  A stable sort keeps the first taken first among equals.
    const kinds = [...counts].sort(([, a], [, b]) => b - a);
    return {
        chips: kinds.slice(0, most),
        rest: Math.max(0, kinds.length - most),
    };
}
