import { AuthorityTrait, createStore, HeroTrait } from "@spawnite/engine";
import type { TraitRecord } from "koota";
import { useQueryFirst, useTrait } from "koota/react";
import { isElementPick } from "../siege/cards";
import { readCardPrice } from "../siege/shop";
import type { Phase } from "../siege/phase";
import { type CardOffer, WardenTrait } from "../siege/traits";
import { usePhase } from "../views/phase";
import { usePhoneUpright } from "./coarse";

//  Her hand of cards, open or folded to a chip along the bottom. The offer
//  is dealt open; once her free card is taken it folds by itself when her
//  purse meets nothing left in it, a beat after the pick lands. The fold key
//  folds and opens it until the wave starts, and readying folds it. Folded,
//  it pulses once as her coins come to meet a card, and never opens by
//  itself. The state is the page's own: the room never reads it.

/** Milliseconds after a pick, a purchase or a reroll before a hand with
 *  nothing left she can pay for folds: the taken card's flight (480 ms)
 *  lands first. */
export const foldBeat = 800;

/** Seconds of a breather the folded chip counts down, as the banner turns
 *  urgent. */
export const chipSeconds = 5;

/** What her hand holds for her purse: her free pick still to make, her
 *  coins, the cheapest card left to buy and the reroll's price, each left
 *  out where the hand has none. */
export interface HandPurse {
    free: boolean;
    coins: number;
    cheapest?: number;
    reroll?: number;
}

/** Coins the cheapest card of `offer` costs that she has neither taken nor
 *  bought; undefined when none is left. */
export function readCheapest(
    offer: readonly CardOffer[],
    taken: string,
    bought: readonly string[],
): number | undefined {
    const prices = offer
        .filter(({ card }) => card !== taken && !bought.includes(card))
        .map(({ rarity }) => readCardPrice(rarity));
    return prices.length === 0 ? undefined : Math.min(...prices);
}

/** Whether anything in her hand is hers to take: the free pick, or a card
 *  or a reroll her coins meet. */
export function canSpend({ free, coins, cheapest, reroll }: HandPurse) {
    if (free) return true;
    if (cheapest !== undefined && coins >= cheapest) return true;
    return reroll !== undefined && coins >= reroll;
}

interface HandState {
    /** The offer last dealt, by its key: the same offer read again deals
     *  nothing. */
    dealt: string;
    folded: boolean;
    /** Whether the fold key opened it again, so it comes back in its place
     *  without the deal. */
    back: boolean;
    /** Whether her coins met a card left in the hand when last read. */
    affordable: boolean;
    /** Times she folded or opened it herself, so a fold the rules
     *  scheduled before gives way to her. */
    toggles: number;
    /** Times the folded chip pulsed, which keys each pulse. */
    pulses: number;
}

export const useHand = createStore<HandState>()(() => ({
    dealt: "",
    folded: false,
    back: false,
    affordable: false,
    toggles: 0,
    pulses: 0,
}));

/** Opens the hand for the offer `key` where it is a new deal. Returns
 *  whether it was. */
export function dealHand(key: string) {
    if (useHand.getState().dealt === key) return false;
    useHand.setState({ dealt: key, folded: false, back: false });
    return true;
}

export function foldHand() {
    useHand.setState({ folded: true });
}

export function toggleHand() {
    useHand.setState(({ folded, back, toggles }) => ({
        folded: !folded,
        back: folded || back,
        toggles: toggles + 1,
    }));
}

/** Records whether her coins meet a card left in the hand: folded, coins
 *  that come to meet one pulse the chip once. The reroll alone pulses
 *  nothing. */
export function recordCardAffordability(affordable: boolean) {
    const { affordable: was, folded } = useHand.getState();
    if (was === affordable) return;
    useHand.setState(({ pulses }) => ({
        affordable,
        pulses: folded && affordable ? pulses + 1 : pulses,
    }));
}

/** Where her offer stands in `phase`: whether the wardens gather with her
 *  element to pick, whether she catches up on cards she missed, whether
 *  she shops once her free card is taken, and whether the offer is open at
 *  all, folded or not. */
export function readCardOffer(
    phase: Phase | undefined,
    survivor: TraitRecord<typeof WardenTrait> | undefined,
) {
    const catchingUp = (survivor?.catchUp ?? 0) > 0;
    const offered = (survivor?.offer.length ?? 0) > 0;
    const gathering =
        (phase === "waiting" || phase === "over") && !catchingUp && offered;
    //  After her free card, the rest of the offer is hers to buy, and a
    //  reroll deals three more, so the offer stays open while she shops.
    const shopping =
        phase === "breather" &&
        !catchingUp &&
        survivor !== undefined &&
        survivor.taken !== "" &&
        !isElementPick(survivor.taken);
    const open =
        gathering ||
        ((phase === "breather" || catchingUp) &&
            offered &&
            (survivor?.taken === "" || shopping));
    return { gathering, catchingUp, shopping, open };
}

/** Her own offer as it stands this phase, and whether her hand is
 *  folded, read for the hooks below. */
function useOwnOffer() {
    const survivor = useTrait(
        useQueryFirst(HeroTrait, AuthorityTrait),
        WardenTrait,
    );
    const phase = usePhase();
    const folded = useHand((state) => state.folded);
    return { phase, folded, ...readCardOffer(phase, survivor) };
}

/** Whether her element pick stands open, not folded, while the wardens
 *  gather: on a touch screen it takes the top of the screen too. */
export function useElementPickShown() {
    const { gathering, folded } = useOwnOffer();
    return gathering && !folded;
}

/** Whether her hand stands open and not folded, any offer: on a phone
 *  the wardens' row steps aside for it. */
export function useHandShown() {
    const { open, folded } = useOwnOffer();
    return open && !folded;
}

/** Whether her hand stands open at the top of a phone held upright: there
 *  it takes the top of the screen, and the banner steps aside until it
 *  folds. */
export function useHandAtTop() {
    const shown = useHandShown();
    const upright = usePhoneUpright();
    return upright && shown;
}

/** Whether her hand stands open in a breather with its shop bar under it,
 *  which then holds the breather's clock and Ready for the wave banner. */
export function useShopShown() {
    const { phase, open, gathering, folded } = useOwnOffer();
    return phase === "breather" && open && !gathering && !folded;
}
