import { act, render, screen } from "@testing-library/react";
import type { Phase } from "../../src/siege/phase";
import { showPhase } from "./phase";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    createGameWorld,
    HeroTrait,
    PlayerNameTrait,
    RunContext,
} from "@spawnite/engine";
import {
    Announcer,
    callSeconds,
    forgetRackCall,
} from "../../src/hud/Announcer";
import { readRevealTimes } from "../../src/hud/cardReveal";
import {
    type CardOffer,
    Rarity,
    SiegeTrait,
    WardenTrait,
    WaveName,
} from "../../src/siege/traits";
import { nightWaves } from "../../src/siege/waves";
import { showDown } from "./life";

//  The HUD layer lives in the canvas; here it draws in place, so the calls
//  read as text.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children }: { children: ReactNode }) => children,
}));

//  A call comes down after its seconds, on a timer the next test must not
//  inherit.
beforeEach(() => {
    vi.useFakeTimers();
    forgetRackCall();
});

afterEach(() => {
    act(() => vi.runAllTimers());
    vi.useRealTimers();
});

/** Another warden, Bo, down in a run in `phase`, on a page's world. */
function renderDownedBo(phase: Phase) {
    const world = createGameWorld();
    const siege = showPhase(world.spawn(SiegeTrait), phase);
    const bo = world.spawn(PlayerNameTrait({ name: "Bo" }), WardenTrait);
    showDown(bo, true);
    const { unmount } = render(
        <WorldProvider world={world}>
            <Announcer />
        </WorldProvider>,
    );
    return {
        getUp: (next: Phase) =>
            act(() => {
                showPhase(siege, next);
                showDown(bo, false);
            }),
        unmount: () => {
            unmount();
            world.destroy();
        },
    };
}

it("calls out a warden a teammate got up during a wave", () => {
    const run = renderDownedBo("fight");

    run.getUp("fight");

    expect(screen.queryByText("Bo is back up")).not.toBeNull();
    run.unmount();
});

it("calls out nobody the run's end stands up by the fire", () => {
    const run = renderDownedBo("fight");

    run.getUp("over");

    expect(screen.queryByText("Bo is back up")).toBeNull();
    run.unmount();
});

/** A run in a breather before `wave`, which the room names `named`, on a
 *  page's world, and the wave rising. */
function renderBreather(wave: number, named: WaveName) {
    const world = createGameWorld();
    const siege = showPhase(
        world.spawn(SiegeTrait({ wave: wave - 1, named })),
        "breather",
    );
    const { unmount } = render(
        <WorldProvider world={world}>
            <Announcer />
        </WorldProvider>,
    );
    return {
        rise: () =>
            act(() => {
                siege.set(SiegeTrait, { wave });
                showPhase(siege, "fight");
            }),
        //  As the room streams a wave rising: the phase in one delta,
        //  the wave's number and name in the next.
        riseInTwoDeltas: () => {
            act(() => showPhase(siege, "fight"));
            act(() => siege.set(SiegeTrait, { wave, named }));
        },
        unmount: () => {
            unmount();
            world.destroy();
        },
    };
}

it("calls a named wave by its name as it rises", () => {
    const run = renderBreather(7, WaveName.Brutes);

    run.rise();

    expect(screen.queryByText("Brutes")).not.toBeNull();
    expect(screen.queryByText(/Wave 7/)).not.toBeNull();
    run.unmount();
});

it("names the wave that rises, though its number reaches the page a delta after the phase", () => {
    const run = renderBreather(1, WaveName.Plain);

    run.riseInTwoDeltas();

    expect(screen.queryByText("Wave 1")).not.toBeNull();
    expect(screen.queryByText("Wave 0")).toBeNull();
    run.unmount();
});

it("names a named wave by its own name, though its name reaches the page a delta after the phase", () => {
    const run = renderBreather(7, WaveName.Horde);

    run.riseInTwoDeltas();

    expect(screen.queryByText("Horde")).not.toBeNull();
    expect(screen.queryByText("Wave 7")).not.toBeNull();
    expect(screen.queryByText("Wave 6")).toBeNull();
    run.unmount();
});

it("calls the last colossus at the night's last wave", () => {
    const run = renderBreather(nightWaves, WaveName.Plain);

    run.rise();

    expect(screen.queryByText("The last colossus")).not.toBeNull();
    run.unmount();
});

/** Her page in a fight of wave 3 beside Bo, both standing. */
function renderFightWithAsh() {
    const world = createGameWorld();
    const siege = showPhase(world.spawn(SiegeTrait({ wave: 3 })), "fight");
    const ash = world.spawn(
        HeroTrait,
        AuthorityTrait({ context: RunContext.Client }),
        PlayerNameTrait({ name: "Ash" }),
        WardenTrait,
    );
    const bo = world.spawn(PlayerNameTrait({ name: "Bo" }), WardenTrait);
    const { unmount } = render(
        <WorldProvider world={world}>
            <Announcer />
        </WorldProvider>,
    );
    return {
        siege,
        ash,
        bo,
        unmount: () => {
            unmount();
            world.destroy();
        },
    };
}

const offer: CardOffer[] = [
    { card: "heavy-rounds", rarity: Rarity.Common },
    { card: "iron-heart", rarity: Rarity.Rare },
    { card: "fleet-foot", rarity: Rarity.Common },
];

it("lets the held call give way as her cards are dealt, and holds a call made during the deal until the cards settle", () => {
    const run = renderFightWithAsh();
    act(() => showPhase(run.siege, "breather"));
    const held = screen.queryByText("Wave 3 held");

    act(() => run.ash.set(WardenTrait, { offer }));
    act(() => vi.advanceTimersByTime(400));
    const afterDeal = screen.queryByText("Wave 3 held");
    act(() => showDown(run.bo, true));
    const duringDeal = screen.queryByText("Bo is down");
    act(() => vi.advanceTimersByTime(readRevealTimes(offer).settle + 600));

    expect(held).not.toBeNull();
    expect(afterDeal).toBeNull();
    expect(duringDeal).toBeNull();
    expect(screen.queryByText("Bo is down")).not.toBeNull();
    run.unmount();
});

it("takes a call down once its seconds are over", () => {
    const run = renderFightWithAsh();
    act(() => showDown(run.bo, true));
    const up = screen.queryByText("Bo is down");

    act(() => vi.advanceTimersByTime(callSeconds * 1000 + 400));

    expect(up).not.toBeNull();
    expect(screen.queryByText("Bo is down")).toBeNull();
    run.unmount();
});

it("calls her back on her feet when a teammate gets her up during a wave", () => {
    const run = renderFightWithAsh();
    act(() => showDown(run.ash, true));

    act(() => showDown(run.ash, false));

    expect(screen.queryByText("Back on your feet")).not.toBeNull();
    run.unmount();
});

it("points her to the rack once her first free card is taken, and not again", () => {
    const run = renderFightWithAsh();
    act(() => showPhase(run.siege, "breather"));
    act(() => run.ash.set(WardenTrait, { offer }));
    act(() => vi.advanceTimersByTime(readRevealTimes(offer).settle + 600));

    act(() => run.ash.set(WardenTrait, { taken: "heavy-rounds" }));
    const first = screen.queryByText("Spend coins at the rack");
    act(() => vi.advanceTimersByTime(callSeconds * 1000 + 400));
    act(() => run.ash.set(WardenTrait, { taken: "iron-heart" }));

    expect(first).not.toBeNull();
    expect(screen.queryByText("Spend coins at the rack")).toBeNull();
    run.unmount();
});

it("points her to the rack in the next breather when the room made her free pick for her", () => {
    const run = renderFightWithAsh();

    act(() => run.ash.set(WardenTrait, { cards: ["heavy-rounds"] }));
    const inWave = screen.queryByText("Spend coins at the rack");
    act(() => showPhase(run.siege, "breather"));
    const beforeDeal = screen.queryByText("Spend coins at the rack");
    act(() => run.ash.set(WardenTrait, { offer }));
    act(() => vi.advanceTimersByTime(readRevealTimes(offer).settle + 600));

    expect(inWave).toBeNull();
    expect(beforeDeal).toBeNull();
    expect(screen.queryByText("Spend coins at the rack")).not.toBeNull();
    run.unmount();
});
