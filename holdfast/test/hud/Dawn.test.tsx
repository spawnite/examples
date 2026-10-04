import { act, render, screen } from "@testing-library/react";
import { showPhase } from "./phase";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    CameraTrait,
    HeroTrait,
    PlayerNameTrait,
    useRoom,
} from "@spawnite/engine";
import { Dawn } from "../../src/hud/Dawn";
import { CareerTrait, SiegeTrait, WardenTrait } from "../../src/siege/traits";
import { createPageWorld } from "./pageWorld";

//  The HUD layer lives in the canvas, and a modal in it; here the modal
//  draws in place while it is open, its pane and its actions row apart, so
//  the screen reads as text.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Modal: ({
        open,
        children,
        actions,
    }: {
        open: boolean;
        children: ReactNode;
        actions?: ReactNode;
    }) =>
        open ? (
            <>
                <div data-testid="pane">{children}</div>
                <div data-testid="actions">{actions}</div>
            </>
        ) : null,
}));

afterEach(() => {
    useRoom.setState(useRoom.getInitialState(), true);
    document.body.replaceChildren();
});

/** A page's world in the night's last fight, and dawn breaking on it. */
function renderLastFight() {
    const sendMessage = vi.fn();
    useRoom.setState({ sendMessage });
    const world = createPageWorld();
    world.spawn(CameraTrait({ locked: true }));
    const siege = showPhase(world.spawn(SiegeTrait({ wave: 15 })), "fight");
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait({ kills: 40 }),
    );
    const { unmount } = render(
        <WorldProvider world={world}>
            <Dawn />
        </WorldProvider>,
    );
    return {
        world,
        sendMessage,
        breakDawn: () => act(() => showPhase(siege, "dawn")),
        unmount: () => {
            unmount();
            world.destroy();
        },
    };
}

it("shows the dawn screen once the night's last wave is held, and not before", () => {
    const run = renderLastFight();
    expect(screen.queryByText("Into Endless")).toBeNull();

    run.breakDawn();

    expect(screen.queryByText("The circle held")).not.toBeNull();
    expect(screen.queryByText("Into Endless")).not.toBeNull();
    run.unmount();
});

//  The pane scrolls on a short screen; the modal's actions row under it
//  stays in view.
it("puts its buttons in the modal's actions row, out of the pane", () => {
    const run = renderLastFight();
    run.breakDawn();

    const actions = screen.getByTestId("actions");
    expect(actions).toHaveTextContent("Into Endless");
    expect(actions).toHaveTextContent("Back to the circle");
    expect(screen.getByTestId("pane")).not.toHaveTextContent("Into Endless");
    run.unmount();
});

it("says she is ready for Endless on Into Endless", () => {
    const run = renderLastFight();
    run.breakDawn();

    act(() => screen.getByText("Into Endless").click());

    expect(run.sendMessage).toHaveBeenCalledWith({
        name: "siege.ready",
        payload: {},
    });
    run.unmount();
});

it("shows her level, that the night took her up one, and what it added", () => {
    const run = renderLastFight();
    const hero = run.world.queryFirst(HeroTrait);
    hero?.add(CareerTrait({ xp: 290, runs: 1, dawns: 1, runXp: 290 }));

    run.breakDawn();

    const pane = screen.getByTestId("pane");
    expect(pane).toHaveTextContent("Level 2");
    expect(pane).toHaveTextContent("Level up");
    expect(pane).toHaveTextContent("+290 XP this run");
    expect(pane).toHaveTextContent("10 XP to level 3");
    run.unmount();
});
