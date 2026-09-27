// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../../src/app/AppErrorBoundary";

afterEach(() => {
    vi.unstubAllEnvs();
});

it("renders its children when they do not throw", () => {
    const { unmount } = render(
        <AppErrorBoundary>
            <h1>mmorpg</h1>
        </AppErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "mmorpg" })).toBeVisible();
    expect(
        screen.queryByRole("button", { name: "Reload" }),
    ).not.toBeInTheDocument();
    unmount();
});

//  The game's chunk loads lazily, outside Game's own boundary: a deploy that
//  removed the chunk an open tab asks for is the case this is for.
it("offers a reload when the game's chunk fails to load", async () => {
    vi.stubEnv("DEV", false);
    const MissingChunk = lazy(() =>
        Promise.reject(
            new Error("Failed to fetch dynamically imported module"),
        ),
    );

    const { unmount } = render(
        <AppErrorBoundary>
            <Suspense fallback={null}>
                <MissingChunk />
            </Suspense>
        </AppErrorBoundary>,
        { onCaughtError: vi.fn() },
    );

    expect(
        await screen.findByText(
            "Something went wrong. Please reload the page.",
        ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
    unmount();
});
