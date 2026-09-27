import { act, cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { loadRapier } from "@spawnite/engine";
import App from "../src/app/app";
//  Loaded once here, as the file is collected, so the lazy import a case
//  makes finds it rather than transforming its graph inside the case.
import "../src/app/devtools";

//  jsdom has no WebGL: the canvas is a div that renders its children, as
//  the engine's own sample test mounts them, and the engine leaves out the
//  views that draw the world, turned off below: see
//  https://create.spawnite.com/engine/testing/devtools/#a-whole-game-in-jsdom
vi.mock("@react-three/fiber", () => {
    //  What a selector reads. The devtools overlay has the loop time its
    //  frames, which wraps the renderer's render and brackets it with
    //  fiber's global effects; the camera reads its canvas in the page, and
    //  no pointer events on it. A pause sets the frameloop.
    const three = {
        get: () => ({
            frameloop: "always",
            setFrameloop: () => undefined,
            invalidate: () => undefined,
            gl: {
                render: () => undefined,
                getContext: () => ({ getExtension: () => null }),
            },
        }),
        gl: { domElement: document.createElement("canvas") },
        events: { connected: undefined },
    };
    return {
        Canvas: ({ children, ...props }: PropsWithChildren) => (
            <div data-testid="canvas" {...props}>
                {children}
            </div>
        ),
        useFrame: () => undefined,
        extend: () => undefined,
        useThree: (select: (state: typeof three) => unknown) => select(three),
        addEffect: () => () => undefined,
        addAfterEffect: () => () => undefined,
    };
});

vi.mock("@react-three/drei", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@react-three/drei")>()),
    CameraControls: () => null,
}));

//  The loop suspends until the physics wasm is loaded; loaded first, the
//  render inside act settles in one pass.
beforeAll(loadRapier);
beforeEach(() => vi.stubEnv("GAME_ENGINE_VIEWS", "off"));

it("opens the lobby with the Play button, an empty wallet and no dialog", async () => {
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
});

afterEach(() => {
    //  Unmounted before the views come back on: the setup's cleanup runs
    //  after this, and a render in between would mount them in jsdom.
    cleanup();
    vi.unstubAllEnvs();
    window.history.replaceState(null, "", "/");
});

//  The gate is a module constant, read when the app module loads: each case
//  imports the app afresh under a query naming its URL, a module of its own
//  that reads its own URL and its own DEV, over the engine the file already
//  loaded. A case that timed out renders nothing once the next has begun.
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

it("shows the game alone outside development", async ({ signal }) => {
    await mountProductionAppAt("/", signal);

    await screen.findByRole("button", { name: "Play" });
    //  Absence over the same wait the positive case gets, so a chunk that
    //  lands after the render is caught.
    await expect(
        screen.findByRole("button", { name: /Edit/ }),
    ).rejects.toThrow();
});

it("shows the devtools outside development when the URL carries ?debug", async ({
    signal,
}) => {
    await mountProductionAppAt("/?debug", signal);

    await screen.findByRole("button", { name: "Play" });
    expect(
        await screen.findByRole("button", { name: /Edit/ }),
    ).toBeInTheDocument();
});
