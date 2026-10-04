import { act, render, screen } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    AuthorityTrait,
    createGameWorld,
    HeroTrait,
    PlayerNameTrait,
} from "@spawnite/engine";
import { ElementLines, LineCalls } from "../../src/hud/ElementLines";
import { Element } from "../../src/siege/elements";
import { WardenElementsTrait, WardenTrait } from "../../src/siege/traits";

//  The HUD layer lives in the canvas; here it draws in place, so the lines
//  and the calls read as text.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    act(() => vi.runAllTimers());
    vi.useRealTimers();
    document.body.replaceChildren();
});

/** A page's world: her own warden, Ada, holding Storm with `points` on its
 *  line and, unless `alone`, Frost with none, and a teammate, Bo, holding
 *  Ember. */
function renderLines(points: number, alone = false) {
    const world = createGameWorld();
    const ada = world.spawn(
        HeroTrait,
        AuthorityTrait,
        PlayerNameTrait({ name: "Ada" }),
        WardenTrait,
        WardenElementsTrait({
            first: Element.Storm,
            firstLevel: points >= 10 ? 3 : points >= 4 ? 2 : 1,
            firstPoints: points,
            second: alone ? "" : Element.Frost,
            secondLevel: alone ? 0 : 1,
        }),
    );
    const bo = world.spawn(
        PlayerNameTrait({ name: "Bo" }),
        WardenTrait,
        WardenElementsTrait({ first: Element.Ember, firstLevel: 1 }),
    );
    const view = render(
        <WorldProvider world={world}>
            <ElementLines entity={ada} />
            <LineCalls />
        </WorldProvider>,
    );
    return {
        ada,
        bo,
        fill: (warden: typeof ada, points: number, level: number) =>
            act(() => {
                warden.set(WardenElementsTrait, {
                    firstPoints: points,
                    firstLevel: level,
                });
            }),
        unmount: () => {
            view.unmount();
            world.destroy();
        },
    };
}

it("draws a line for each element she holds, with its points toward the capstone", () => {
    const run = renderLines(6);

    const storm = screen.getByRole("meter", { name: "Storm line" });
    expect(storm.getAttribute("aria-valuenow")).toBe("6");
    expect(storm.getAttribute("aria-valuemax")).toBe("10");
    expect(screen.getByText("6/10")).not.toBeNull();
    //  Two lines side by side name their elements, and one alone its level.
    expect(screen.queryByText("Forked Storm")).toBeNull();
    const frost = screen.getByRole("meter", { name: "Frost line" });
    expect(frost.getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByText("0/10")).not.toBeNull();
    expect(screen.queryByRole("meter", { name: "Ember line" })).toBeNull();
    run.unmount();
});

it("names the next level and the points to it on a line alone", () => {
    const run = renderLines(6, true);

    expect(screen.getByText("Thunderhead in 4")).not.toBeNull();
    expect(screen.getByText("Forked Storm")).not.toBeNull();
    run.unmount();
});

it("calls out her second level as her line reaches it", () => {
    const run = renderLines(3);

    run.fill(run.ada, 4, 2);

    expect(
        screen.getByText("Your arcs leap further, through one more."),
    ).not.toBeNull();
    expect(screen.getByText("Storm II")).not.toBeNull();
    run.unmount();
});

it("holds the capstone's ceremony as her line fills, and takes it down after", () => {
    const run = renderLines(8);

    run.fill(run.ada, 10, 3);

    expect(screen.getByLabelText("Capstone")).not.toBeNull();
    expect(screen.getByText("Storm III, capstone")).not.toBeNull();
    expect(
        screen.getByText("While you fire, a bolt falls every 3 s."),
    ).not.toBeNull();
    act(() => vi.runAllTimers());
    expect(screen.queryByLabelText("Capstone")).toBeNull();
    run.unmount();
});

it("tells her when a teammate reaches a capstone", () => {
    const run = renderLines(0);

    run.fill(run.bo, 10, 3);

    expect(screen.getByText("Bo reached Meltdown")).not.toBeNull();
    run.unmount();
});

it("calls out nothing for the lines a warden already had as the page opens", () => {
    const run = renderLines(10);

    expect(screen.queryByLabelText("Capstone")).toBeNull();
    run.unmount();
});

it("pops the points a card adds over her line", () => {
    const run = renderLines(1, true);

    run.fill(run.ada, 3, 1);

    expect(screen.getByText("+2")).not.toBeNull();
    run.unmount();
});
