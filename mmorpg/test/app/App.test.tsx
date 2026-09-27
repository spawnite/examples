// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { loadRapier } from "@spawnite/engine";
//  Loaded once here, as the file is collected, so the lazy import a case
//  makes finds it rather than transforming its graph inside the case.
import "../../src/app/devtools";

//  jsdom has no WebGL: the canvas is a div that renders its children, as
//  the example's app test mounts them. The meadow needs GPU detection and
//  assets, so it is left out.
vi.mock("@react-three/fiber", () => ({
    Canvas: ({ children, ...props }: PropsWithChildren) => (
        <div data-testid="canvas" {...props}>
            {children}
        </div>
    ),
    useFrame: () => undefined,
    extend: () => undefined,
    //  The devtools overlay has the loop time its frames, which wraps the
    //  renderer's render and brackets it with fiber's global effects. A
    //  pause sets the frameloop.
    useThree: () => () => ({
        frameloop: "always",
        setFrameloop: () => undefined,
        invalidate: () => undefined,
        gl: {
            render: () => undefined,
            getContext: () => ({ getExtension: () => null }),
        },
    }),
    addEffect: () => () => undefined,
    addAfterEffect: () => () => undefined,
}));
vi.mock("@react-three/drei", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@react-three/drei")>()),
    CameraControls: () => null,
}));
vi.mock("../../src/scenes/Meadow", () => ({ Meadow: () => null }));

//  The loop suspends until the physics wasm is loaded; loaded first, the
//  render inside act settles in one pass.
beforeAll(loadRapier);

afterEach(() => {
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

it("shows the game alone outside development", async ({ signal }) => {
    await mountProductionAppAt("/", signal);

    expect(screen.getByTestId("canvas")).toHaveAttribute(
        "data-game-name",
        "three-mmorpg",
    );
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

    expect(
        await screen.findByRole("button", { name: /Edit/ }),
    ).toBeInTheDocument();
});
