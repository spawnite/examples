import { render } from "@testing-library/react";
import { Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    DamageNumbers,
    mostBurns,
    showDamage,
} from "../../src/views/DamageNumbers";

//  The engine's floating text draws the numbers; here its writer is a spy,
//  so what each hit asks it to show reads as a call.
const show = vi.hoisted(() => vi.fn());
vi.mock("@spawnite/engine", async (importOriginal) => {
    const writer = { show };
    return {
        ...(await importOriginal<typeof import("@spawnite/engine")>()),
        FloatingText: () => null,
        useFloatingText: () => writer,
    };
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    //  Every burn's number floats away, so the next test starts with none.
    vi.runAllTimers();
    vi.useRealTimers();
    show.mockReset();
});

/** The classes each shown number carries, by its text. */
function readShownClasses() {
    return new Map(
        show.mock.calls.map(([{ text, className }]) => [text, className]),
    );
}

//  A hit's number floats up off the monster; a weak spot's is its own:
//  gold, larger and slammed in, so it reads apart from a body hit's in a
//  crowd of numbers.

it("draws a weak spot's number gold and slammed in, apart from a body hit's", () => {
    const page = render(<DamageNumbers />);
    showDamage({ position: new Vector3(), amount: 10 });
    showDamage({ position: new Vector3(), amount: 20, critical: true });

    const shown = readShownClasses();
    expect(shown.get("10")).not.toContain("animate-crit-pop");
    expect(shown.get("20")).toContain("animate-crit-pop");
    expect(shown.get("20")).toContain("text-amber-300");
    page.unmount();
});

it("draws a burn's number smaller, in Ember's colour, apart from a hit's", () => {
    const page = render(<DamageNumbers />);
    showDamage({ position: new Vector3(), amount: 12 });
    showDamage({ position: new Vector3(), amount: 7, burn: true });

    const shown = readShownClasses();
    expect(shown.get("7")).toContain("text-orange-400");
    expect(shown.get("7")).toContain("text-lg");
    expect(shown.get("12")).not.toContain("text-orange-400");
    page.unmount();
});

it("keeps a burn's numbers few in the air, so a burning crowd reads", () => {
    const page = render(<DamageNumbers />);
    for (let index = 0; index < mostBurns * 3; index++)
        showDamage({ position: new Vector3(), amount: 5, burn: true });
    showDamage({ position: new Vector3(), amount: 20 });

    const texts = show.mock.calls.map(([{ text }]) => text);
    expect(texts.filter((text) => text === "5")).toHaveLength(mostBurns);
    expect(texts.filter((text) => text === "20")).toHaveLength(1);

    //  Once they have floated away, a burn's number shows again.
    vi.advanceTimersByTime(1000);
    showDamage({ position: new Vector3(), amount: 5, burn: true });
    expect(show).toHaveBeenCalledTimes(mostBurns + 2);
    page.unmount();
});
