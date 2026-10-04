import { act, render, renderHook, screen } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    HeroTrait,
    type PanelProps,
    PlayerNameTrait,
} from "@spawnite/engine";
import { useHitFlash, Vitals } from "../../src/hud/Vitals";
import { Element } from "../../src/siege/elements";
import {
    CareerTrait,
    SiegeTrait,
    WardenElementsTrait,
    WardenTrait,
} from "../../src/siege/traits";
import { createPageWorld } from "./pageWorld";
import { showPhase } from "./phase";

//  The HUD layer lives in the canvas; here it draws in place.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({
        children,
        className,
    }: Pick<PanelProps, "children" | "className">) => (
        <div data-panel className={className}>
            {children}
        </div>
    ),
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function renderHealth(health: number) {
    return renderHook(({ health }) => useHitFlash(health), {
        initialProps: { health },
    });
}

it("flashes on a hit, then takes the flash off the page when its fade ends", () => {
    const vitals = renderHealth(100);
    expect(vitals.result.current).toBeNull();

    vitals.rerender({ health: 80 });
    expect(vitals.result.current).toBe(1);
    act(() => vi.advanceTimersByTime(440));
    expect(vitals.result.current).toBe(1);

    act(() => vi.advanceTimersByTime(20));
    expect(vitals.result.current).toBeNull();
});

it("gives a second hit its own whole flash", () => {
    const vitals = renderHealth(100);

    vitals.rerender({ health: 80 });
    act(() => vi.advanceTimersByTime(400));
    vitals.rerender({ health: 60 });
    expect(vitals.result.current).toBe(2);
    act(() => vi.advanceTimersByTime(400));
    expect(vitals.result.current).toBe(2);

    act(() => vi.advanceTimersByTime(60));
    expect(vitals.result.current).toBeNull();
});

it("flashes nothing for a heal", () => {
    const vitals = renderHealth(50);

    vitals.rerender({ health: 70 });
    expect(vitals.result.current).toBeNull();
});

it("shows her level on her panel, level 1 on a new career", () => {
    const world = createPageWorld();
    showPhase(world.spawn(SiegeTrait), "fight");
    const hero = world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait,
        CareerTrait,
    );
    const { unmount } = render(
        <WorldProvider world={world}>
            <Vitals />
        </WorldProvider>,
    );
    const first = screen.queryByText("LV 1");

    act(() => hero.set(CareerTrait, { xp: 600 }));

    expect(first).not.toBeNull();
    expect(screen.queryByText("LV 4")).not.toBeNull();
    unmount();
    world.destroy();
});

it("draws her card at four fifths on a computer and whole on a touch screen, every row with it", () => {
    const world = createPageWorld();
    showPhase(world.spawn(SiegeTrait), "fight");
    world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait,
        CareerTrait,
        WardenElementsTrait({ first: Element.Storm, firstLevel: 1 }),
    );
    const { unmount } = render(
        <WorldProvider world={world}>
            <Vitals />
        </WorldProvider>,
    );

    //  jsdom matches no media query, so the card's two sizes are read off
    //  its classes: one zoom for the whole card, undone for a coarse
    //  pointer.
    const card = screen.getByText("Ada").closest("[data-panel]");
    const classes = card?.className.split(/\s+/) ?? [];
    expect(classes).toContain("[zoom:0.8]");
    expect(classes).toContain("pointer-coarse:[zoom:1]");
    for (const row of [
        screen.getByText("LV 1"),
        screen.getByText("Blaster"),
        screen.getByRole("meter", { name: "Your health" }),
        screen.getByText("Self-revive ready if you go down"),
        screen.getByRole("meter", { name: "Storm line" }),
    ])
        expect(card?.contains(row)).toBe(true);
    unmount();
    world.destroy();
});
