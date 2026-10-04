import { act, render, screen } from "@testing-library/react";
import { showPhase } from "./phase";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { AuthorityTrait, createGameWorld, HeroTrait } from "@spawnite/engine";
import { Downed } from "../../src/hud/Downed";
import { EndCause, SiegeTrait, WardenTrait } from "../../src/siege/traits";
import { LifeTrait } from "../../src/siege/life";
import { showDown } from "./life";

//  The HUD layer lives in the canvas; here it draws in place.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children }: { children: ReactNode }) => children,
}));

/** Her screen while she and a teammate lie down in a run the room ended
 *  for `cause`, or goes on with, and its text. */
function readDowned(cause: EndCause) {
    const world = createGameWorld();
    showPhase(world.spawn(SiegeTrait({ cause })), "fight");
    showDown(
        world.spawn(HeroTrait, AuthorityTrait, WardenTrait({ health: 0 })),
        true,
    );
    showDown(world.spawn(WardenTrait({ health: 0 })), true);
    const { container, unmount } = render(
        <WorldProvider world={world}>
            <Downed />
        </WorldProvider>,
    );
    const text = container.textContent ?? "";
    unmount();
    world.destroy();
    return text;
}

it("tells a downed warden what gets her up while the run goes on", () => {
    const text = readDowned(EndCause.None);

    expect(text).toContain("You are down");
    expect(text).toContain("gets you up");
});

//  In the beat before the end screen nothing gets her up, so the screen
//  says only that she is down.
it("promises no way up on the last fall, before the end screen", () => {
    const text = readDowned(EndCause.EveryoneDown);

    expect(text).toContain("You are down");
    expect(text).not.toContain("gets you up");
    expect(text).not.toContain("Getting up");
    expect(text).not.toContain("Waiting for a warden");
});

it("says a warden is getting her up while her progress climbs, and that she waits for one while it does not", () => {
    const world = createGameWorld();
    showPhase(world.spawn(SiegeTrait), "fight");
    const ash = world.spawn(
        HeroTrait,
        AuthorityTrait,
        WardenTrait({ health: 0 }),
    );
    showDown(ash, true);
    world.spawn(WardenTrait);
    const { unmount } = render(
        <WorldProvider world={world}>
            <Downed />
        </WorldProvider>,
    );
    const waiting = screen.queryByText("Waiting for a warden");

    act(() => ash.set(LifeTrait, { revived: 0.5 }));
    const climbing = screen.queryByText("A warden is getting you up");
    act(() => ash.set(LifeTrait, { revived: 0.4 }));

    expect(waiting).not.toBeNull();
    expect(climbing).not.toBeNull();
    expect(screen.queryByText("Waiting for a warden")).not.toBeNull();
    unmount();
    world.destroy();
});
