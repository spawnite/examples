import { act, render } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    HeroTrait,
    useRoom,
    WalletTrait,
} from "@spawnite/engine";
import { CardPick } from "../../src/hud/CardPick";
import { foldBeat, useHand } from "../../src/hud/hand";
import { showReady } from "./life";
import { showPhase } from "./phase";
import { CardId, offerCards } from "../../src/siege/cards";
import { Rarity, SiegeTrait, WardenTrait } from "../../src/siege/traits";
import { createPageWorld } from "./pageWorld";

//  The HUD layer lives in the canvas; here the hand and its chip draw in
//  the page, so a test reads which of the two shows.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: PropsWithChildren) => children,
    Panel: ({ children }: PropsWithChildren) => children,
}));

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    useRoom.setState(useRoom.getInitialState(), true);
    useHand.setState(useHand.getInitialState(), true);
    document.body.replaceChildren();
});

/** A breather's offer of a common, a rare and an epic, 20, 40 and 80
 *  coins after the free one, to a warden holding `coins`, with the room's
 *  sends recorded. */
function renderBreather({
    coins = 0,
    secondsLeft = 15,
}: { coins?: number; secondsLeft?: number } = {}) {
    const sendMessage = vi.fn();
    useRoom.setState({ sendMessage });
    const world = createPageWorld();
    showPhase(world.spawn(SiegeTrait({ secondsLeft })), "breather");
    const hero = world.spawn(
        HeroTrait,
        AuthorityTrait,
        WalletTrait({ coins }),
        WardenTrait({
            offer: [
                { card: CardId.HeavyRounds, rarity: Rarity.Common },
                { card: CardId.HairTrigger, rarity: Rarity.Rare },
                { card: CardId.FleetFoot, rarity: Rarity.Epic },
            ],
        }),
    );
    const view = render(
        <WorldProvider world={world}>
            <CardPick />
        </WorldProvider>,
    );
    return {
        hero,
        world,
        sendMessage,
        view,
        /** Whether the open hand shows, and whether the folded chip does. */
        read: () => ({
            hand: view.container.querySelector(".card-hand") !== null,
            chip: view.container.querySelector(".card-chip") !== null,
        }),
        /** The room grants her free card: the first. */
        take: () =>
            act(() =>
                hero.set(WardenTrait, {
                    ...hero.get(WardenTrait),
                    taken: CardId.HeavyRounds,
                    cards: [CardId.HeavyRounds],
                }),
            ),
        unmount: () => {
            view.unmount();
            world.destroy();
        },
    };
}

/** A press of the key `code` and its release, as a finger makes one. */
function press(code: string) {
    act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code }));
        window.dispatchEvent(new KeyboardEvent("keyup", { code }));
    });
}

it("folds to the chip a beat after her free card when her purse meets no card and no reroll", () => {
    const run = renderBreather({ coins: 9 });

    run.take();
    const beforeBeat = run.read();
    act(() => vi.advanceTimersByTime(foldBeat));

    expect(beforeBeat).toEqual({ hand: true, chip: false });
    expect(run.read()).toEqual({ hand: false, chip: true });
    run.unmount();
});

it("stays open after her free card while her purse meets the reroll", () => {
    const run = renderBreather({ coins: 10 });

    run.take();
    act(() => vi.advanceTimersByTime(foldBeat * 3));

    expect(run.read()).toEqual({ hand: true, chip: false });
    run.unmount();
});

it("stays open before her free card, however empty her purse", () => {
    const run = renderBreather({ coins: 0 });

    act(() => vi.advanceTimersByTime(foldBeat * 3));

    expect(run.read()).toEqual({ hand: true, chip: false });
    run.unmount();
});

it("folds on C and opens again on C", () => {
    const run = renderBreather();

    press("KeyC");
    const folded = run.read();
    press("KeyC");

    expect(folded).toEqual({ hand: false, chip: true });
    expect(run.read()).toEqual({ hand: true, chip: false });
    run.unmount();
});

it("folds as she readies", () => {
    const run = renderBreather();

    act(() => showReady(run.hero, true));

    expect(run.read()).toEqual({ hand: false, chip: true });
    run.unmount();
});

it("takes no card on its number key while the hand is folded", () => {
    const run = renderBreather();

    press("KeyC");
    press("Digit2");

    expect(run.sendMessage).not.toHaveBeenCalled();
    run.unmount();
});

it("pulses the chip once as coins come to meet a card, and stays folded", () => {
    const run = renderBreather({ coins: 0 });
    run.take();
    act(() => vi.advanceTimersByTime(foldBeat));
    const pulse = () => run.view.container.querySelector(".card-chip-pulse");
    const still = pulse();

    act(() => run.hero.set(WalletTrait, { coins: 40 }));
    const pulsed = pulse();
    act(() => run.hero.set(WalletTrait, { coins: 45 }));

    expect(still).toBeNull();
    expect(pulsed).not.toBeNull();
    //  The same pulse, not a second one.
    expect(pulse()).toBe(pulsed);
    expect(run.read()).toEqual({ hand: false, chip: true });
    run.unmount();
});

it("pulses for nothing as coins meet the reroll but no card left", () => {
    const run = renderBreather({ coins: 0 });
    run.take();
    act(() => vi.advanceTimersByTime(foldBeat));

    act(() => run.hero.set(WalletTrait, { coins: 20 }));

    expect(run.view.container.querySelector(".card-chip-pulse")).toBeNull();
    run.unmount();
});

it("keeps a hand she opened again before the fold's beat ended", () => {
    const run = renderBreather({ coins: 0 });

    run.take();
    press("KeyC");
    press("KeyC");
    act(() => vi.advanceTimersByTime(foldBeat * 2));

    expect(run.read()).toEqual({ hand: true, chip: false });
    run.unmount();
});

it("plays a pulse once: the chip folded again later does not pulse", () => {
    const run = renderBreather({ coins: 0 });
    run.take();
    act(() => vi.advanceTimersByTime(foldBeat));
    act(() => run.hero.set(WalletTrait, { coins: 40 }));

    press("KeyC");
    press("KeyC");

    expect(run.read()).toEqual({ hand: false, chip: true });
    expect(run.view.container.querySelector(".card-chip-pulse")).toBeNull();
    run.unmount();
});

it("forgets the last breather's pulse once its offer closes", () => {
    const run = renderBreather({ coins: 0 });
    run.take();
    act(() => vi.advanceTimersByTime(foldBeat));
    act(() => run.hero.set(WalletTrait, { coins: 40 }));

    act(() =>
        run.hero.set(WardenTrait, {
            ...run.hero.get(WardenTrait),
            offer: [],
            taken: "",
        }),
    );

    expect(useHand.getState().pulses).toBe(0);
    run.unmount();
});

it("counts the breather's last five seconds on the chip", () => {
    const run = renderBreather({ secondsLeft: 6 });
    press("KeyC");
    const count = () =>
        run.view.container.querySelector(".card-chip-count")?.textContent;
    const early = count();

    act(() => {
        const siege = run.world.queryFirst(SiegeTrait);
        siege?.set(SiegeTrait, { secondsLeft: 4.2 });
    });

    expect(early).toBeUndefined();
    expect(count()).toBe("5");
    run.unmount();
});

/** The element pick as the wardens gather, her pick `taken`. */
function renderGathering(taken = "") {
    const sendMessage = vi.fn();
    useRoom.setState({ sendMessage });
    const world = createPageWorld();
    showPhase(world.spawn(SiegeTrait), "waiting");
    const hero = world.spawn(
        HeroTrait,
        AuthorityTrait,
        WardenTrait({
            offer: offerCards([CardId.Storm, CardId.Ember, CardId.Frost]),
            taken,
        }),
    );
    const view = render(
        <WorldProvider world={world}>
            <CardPick />
        </WorldProvider>,
    );
    return {
        hero,
        sendMessage,
        view,
        unmount: () => {
            view.unmount();
            world.destroy();
        },
    };
}

it("keeps the element pick open in the middle of the screen until she picks, then folds it to her element", () => {
    const run = renderGathering();
    const open = run.view.container.querySelector(".card-hand-center");

    act(() =>
        run.hero.set(WardenTrait, {
            ...run.hero.get(WardenTrait),
            taken: CardId.Ember,
        }),
    );
    act(() => vi.advanceTimersByTime(foldBeat));

    expect(open).not.toBeNull();
    expect(run.view.container.querySelector(".card-hand")).toBeNull();
    expect(
        run.view.container.querySelector(".card-chip")?.textContent,
    ).toContain("Ember");
    run.unmount();
});

it("keeps the element pick open as she readies before picking", () => {
    const run = renderGathering();

    act(() => showReady(run.hero, true));

    expect(
        run.view.container.querySelector(".card-hand-center"),
    ).not.toBeNull();
    run.unmount();
});

it("opens the element pick again on C, and its number key changes it", () => {
    const run = renderGathering(CardId.Storm);
    const folded = run.view.container.querySelector(".card-chip") !== null;

    press("Digit3");
    const whileFolded = run.sendMessage.mock.calls.length;
    press("KeyC");
    press("Digit3");

    expect(folded).toBe(true);
    expect(whileFolded).toBe(0);
    expect(run.sendMessage).toHaveBeenCalledWith({
        name: "siege.pick",
        payload: { slot: 2 },
    });
    run.unmount();
});
