import { act, render, screen } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    createGameWorld,
    HeroTrait,
    RunContext,
    TransformTrait,
} from "@spawnite/engine";
import { Controls, forgetControls, movedMetres } from "../../src/hud/Controls";
import { WardenTrait } from "../../src/siege/traits";
import { markShot } from "../../src/views/warden/muzzles";

//  The HUD layer lives in the canvas; here it draws in place.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
    vi.useFakeTimers();
    forgetControls();
});

afterEach(() => {
    vi.useRealTimers();
});

/** Her page, her hero standing at the origin with no shot fired. */
function renderPage() {
    const world = createGameWorld();
    const hero = world.spawn(
        HeroTrait,
        AuthorityTrait({ context: RunContext.Client }),
        TransformTrait(new Vector3()),
        WardenTrait({ hue: 3 }),
    );
    const view = render(
        <WorldProvider world={world}>
            <Controls />
        </WorldProvider>,
    );
    return {
        hero,
        world,
        view,
        frames: (count: number) =>
            act(() => {
                for (let index = 0; index < count; index++)
                    vi.advanceTimersByTime(16);
            }),
    };
}

it("leaves a few seconds after her first steps, though she has not fired", () => {
    const page = renderPage();
    page.frames(2);

    page.hero.get(TransformTrait)?.set(movedMetres + 0.1, 0, 0);
    page.frames(2);
    act(() => vi.advanceTimersByTime(2500));
    const reading = screen.queryByLabelText("Controls");
    act(() => vi.advanceTimersByTime(1000));

    expect(reading).not.toBeNull();
    expect(screen.queryByLabelText("Controls")).toBeNull();
    page.view.unmount();
    page.world.destroy();
});

it("shows the controls until she has walked, checks off what she did, then leaves them off the page", () => {
    const page = renderPage();
    page.frames(2);
    expect(screen.queryByLabelText("Controls")).not.toBeNull();

    act(() => markShot(3));
    page.frames(2);
    act(() => vi.advanceTimersByTime(5000));
    const fired = screen.queryByLabelText("Controls");
    page.hero.get(TransformTrait)?.set(movedMetres + 0.1, 0, 0);
    page.frames(2);
    act(() => vi.advanceTimersByTime(4000));

    expect(fired).not.toBeNull();
    expect(screen.queryByLabelText("Controls")).toBeNull();
    page.view.unmount();
    page.world.destroy();

    //  A strip mounted again on the same page, as a rejoin does, stays off.
    const again = renderPage();
    again.frames(2);
    expect(screen.queryByLabelText("Controls")).toBeNull();
    again.view.unmount();
    again.world.destroy();
});
