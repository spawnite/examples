// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { loadRapier } from "@spawnite/engine";
//  Loaded once here, as the file is collected, so the lazy import a case
//  makes finds it rather than transforming its graph inside the case.
import "../../src/app/devtools";

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);
vi.mock("@react-three/drei", async (importOriginal) =>
    (await import("@spawnite/testing/fiber")).fakeDrei(importOriginal),
);
vi.mock("../../src/scenes/Meadow", () => ({ Meadow: () => null }));

//  The loop suspends until the physics wasm is loaded; loaded first, the
//  render inside act settles in one pass.
beforeAll(loadRapier);

afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, "", "/");
});

//  The gate is a module constant that reads DEV when the app module loads:
//  each case imports the app afresh under a query naming its URL, a module
//  of its own that reads the DEV the case stubbed, over the engine the file
//  already loaded. A case that timed out renders nothing once the next has
//  begun.
async function mountProductionAppAt(search: string, signal: AbortSignal) {
    vi.stubEnv("DEV", false);
    window.history.replaceState(null, "", search);
    const specifier = `../../src/app/App.tsx?page=${encodeURIComponent(search)}`;
    //  A computed specifier carries no type: this is the app's module.
    const { App: FreshApp }: typeof import("../../src/app/App") = await import(
        /* @vite-ignore */ specifier
    );
    signal.throwIfAborted();
    await act(async () => {
        render(<FreshApp />);
    });
}

it("shows the game alone outside development, even with ?debug", async ({
    signal,
}) => {
    await mountProductionAppAt("/?debug", signal);

    expect(screen.getByTestId("canvas")).toHaveAttribute(
        "data-game-name",
        "three-mmorpg",
    );
    //  Absence over findBy's whole wait, so a chunk that lands after the
    //  render is caught.
    await expect(
        screen.findByRole("button", { name: "Spawnite" }),
    ).rejects.toThrow();
});
