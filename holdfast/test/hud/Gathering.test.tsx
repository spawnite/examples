import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Phase } from "../../src/siege/phase";
import { showPhase } from "./phase";
import { stubTouchScreen } from "./pointer";
import { WorldProvider } from "koota/react";
import { afterEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    HeroTrait,
    PlayerNameTrait,
    RoomStatus,
    useMenu,
    useRoom,
} from "@spawnite/engine";
import { Gathering } from "../../src/hud/Gathering";
import { useHand } from "../../src/hud/hand";
import { CardId, offerCards } from "../../src/siege/cards";
import { SiegeTrait, WardenTrait } from "../../src/siege/traits";
import { showReady } from "./life";
import { createPageWorld } from "./pageWorld";

//  The HUD layer lives in the canvas; here it draws in place.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => {
    vi.unstubAllGlobals();
    useHand.setState(useHand.getInitialState(), true);
    useRoom.setState(useRoom.getInitialState(), true);
    useMenu.setState(useMenu.getInitialState(), true);
    document.body.replaceChildren();
});

interface Wait {
    phase: Phase;
    ready: boolean;
    startWithout?: boolean;
    /** The wave the run stands at: a breather after wave 1 unless told. */
    wave?: number;
    /** Whether her element pick is dealt to her. */
    picking?: boolean;
}

/** Her page in a room in `phase`, ready or not, and the room's sends
 *  recorded. */
function renderWait({
    phase,
    ready,
    startWithout = false,
    wave = 1,
    picking = false,
}: Wait) {
    const sendMessage = vi.fn();
    useRoom.setState({ sendMessage, status: RoomStatus.Joined });
    const world = createPageWorld();
    showPhase(world.spawn(SiegeTrait({ startWithout, wave })), phase);
    const ada = world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait({
            offer: picking
                ? offerCards([CardId.Storm, CardId.Ember, CardId.Frost])
                : [],
        }),
    );
    showReady(ada, ready);
    world.spawn(PlayerNameTrait({ name: "Bo" }), WardenTrait);
    const { unmount } = render(
        <WorldProvider world={world}>
            <Gathering />
        </WorldProvider>,
    );
    return {
        sendMessage,
        unmount: () => {
            unmount();
            world.destroy();
        },
    };
}

/** A press of the key `code` and its release, as a finger makes one. */
function press(code: string) {
    window.dispatchEvent(new KeyboardEvent("keydown", { code }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code }));
}

it("says she is ready on R while the wardens gather", () => {
    const { sendMessage, unmount } = renderWait({
        phase: "waiting",
        ready: false,
    });

    press("KeyR");

    expect(sendMessage).toHaveBeenCalledWith({
        name: "siege.ready",
        payload: {},
    });
    unmount();
});

it("takes her ready back on R once she is ready, on the end screen too", () => {
    const { sendMessage, unmount } = renderWait({
        phase: "over",
        ready: true,
    });

    press("KeyR");

    expect(sendMessage).toHaveBeenCalledWith({
        name: "siege.unready",
        payload: {},
    });
    unmount();
});

it("says she is ready on R during a breather and at dawn, and takes it back on R", () => {
    for (const phase of ["breather", "dawn"] as const) {
        const waiting = renderWait({ phase, ready: false });
        press("KeyR");
        expect(waiting.sendMessage).toHaveBeenCalledWith({
            name: "siege.ready",
            payload: {},
        });
        waiting.unmount();

        const ready = renderWait({ phase, ready: true });
        press("KeyR");
        expect(ready.sendMessage).toHaveBeenCalledWith({
            name: "siege.unready",
            payload: {},
        });
        ready.unmount();
    }
});

it("sends no ready on R in the first breather, which follows the gathering's own ready", () => {
    const { sendMessage, unmount } = renderWait({
        phase: "breather",
        ready: false,
        wave: 0,
    });

    press("KeyR");

    expect(sendMessage).not.toHaveBeenCalled();
    unmount();
});

it("sends no ready on R while a wave is fought", () => {
    const { sendMessage, unmount } = renderWait({
        phase: "fight",
        ready: false,
    });

    press("KeyR");

    expect(sendMessage).not.toHaveBeenCalled();
    unmount();
});

it("starts without the rest on Enter once the room offers it to a ready warden", () => {
    const { sendMessage, unmount } = renderWait({
        phase: "waiting",
        ready: true,
        startWithout: true,
    });

    press("Enter");

    expect(sendMessage).toHaveBeenCalledWith({
        name: "siege.startWithout",
        payload: {},
    });
    unmount();
});

it("sends no start without the rest before the room offers it, nor from one not ready", () => {
    const early = renderWait({ phase: "waiting", ready: true });
    press("Enter");
    expect(early.sendMessage).not.toHaveBeenCalled();
    early.unmount();

    const unready = renderWait({
        phase: "waiting",
        ready: false,
        startWithout: true,
    });
    press("Enter");

    expect(unready.sendMessage).not.toHaveBeenCalled();
    unready.unmount();
});

it("leaves R and Enter to the menu while it is open", () => {
    const { sendMessage, unmount } = renderWait({
        phase: "waiting",
        ready: true,
        startWithout: true,
    });
    useMenu.getState().openMenu();

    press("Enter");
    press("KeyR");

    expect(sendMessage).not.toHaveBeenCalled();
    unmount();
});

it("sends nothing on R while a run is on", () => {
    const { sendMessage, unmount } = renderWait({
        phase: "fight",
        ready: false,
    });

    press("KeyR");

    expect(sendMessage).not.toHaveBeenCalled();
    unmount();
});

it("leaves the top of a touch screen to her element pick while it stands open", () => {
    stubTouchScreen();
    const picking = renderWait({
        phase: "waiting",
        ready: false,
        picking: true,
    });
    const hidden = screen.queryByText("Step into the green ring by the fire");
    act(() => useHand.setState({ folded: true }));
    const folded = screen.queryByText("Step into the green ring by the fire");
    picking.unmount();

    expect(hidden).toBeNull();
    expect(folded).not.toBeNull();
});

it("keeps the banner over her element pick on a computer", () => {
    const picking = renderWait({
        phase: "waiting",
        ready: false,
        picking: true,
    });

    expect(
        screen.queryByText("Step into the green ring by the fire"),
    ).not.toBeNull();
    picking.unmount();
});
