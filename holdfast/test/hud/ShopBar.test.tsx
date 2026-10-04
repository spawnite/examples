import { act, render } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    HeroTrait,
    RoomStatus,
    useRoom,
    WalletTrait,
} from "@spawnite/engine";
import { CardPick } from "../../src/hud/CardPick";
import { foldHand, useHand } from "../../src/hud/hand";
import { WaveBanner } from "../../src/hud/WaveBanner";
import { CardId } from "../../src/siege/cards";
import { Rarity, SiegeTrait, WardenTrait } from "../../src/siege/traits";
import { showReady } from "./life";
import { showPhase } from "./phase";
import { createPageWorld } from "./pageWorld";

//  The HUD layer lives in the canvas; here the hand, its bar and the
//  banner draw in the page, so a test reads what each holds.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: PropsWithChildren) => children,
    Panel: ({ children }: PropsWithChildren) => children,
}));

afterEach(() => {
    useRoom.setState(useRoom.getInitialState(), true);
    useHand.setState(useHand.getInitialState(), true);
    document.body.replaceChildren();
});

/** The breather after wave 3, 15 seconds left, with a common, a rare and
 *  an epic on offer to a warden holding `coins`, her cards drawn and the
 *  wave banner beside them. */
function renderShop(coins: number) {
    const sendMessage = vi.fn();
    useRoom.setState({ status: RoomStatus.Joined, sendMessage });
    const world = createPageWorld();
    showPhase(
        world.spawn(SiegeTrait({ wave: 3, secondsLeft: 15 })),
        "breather",
    );
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
    const cards = render(
        <WorldProvider world={world}>
            <CardPick />
        </WorldProvider>,
    );
    const banner = render(
        <WorldProvider world={world}>
            <WaveBanner />
        </WorldProvider>,
    );
    return {
        hero,
        world,
        cards,
        sendMessage,
        bar: () => cards.container.querySelector(".card-shop-bar"),
        row: () => cards.container.querySelector(".card-row"),
        banner: () => banner.container.textContent ?? "",
        unmount: () => {
            cards.unmount();
            banner.unmount();
            world.destroy();
        },
    };
}

it("lays one bar under the cards: her coins, the reroll with its price, and the clock with Ready", () => {
    const run = renderShop(45);
    const row = run.row();
    const bar = run.bar();

    expect(row && bar && row.compareDocumentPosition(bar)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(bar?.querySelector(".shop-purse")?.textContent).toBe("45");
    expect(
        bar?.querySelector('[aria-label="Reroll the cards for 10 coins"]'),
    ).not.toBeNull();
    expect(bar?.textContent).toContain("Wave 4 in15");
    expect(bar?.querySelector('[aria-label="Ready (R)"]')).not.toBeNull();
    run.unmount();
});

it("rerolls on a tap of the bar's Reroll where her purse meets the price", () => {
    const run = renderShop(45);

    act(() =>
        run
            .bar()
            ?.querySelector<HTMLElement>(
                '[aria-label="Reroll the cards for 10 coins"]',
            )
            ?.click(),
    );

    expect(run.sendMessage).toHaveBeenCalledWith({
        name: "siege.reroll",
        payload: {},
    });
    run.unmount();
});

it("says how many more coins the reroll needs where her purse is short, and sends nothing on a tap", () => {
    const run = renderShop(4);
    const reroll = run
        .bar()
        ?.querySelector<HTMLElement>(
            '[aria-label="Reroll the cards for 10 coins"]',
        );
    if (!reroll) throw new Error("No reroll in the bar");

    act(() => reroll.click());

    expect(run.bar()?.textContent).toContain("6 more");
    expect(run.sendMessage).not.toHaveBeenCalled();
    run.unmount();
});

it("names the wave alone in the banner while the bar holds the clock, and takes the clock back once the cards fold", () => {
    const run = renderShop(45);
    const open = run.banner();

    act(() => foldHand());

    expect(open).not.toContain("Wave 4 in");
    expect(open).toContain("Wave 4 of 15");
    expect(run.bar()).toBeNull();
    expect(run.banner()).toContain("Wave 4 in");
    run.unmount();
});

it("bumps the reroll's price to its next value as the room grants a reroll", () => {
    const run = renderShop(45);
    const first = run.bar()?.querySelector(".shop-reroll-price");

    act(() =>
        run.hero.set(WardenTrait, {
            ...run.hero.get(WardenTrait),
            rerolls: 1,
            offer: [
                { card: CardId.FleetFoot, rarity: Rarity.Common },
                { card: CardId.IronHeart, rarity: Rarity.Common },
                { card: CardId.Marksman, rarity: Rarity.Rare },
            ],
        }),
    );
    const next = run.bar()?.querySelector(".shop-reroll-price");

    expect(first?.classList.contains("animate-hud-bump")).toBe(false);
    expect(next?.textContent).toBe("20");
    expect(next?.classList.contains("animate-hud-bump")).toBe(true);
    run.unmount();
});

it("counts the wardens ready beside Ready where she has company", () => {
    const run = renderShop(45);
    const solo = run.bar()?.textContent ?? "";

    act(() => {
        showReady(run.world.spawn(HeroTrait, WardenTrait()), true);
    });

    expect(solo).not.toMatch(/\d\/\d ready/);
    expect(run.bar()?.textContent).toContain("1/2 ready");
    run.unmount();
});

it("bands the card she bought Bought and her free card Taken", () => {
    const run = renderShop(100);

    act(() =>
        run.hero.set(WardenTrait, {
            ...run.hero.get(WardenTrait),
            taken: CardId.HeavyRounds,
            bought: [CardId.HairTrigger],
            cards: [CardId.HeavyRounds, CardId.HairTrigger],
        }),
    );
    const bands = [
        ...run.cards.container.querySelectorAll(".card-bought-band"),
    ].map((band) => band.textContent);

    expect(bands).toEqual(["Taken", "Bought"]);
    run.unmount();
});
