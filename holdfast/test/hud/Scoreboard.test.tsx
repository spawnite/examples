import { act, render, screen, within } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, onTestFinished, vi } from "vitest";
import {
    AuthorityTrait,
    createGameWorld,
    HeroTrait,
    type PanelProps,
    PlayerNameTrait,
    RunContext,
    Slot,
    trackMovementKeys,
    useSettings,
    WalletTrait,
} from "@spawnite/engine";
import { plugins } from "../../src/game";
import { VoiceMode } from "@spawnite/schema";
import { useHand } from "../../src/hud/hand";
import { topOrder } from "../../src/hud/look";
import { Scoreboard } from "../../src/hud/Scoreboard";
import { CardId, offerCards } from "../../src/siege/cards";
import {
    type CardOffer,
    CareerTrait,
    Rarity,
    SiegeTrait,
    WardenTrait,
} from "../../src/siege/traits";
import type { Phase } from "../../src/siege/phase";
import { showDown, showReady } from "./life";
import { showPhase } from "./phase";
import { stubTouchScreen } from "./pointer";
import { useCoinsInFlight } from "../../src/views/CoinView";

//  The HUD layer lives in the canvas; here it draws in place.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({
        children,
        slot,
        order,
        className,
    }: Pick<PanelProps, "children" | "slot" | "order" | "className">) => (
        <div
            data-panel
            data-slot={slot}
            data-order={order}
            className={className}
        >
            {children}
        </div>
    ),
}));

afterEach(() => {
    useCoinsInFlight.setState({ coins: 0 });
    vi.unstubAllGlobals();
});

/** The panel the wardens list stands in. */
function readListPanel() {
    return screen.getByRole("list").closest("[data-panel]");
}

/** The scoreboard of a fight with her, Ash, down on 12 coins with 3 still
 *  flying to her, and Bo on 12, none of which fly on Ash's page. */
function renderFight() {
    const world = createGameWorld();
    showPhase(world.spawn(SiegeTrait), "fight");
    const ash = world.spawn(
        HeroTrait,
        AuthorityTrait({ context: RunContext.Client }),
        PlayerNameTrait({ name: "Ash Lantern" }),
        WardenTrait,
        WalletTrait({ coins: 12 }),
    );
    showDown(ash, true);
    world.spawn(
        HeroTrait,
        PlayerNameTrait({ name: "Bo" }),
        WardenTrait,
        WalletTrait({ coins: 12 }),
    );
    useCoinsInFlight.setState({ coins: 3 });
    const { unmount } = render(
        <WorldProvider world={world}>
            <Scoreboard />
        </WorldProvider>,
    );
    return () => {
        unmount();
        world.destroy();
    };
}

it("counts her own coins as they land, as her health panel does, and a teammate's as the room credits them", () => {
    const close = renderFight();

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
        "Ash Lantern, you: down, 9 coins, 0 kills",
        "Bo: 12 coins, 0 kills",
    ]);
    close();
});

it("keeps her name whole beside her tag and her state, in elements of their own", () => {
    const close = renderFight();

    expect(screen.getByText("Ash Lantern").textContent).toBe("Ash Lantern");
    expect(screen.getByText("you")).not.toBeNull();
    expect(screen.getByText("Down")).not.toBeNull();
    close();
});

/** The scoreboard in `phase` of her, Ash, and Bo, whose offer is `offer`
 *  with nothing taken, ready or not. */
function renderRun(
    phase: Phase,
    bo: Partial<{ ready: boolean; taken: string; offer: CardOffer[] }> = {},
) {
    //  The game's plugins, whose counts key the engine's listener binds.
    const world = createGameWorld(plugins);
    onTestFinished(trackMovementKeys(window, world));
    //  A breather after the first wave: the first breather asks nothing.
    showPhase(world.spawn(SiegeTrait({ wave: 1 })), phase);
    world.spawn(
        HeroTrait,
        AuthorityTrait({ context: RunContext.Client }),
        PlayerNameTrait({ name: "Ash" }),
        WardenTrait,
        WalletTrait({ coins: 30 }),
    );
    const teammate = world.spawn(
        HeroTrait,
        PlayerNameTrait({ name: "Bo" }),
        WardenTrait({
            offer: bo.offer ?? offerCards([CardId.HeavyRounds]),
            taken: bo.taken ?? "",
        }),
        WalletTrait({ coins: 12 }),
    );
    showReady(teammate, bo.ready ?? false);
    const view = render(
        <WorldProvider world={world}>
            <Scoreboard />
        </WorldProvider>,
    );
    return {
        world,
        teammate,
        view,
        /** Bo's row. */
        row: () => screen.getAllByRole("listitem")[1],
        close: () => {
            view.unmount();
            world.destroy();
        },
    };
}

it("tags a warden who has not made her free pick in a breather Choosing, beside Ready", () => {
    const run = renderRun("breather", { ready: true });

    const tags = within(run.row()).getAllByText(/^(Ready|Choosing)$/);

    expect(tags.map((tag) => tag.textContent)).toEqual(["Ready", "Choosing"]);
    run.close();
});

it("tags no warden Choosing once she has taken her free card", () => {
    const run = renderRun("breather", { taken: CardId.HeavyRounds });

    expect(within(run.row()).queryByText("Choosing")).toBeNull();
    run.close();
});

it("shows the coins and kills in a breather", () => {
    const run = renderRun("breather");

    expect(within(run.row()).queryByText("12")).not.toBeNull();
    run.close();
});

it("leaves her own coins to her health panel", () => {
    const run = renderRun("breather");
    const own = screen.getAllByRole("listitem")[0];

    expect(within(own).queryByText("30")).toBeNull();
    run.close();
});

it("leaves Tab to push to talk where it is her talk key", () => {
    useSettings.getState().changeSetting("voiceMode", VoiceMode.PushToTalk);
    useSettings.getState().changeSetting("pushToTalkKey", "Tab");
    const run = renderRun("fight");

    act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Tab" }));
    });

    expect(within(run.row()).queryByText("12")).toBeNull();
    act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Tab" }));
    });
    useSettings.getState().resetSettings();
    run.close();
});

it("keeps the coins and kills off the board during a wave, and shows them while Tab is held", () => {
    const run = renderRun("fight");
    const inWave = within(run.row()).queryByText("12");

    act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Tab" }));
    });
    const held = within(run.row()).queryByText("12");
    act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "Tab" }));
    });

    expect(inWave).toBeNull();
    expect(held).not.toBeNull();
    expect(within(run.row()).queryByText("12")).toBeNull();
    run.close();
});

it("shows each warden's level in her own row, level 1 among them", () => {
    const run = renderRun("fight");
    const own = run.world.queryFirst(AuthorityTrait);

    act(() => {
        own?.add(CareerTrait({ xp: 600 }));
        run.teammate.add(CareerTrait);
    });

    const [ownRow, teammateRow] = screen.getAllByRole("listitem");
    expect(within(ownRow).queryByText("LV 4")).not.toBeNull();
    expect(within(teammateRow).queryByText("LV 1")).not.toBeNull();
    expect(teammateRow.getAttribute("aria-label")).toBe(
        "Bo, level 1: 12 coins, 0 kills",
    );
    run.close();
});

it("flashes a teammate's row as she is dealt an epic", () => {
    const run = renderRun("breather");
    const before = run.row().querySelector(".score-pull");

    act(() =>
        run.teammate.set(WardenTrait, {
            ...run.teammate.get(WardenTrait),
            offer: [{ card: CardId.FleetFoot, rarity: Rarity.Epic }],
        }),
    );

    expect(before).toBeNull();
    expect(run.row().querySelector(".score-pull")).not.toBeNull();
    run.close();
});

it("keeps the wardens list in the top right corner on a computer", () => {
    const run = renderRun("breather");

    expect(readListPanel()?.getAttribute("data-slot")).toBe(Slot.TopRight);
    expect(screen.queryByText("Wardens")).not.toBeNull();
    run.close();
});

it("lists the wardens on a touch screen as one compact row under the banner, without the counts", () => {
    stubTouchScreen();
    const run = renderRun("breather", { ready: true });

    const panel = readListPanel();
    expect(panel?.getAttribute("data-slot")).toBe(Slot.Top);
    const order = Number(panel?.getAttribute("data-order"));
    expect(order).toBeGreaterThan(topOrder.banner);
    expect(order).toBeLessThan(topOrder.calls);
    expect(within(run.row()).queryByText("Bo")).not.toBeNull();
    expect(within(run.row()).queryByText("Ready")).not.toBeNull();
    expect(within(run.row()).queryByText("12")).toBeNull();
    expect(screen.queryByText("you")).toBeNull();
    expect(screen.queryByText("Wardens")).toBeNull();
    run.close();
});

it("starts the top's stack under the corner's buttons on a touch screen held upright", () => {
    stubTouchScreen();
    const run = renderRun("fight");

    const spacer = [
        ...run.view.container.querySelectorAll(
            `[data-panel][data-slot="${Slot.Top}"]`,
        ),
    ].find((panel) => !panel.querySelector("ul"));
    expect(Number(spacer?.getAttribute("data-order"))).toBeLessThan(
        topOrder.banner,
    );
    const classes = spacer?.className.split(/\s+/) ?? [];
    expect(classes).toContain("hidden");
    expect(classes).toContain("portrait:block");
    expect(classes).toContain("h-[44px]");
    //  An empty panel in a full cell shrinks to nothing unless held.
    expect(classes).toContain("shrink-0");
    run.close();
});

it("takes the wardens off a touch screen's top while her element pick stands open", () => {
    stubTouchScreen();
    const world = createGameWorld();
    showPhase(world.spawn(SiegeTrait), "waiting");
    world.spawn(
        HeroTrait,
        AuthorityTrait({ context: RunContext.Client }),
        PlayerNameTrait({ name: "Ash" }),
        WardenTrait({
            offer: offerCards([CardId.Storm, CardId.Ember, CardId.Frost]),
        }),
    );
    const view = render(
        <WorldProvider world={world}>
            <Scoreboard />
        </WorldProvider>,
    );
    const picking = screen.queryByRole("list");
    act(() => useHand.setState({ folded: true }));
    const folded = screen.queryByRole("list");
    view.unmount();
    world.destroy();
    useHand.setState(useHand.getInitialState(), true);

    expect(picking).toBeNull();
    expect(folded).not.toBeNull();
});

it("takes the wardens off the top of a phone held upright while her breather's hand stands open", () => {
    stubTouchScreen({ upright: true });
    const run = renderRun("breather");
    act(() =>
        run.world
            .queryFirst(HeroTrait, AuthorityTrait)
            ?.set(WardenTrait, { offer: offerCards([CardId.HeavyRounds]) }),
    );
    const open = screen.queryByRole("list");
    act(() => useHand.setState({ folded: true }));
    const folded = screen.queryByRole("list");
    run.close();
    useHand.setState(useHand.getInitialState(), true);

    expect(open).toBeNull();
    expect(folded).not.toBeNull();
});

it("takes the wardens off the top of a phone on its side while her breather's hand stands open", () => {
    stubTouchScreen();
    const run = renderRun("breather");
    act(() =>
        run.world
            .queryFirst(HeroTrait, AuthorityTrait)
            ?.set(WardenTrait, { offer: offerCards([CardId.HeavyRounds]) }),
    );
    const open = screen.queryByRole("list");
    act(() => useHand.setState({ folded: true }));
    const folded = screen.queryByRole("list");
    run.close();
    useHand.setState(useHand.getInitialState(), true);

    expect(open).toBeNull();
    expect(folded).not.toBeNull();
});
