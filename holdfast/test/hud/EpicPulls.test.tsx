import { act, render } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    createGameWorld,
    HeroTrait,
    PlayerNameTrait,
} from "@spawnite/engine";
import { EpicPulls } from "../../src/hud/EpicPulls";
import { CardId } from "../../src/siege/cards";
import { type CardOffer, Rarity, WardenTrait } from "../../src/siege/traits";

//  The HUD layer lives in the canvas; here a Hud and its Panel draw their
//  children in place, so the line can be read.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
});

const commons: CardOffer[] = [
    { card: CardId.HeavyRounds, rarity: Rarity.Common },
    { card: CardId.FleetFoot, rarity: Rarity.Common },
];
const withEpic: CardOffer[] = [
    { card: CardId.HeavyRounds, rarity: Rarity.Common },
    { card: CardId.HairTrigger, rarity: Rarity.Epic },
];

/** A world with a teammate named Ada holding `offer`, and the page's own
 *  warden unless `own` is false, as the room has none. */
function renderPulls(offer: CardOffer[], { own = true } = {}) {
    const world = createGameWorld();
    if (own)
        world.spawn(
            HeroTrait,
            AuthorityTrait,
            PlayerNameTrait({ name: "Me" }),
            WardenTrait({ offer: [] }),
        );
    const ada = world.spawn(
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait({ offer }),
    );
    const view = render(
        <WorldProvider world={world}>
            <EpicPulls />
        </WorldProvider>,
    );
    return {
        view,
        deal: (next: CardOffer[]) =>
            act(() => {
                ada.set(WardenTrait, { offer: next });
            }),
        unmount: () => {
            view.unmount();
            world.destroy();
        },
    };
}

it("names a teammate's epic when she is dealt one, and lets it go after a couple of seconds", () => {
    const { view, deal, unmount } = renderPulls(commons);

    deal(withEpic);

    expect(view.container.textContent).toContain("Ada");
    expect(view.container.textContent).toContain("EPIC");
    expect(view.container.textContent).toContain("Hair Trigger");
    act(() => {
        vi.advanceTimersByTime(2500);
    });
    expect(view.container.textContent).not.toContain("Hair Trigger");
    unmount();
});

it("names no epic a teammate already held as the page joined", () => {
    const { view, unmount } = renderPulls(withEpic);

    expect(view.container.textContent).not.toContain("EPIC");
    unmount();
});

it("names nothing where the world holds no warden of the page's own, as the room's does not", () => {
    const { view, deal, unmount } = renderPulls(commons, { own: false });

    deal(withEpic);

    expect(view.container.textContent).toBe("");
    unmount();
});

it("names no epic dealt to the page's own warden", () => {
    const world = createGameWorld();
    const own = world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Me" }),
        WardenTrait({ offer: commons }),
    );
    const view = render(
        <WorldProvider world={world}>
            <EpicPulls />
        </WorldProvider>,
    );

    act(() => {
        own.set(WardenTrait, { offer: withEpic });
    });

    expect(view.container.textContent).not.toContain("EPIC");
    view.unmount();
    world.destroy();
});
