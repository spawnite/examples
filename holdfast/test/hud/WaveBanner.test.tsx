import { act, render } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    ConnectionNotice,
    createGameWorld,
    HeroTrait,
    readRoomNotice,
    RoomStatus,
    useRoom,
} from "@spawnite/engine";
import { useHand } from "../../src/hud/hand";
import { WaveBanner } from "../../src/hud/WaveBanner";
import { CardId, offerCards } from "../../src/siege/cards";
import { SiegeTrait, WardenTrait } from "../../src/siege/traits";
import { createPageWorld } from "./pageWorld";
import { showPhase } from "./phase";
import { stubTouchScreen } from "./pointer";

//  The HUD layer lives in the canvas; here it draws in place.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => {
    vi.unstubAllGlobals();
    useRoom.setState(useRoom.getInitialState(), true);
    useHand.setState(useHand.getInitialState(), true);
});

/** The banner's text while the room stands at `status` with `notice`. */
function readBanner(status: RoomStatus, notice: ConnectionNotice | null) {
    const world = createGameWorld();
    const { container, unmount } = render(
        <WorldProvider world={world}>
            <WaveBanner />
        </WorldProvider>,
    );
    act(() => useRoom.setState({ status, notice: readRoomNotice(notice) }));
    const text = container.textContent ?? "";
    unmount();
    world.destroy();
    return text;
}

it("says the engine's notice while she reconnects and while she joins again", () => {
    expect(
        readBanner(RoomStatus.Reconnecting, ConnectionNotice.Reconnecting),
    ).toContain("Connection lost. Reconnecting…");
    expect(
        readBanner(RoomStatus.Rejoining, ConnectionNotice.Rejoining),
    ).toContain("Rejoining the game…");
    expect(readBanner(RoomStatus.Closed, ConnectionNotice.Failed)).toContain(
        "Couldn't reconnect. Play again.",
    );
});

it("says how full the game is where it turned her away for that", () => {
    const world = createGameWorld();
    const { container, unmount } = render(
        <WorldProvider world={world}>
            <WaveBanner />
        </WorldProvider>,
    );
    act(() =>
        useRoom.setState({
            status: RoomStatus.Closed,
            full: { players: 4, maxPlayers: 4 },
            notice: readRoomNotice(ConnectionNotice.Failed),
        }),
    );

    expect(container.textContent).toContain("This game is full (4 of 4)");
    expect(container.textContent).not.toMatch(/\broom\b/i);
    unmount();
    world.destroy();
});

/** The banner's text in a breather with her free card on offer, on a
 *  phone held upright, while her hand stands open and once it folds. */
function readBreatherBanner() {
    stubTouchScreen({ upright: true });
    useRoom.setState({ status: RoomStatus.Joined });
    const world = createPageWorld();
    showPhase(
        world.spawn(SiegeTrait({ wave: 1, secondsLeft: 20 })),
        "breather",
    );
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        WardenTrait({ offer: offerCards([CardId.HeavyRounds]) }),
    );
    const { container, unmount } = render(
        <WorldProvider world={world}>
            <WaveBanner />
        </WorldProvider>,
    );
    const open = container.textContent ?? "";
    act(() => useHand.setState({ folded: true }));
    const folded = container.textContent ?? "";
    unmount();
    world.destroy();
    return { open, folded };
}

it("leaves the top of a phone held upright to her open hand, and comes back as it folds", () => {
    const { open, folded } = readBreatherBanner();

    expect(open).toBe("");
    expect(folded).toContain("Wave 2");
});
