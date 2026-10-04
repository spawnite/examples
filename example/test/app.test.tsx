import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { loadRapier } from "@spawnite/engine";
import App from "../src/app/app";
//  Loaded once here, as the file is collected, so the lazy import a case
//  makes finds it rather than transforming its graph inside the case.
import "../src/app/devtools";

//  jsdom has no WebGL, and the views are off below: see
//  https://wiki.spawnite.com/engine/testing/devtools/#a-whole-game-in-jsdom
vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);

vi.mock("@react-three/drei", async (importOriginal) =>
    (await import("@spawnite/testing/fiber")).fakeDrei(importOriginal),
);

//  The loop suspends until the physics wasm is loaded; loaded first, the
//  render inside act settles in one pass.
beforeAll(loadRapier);
beforeEach(() => vi.stubEnv("GAME_ENGINE_VIEWS", "off"));

it("opens the lobby with the Play button, an empty wallet, the devtools and no dialog", async () => {
    await act(async () => {
        render(<App />);
    });

    expect(screen.getByTestId("canvas")).toHaveAttribute(
        "data-game-name",
        "example",
    );
    await screen.findByRole("button", { name: "Play" });
    expect(screen.getByText("Coins 0")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    //  The devtools mount in development.
    expect(
        await screen.findByRole("button", { name: "Spawnite" }),
    ).toBeInTheDocument();
});

afterEach(() => {
    //  Unmounted before the views come back on: the setup's cleanup runs
    //  after this, and a render in between would mount them in jsdom.
    cleanup();
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
    const specifier = `../src/app/app.tsx?page=${encodeURIComponent(search)}`;
    //  A computed specifier carries no type: this is the app's module.
    const { default: FreshApp }: typeof import("../src/app/app") = await import(
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

    await screen.findByRole("button", { name: "Play" });
    //  Absence over findBy's whole wait, so a chunk that lands after the
    //  render is caught.
    await expect(
        screen.findByRole("button", { name: "Spawnite" }),
    ).rejects.toThrow();
});
