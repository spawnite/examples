import { readFileSync } from "node:fs";
import path from "node:path";
import { act, render } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    createGameWorld,
    HeroTrait,
    useRoom,
    WalletTrait,
} from "@spawnite/engine";
import { CardPick } from "../src/hud/CardPick";
import { CardId, offerCards } from "../src/siege/cards";
import type { Phase } from "../src/siege/phase";
import { SiegeTrait, WardenTrait } from "../src/siege/traits";
import { showPhase } from "./hud/phase";

//  The HUD layer lives in the canvas; here the hand draws in the page, where
//  the sheet's rules reach it.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: PropsWithChildren) => children,
    Panel: ({ children }: PropsWithChildren) => children,
}));

const sheet = readFileSync(
    path.resolve(import.meta.dirname, "../src/styles.css"),
    "utf8",
);

afterEach(() => {
    vi.unstubAllGlobals();
    useRoom.setState(useRoom.getInitialState(), true);
    document.head.replaceChildren();
    document.body.replaceChildren();
});

/** Whether the engine's crosshair shows `elapsed` ms after `offer` is dealt
 *  to a warden in `phase` with `coins` in her purse, `catchUp` cards still
 *  to take and `taken` her free card, if she took one. */
function readCrosshairShown(
    phase: Phase,
    offer: readonly CardId[],
    { catchUp = 0, taken = "", elapsed = 0, coins = 0 } = {},
) {
    vi.useFakeTimers();
    const style = document.createElement("style");
    style.textContent = sheet;
    document.head.append(style);
    const world = createGameWorld();
    showPhase(world.spawn(SiegeTrait()), phase);
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        WardenTrait({ offer: offerCards(offer), catchUp, taken }),
        WalletTrait({ coins }),
    );
    const { container, unmount } = render(
        <WorldProvider world={world}>
            <div data-crosshair />
            <CardPick />
        </WorldProvider>,
    );
    act(() => vi.advanceTimersByTime(elapsed));
    const crosshair = container.querySelector("[data-crosshair]");
    if (!crosshair) throw new Error("No crosshair");
    const hand = container.querySelector(".card-hand");
    const shown = getComputedStyle(crosshair).visibility !== "hidden";
    unmount();
    world.destroy();
    vi.useRealTimers();
    return { hand: hand !== null, shown };
}

const elements = [CardId.Storm, CardId.Ember, CardId.Frost];
const stats = [CardId.HeavyRounds, CardId.HairTrigger, CardId.FleetFoot];

it("shows the crosshair over the element pick as the wardens gather", () => {
    expect(readCrosshairShown("waiting", elements)).toEqual({
        hand: true,
        shown: true,
    });
});

it("hides the crosshair while a breather's cards are dealt mid-screen", () => {
    expect(readCrosshairShown("breather", stats)).toEqual({
        hand: true,
        shown: false,
    });
});

it("shows the crosshair once a breather's hand settles along the bottom", () => {
    expect(readCrosshairShown("breather", stats, { elapsed: 5000 })).toEqual({
        hand: true,
        shown: true,
    });
});

it("shows the crosshair through the shop after her free card", () => {
    expect(
        readCrosshairShown("breather", stats, {
            taken: CardId.HeavyRounds,
            elapsed: 5000,
            coins: 100,
        }),
    ).toEqual({ hand: true, shown: true });
});

it("hides the crosshair while a late warden's cards are dealt mid-wave", () => {
    expect(readCrosshairShown("fight", elements, { catchUp: 1 })).toEqual({
        hand: true,
        shown: false,
    });
});

it("shows the crosshair once a late warden's hand settles mid-wave", () => {
    expect(
        readCrosshairShown("fight", elements, { catchUp: 1, elapsed: 5000 }),
    ).toEqual({ hand: true, shown: true });
});

it("hides the crosshair again under the next breather's deal of the same cards", () => {
    vi.useFakeTimers();
    const style = document.createElement("style");
    style.textContent = sheet;
    document.head.append(style);
    const world = createGameWorld();
    const siege = world.spawn(SiegeTrait());
    showPhase(siege, "breather");
    const hero = world.spawn(
        HeroTrait,
        AuthorityTrait,
        WardenTrait({ offer: offerCards(stats) }),
    );
    const { container, unmount } = render(
        <WorldProvider world={world}>
            <div data-crosshair />
            <CardPick />
        </WorldProvider>,
    );
    const crosshair = container.querySelector("[data-crosshair]");
    if (!crosshair) throw new Error("No crosshair");
    act(() => vi.advanceTimersByTime(5000));
    act(() => {
        showPhase(siege, "fight");
        hero.set(WardenTrait, { offer: [] });
    });
    act(() => vi.advanceTimersByTime(1000));
    act(() => {
        showPhase(siege, "breather");
        hero.set(WardenTrait, { offer: offerCards(stats) });
    });
    const shown = getComputedStyle(crosshair).visibility !== "hidden";
    unmount();
    world.destroy();
    vi.useRealTimers();
    expect(shown).toBe(false);
});

it("shows the crosshair at once where the device asks for less motion", () => {
    vi.stubGlobal(
        "matchMedia",
        (query: string) =>
            ({
                matches: query === "(prefers-reduced-motion: reduce)",
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }) as unknown as MediaQueryList,
    );
    expect(readCrosshairShown("breather", stats)).toEqual({
        hand: true,
        shown: true,
    });
});

/** How a rack tag's opacity eases as it shows or hides, by the sheet. */
function readTagFade(shown: boolean) {
    const style = document.createElement("style");
    style.textContent = sheet;
    document.head.append(style);
    const tag = document.createElement("div");
    tag.className = "rack-tag-sight";
    tag.dataset.shown = shown ? "true" : "false";
    document.body.append(tag);
    const { opacity, transitionDuration } = getComputedStyle(tag);
    return { opacity, transitionDuration };
}

it("fades a rack tag in over a quarter second and out over 0.4 s", () => {
    expect(readTagFade(true)).toEqual({
        opacity: "1",
        transitionDuration: "250ms",
    });
    document.head.replaceChildren();
    document.body.replaceChildren();
    expect(readTagFade(false)).toEqual({
        opacity: "0",
        transitionDuration: "400ms",
    });
});

/** The transform on the middle card's tilt while the pointer rests on its
 *  top-left cell, with the cursor captured or free. jsdom keeps no hover
 *  state, so the sheet's `:hover` reads an attribute the test sets. */
function readHoveredTilt(captured: boolean) {
    const style = document.createElement("style");
    style.textContent = sheet.replaceAll(":hover", "[data-hovered]");
    document.head.append(style);
    document.documentElement.toggleAttribute("data-cursor-captured", captured);
    const world = createGameWorld();
    showPhase(world.spawn(SiegeTrait()), "waiting");
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        WardenTrait({ offer: offerCards(elements) }),
    );
    const { container, unmount } = render(
        <WorldProvider world={world}>
            <CardPick />
        </WorldProvider>,
    );
    const tilt = container.querySelectorAll(".card-tilt")[1];
    tilt?.querySelector(".card-cell")?.setAttribute("data-hovered", "");
    const transform = tilt ? getComputedStyle(tilt).transform : undefined;
    unmount();
    world.destroy();
    document.documentElement.removeAttribute("data-cursor-captured");
    return transform;
}

it("tilts a hovered card while the cursor is free, and lets it go while the camera captures the cursor", () => {
    expect(readHoveredTilt(false)).toBe(
        "perspective(700px) rotateX(9deg) rotateY(-9deg)",
    );
    expect(readHoveredTilt(true)).toBe("none");
});
