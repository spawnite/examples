import { act, render, screen } from "@testing-library/react";
import { showPhase } from "./phase";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    CameraTrait,
    createGameWorld,
    DisconnectedTrait,
    HeroTrait,
    PlayerNameTrait,
    readStrafe,
} from "@spawnite/engine";
import { RunOver } from "../../src/hud/RunOver";
import { CardId } from "../../src/siege/cards";
import {
    CareerTrait,
    EndCause,
    SiegeTrait,
    WardenTrait,
} from "../../src/siege/traits";

//  The HUD layer lives in the canvas, and a modal in it; here the modal
//  draws in place while it is open, its pane and its actions row apart.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Modal: ({
        open,
        children,
        actions,
        freeCursor = true,
    }: {
        open: boolean;
        children: ReactNode;
        actions?: ReactNode;
        freeCursor?: boolean;
    }) =>
        open ? (
            <>
                <div data-testid="pane" data-free-cursor={freeCursor}>
                    {children}
                </div>
                <div data-testid="actions">{actions}</div>
            </>
        ) : null,
}));

//  The engine's Modal frees the cursor while it is open and takes the lock
//  back when it closes (packages/engine/test/components/useCameraLock.test.tsx
//  and Modal.test.tsx pin both); this pins that Holdfast leaves the camera's
//  lock alone and the modal free to do so.
it("keeps the camera's lock through the run's end, leaving the cursor to the engine's modal", () => {
    const world = createGameWorld();
    world.spawn(CameraTrait({ locked: true }));
    const siege = showPhase(world.spawn(SiegeTrait({ wave: 7 })), "fight");
    world.spawn(HeroTrait, AuthorityTrait, PlayerNameTrait({ name: "Ada" }));
    const { unmount } = render(
        <WorldProvider world={world}>
            <RunOver />
        </WorldProvider>,
    );

    act(() => showPhase(siege, "over"));

    expect(screen.getByTestId("actions")).toHaveTextContent("Go again");
    expect(readStrafe(world)).toBe(true);
    expect(screen.getByTestId("pane").dataset.freeCursor).toBe("true");
    unmount();
    world.destroy();
});

//  The pane scrolls on a short screen; the modal's actions row under it
//  stays in view.
it("puts its buttons in the modal's actions row, out of the pane", () => {
    const world = createGameWorld();
    world.spawn(CameraTrait({ locked: true }));
    showPhase(world.spawn(SiegeTrait({ wave: 7 })), "over");
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait({ kills: 40 }),
    );
    const { unmount } = render(
        <WorldProvider world={world}>
            <RunOver />
        </WorldProvider>,
    );

    const actions = screen.getByTestId("actions");
    expect(actions).toHaveTextContent("Go again");
    expect(actions).toHaveTextContent("Back to the circle");
    expect(screen.getByTestId("pane")).not.toHaveTextContent("Go again");
    unmount();
    world.destroy();
});

/** Draws the end screen over a run the room ended for `cause`, with
 *  `wardens` in the room, the first hers, and returns its pane's text. */
function readWhy(
    cause: EndCause,
    ...wardens: { selfRevive: boolean; dropped?: boolean }[]
) {
    const world = createGameWorld();
    world.spawn(CameraTrait({ locked: true }));
    showPhase(world.spawn(SiegeTrait({ wave: 14, cause })), "over");
    wardens.forEach(({ selfRevive, dropped }, index) => {
        const warden = world.spawn(
            PlayerNameTrait({ name: `Warden ${index}` }),
            WardenTrait({ selfRevive }),
        );
        if (index === 0) warden.add(HeroTrait, AuthorityTrait);
        if (dropped) warden.add(DisconnectedTrait);
    });
    const { unmount } = render(
        <WorldProvider world={world}>
            <RunOver />
        </WorldProvider>,
    );
    const text = screen.getByTestId("pane").textContent ?? "";
    unmount();
    world.destroy();
    return text;
}

//  A warden alone who fell again with her self-revive spent saw the run
//  end with no word of why, on 2026-09-28.
it("says why the circle fell: her second fall alone, or every warden down", () => {
    expect(readWhy(EndCause.FellAlone, { selfRevive: false })).toContain(
        "with your one self-revive spent",
    );
    expect(
        readWhy(
            EndCause.EveryoneDown,
            { selfRevive: true },
            { selfRevive: true },
        ),
    ).toContain("Every warden was down at once");
});

//  The reason is the room's, kept as the run ended: a teammate who drops
//  while the screen shows leaves it as it was.
it("keeps a team's reason after a teammate drops", () => {
    expect(
        readWhy(
            EndCause.EveryoneDown,
            { selfRevive: true },
            { selfRevive: true, dropped: true },
        ),
    ).toContain("Every warden was down at once");
});

it("lists the stat cards a warden held, and none of her element cards", () => {
    const world = createGameWorld();
    world.spawn(CameraTrait({ locked: true }));
    showPhase(world.spawn(SiegeTrait({ wave: 7 })), "over");
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait({
            cards: [
                CardId.StormSurge,
                CardId.HeavyRounds,
                CardId.StormSurge,
                CardId.FleetFoot,
            ],
        }),
    );
    const { unmount } = render(
        <WorldProvider world={world}>
            <RunOver />
        </WorldProvider>,
    );

    const pane = screen.getByTestId("pane");
    expect(pane).toHaveTextContent("Heavy Rounds, Fleet Foot");
    expect(pane).not.toHaveTextContent("Storm Surge");
    unmount();
    world.destroy();
});

/** The end screen on a page whose own warden has `career`, a teammate's
 *  hero with `teammate`'s streamed before hers. */
function renderCareers(
    career: { xp: number; runXp: number },
    teammate: { xp: number; runXp: number },
) {
    const world = createGameWorld();
    world.spawn(CameraTrait({ locked: true }));
    showPhase(world.spawn(SiegeTrait({ wave: 7 })), "over");
    //  A teammate's hero, which her page does not own.
    world.spawn(
        HeroTrait,
        PlayerNameTrait({ name: "Bo" }),
        WardenTrait,
        CareerTrait({ runs: 30, ...teammate }),
    );
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait,
        CareerTrait({ runs: 3, ...career }),
    );
    const { unmount } = render(
        <WorldProvider world={world}>
            <RunOver />
        </WorldProvider>,
    );
    return () => {
        unmount();
        world.destroy();
    };
}

it("shows her level, what the run added and what the next level needs, and no teammate's", () => {
    //  Bo went from level 9 to 10 this run; she stayed at 4.
    const close = renderCareers(
        { xp: 700, runXp: 52 },
        { xp: 4550, runXp: 90 },
    );

    const pane = screen.getByTestId("pane");
    expect(pane).toHaveTextContent("Level 4");
    expect(pane).toHaveTextContent("+52 XP this run");
    expect(pane).toHaveTextContent("300 XP to level 5");
    expect(pane).not.toHaveTextContent("Level 10");
    expect(pane).not.toHaveTextContent("Level up");
    close();
});

it("says Level up where the run carried her over a level", () => {
    const close = renderCareers(
        { xp: 652, runXp: 152 },
        { xp: 5000, runXp: 90 },
    );

    const pane = screen.getByTestId("pane");
    expect(pane).toHaveTextContent("Level 4");
    expect(pane).toHaveTextContent("Level up");
    expect(pane).toHaveTextContent("+152 XP this run");
    close();
});
