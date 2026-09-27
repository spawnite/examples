import { act, fireEvent, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
    loadRapier,
    Round,
    useLevels,
    useRound,
    type LevelId,
} from "@spawnite/engine";
import { App } from "../../src/app/app";
import { RunScreen } from "../../src/components/RunScreen";
import { Track } from "../../src/levels";
import { RunEnd } from "../../src/ride/course";

//  jsdom has no WebGL: the canvas is a div that holds its children.
vi.mock("@react-three/fiber", () => ({
    Canvas: ({ children }: PropsWithChildren) => <div>{children}</div>,
    useFrame: () => undefined,
    extend: () => undefined,
    //  The loop reads the frameloop a pause draws on, as Game's test does.
    useThree: () => () => ({
        frameloop: "always",
        setFrameloop: () => undefined,
        invalidate: () => undefined,
        clock: { elapsedTime: 0 },
    }),
}));
//  Nor Web Audio: the run's sounds play nothing.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    Sound: () => null,
}));
vi.mock("../../src/app/devtools", () => ({ default: () => null }));
//  The track needs WebGL: the scene is its round and its screen.
vi.mock("../../src/scenes/Run", () => ({ Run: RoundOnly }));

//  The run's round and its screen, with buttons that end it as the course
//  does.
function RoundOnly() {
    const { start, finish, fail } = useRound();
    const { current } = useLevels();
    return (
        <>
            <Round ready />
            <p>{`on ${current}`}</p>
            <button
                type="button"
                onClick={() => {
                    start();
                    finish();
                }}
            >
                Cross the line
            </button>
            <button
                type="button"
                onClick={() => {
                    start();
                    fail(RunEnd.Crashed);
                }}
            >
                Stall
            </button>
            <RunScreen />
        </>
    );
}

//  The loop suspends until the physics wasm is loaded; loaded first, the
//  render inside act settles in one pass.
beforeAll(loadRapier);
afterEach(() => localStorage.clear());

async function openApp() {
    await act(async () => {
        render(<App />);
    });
}

//  A save that has finished each of `ids`, as a won run leaves it.
function saveFinished(...ids: LevelId[]) {
    const levels = Object.fromEntries(
        ids.map((id) => [id, { score: 0, seconds: 1 }]),
    );
    localStorage.setItem("sled-save", JSON.stringify({ levels }));
}

it("opens on the first track not finished", async () => {
    saveFinished(Track.One, Track.Two);
    await openApp();
    expect(screen.getByText(`on ${Track.Three}`)).toBeInTheDocument();
});

it("offers the next track after a finish, and level 1 after level 4", async () => {
    await openApp();
    expect(screen.getByText(`on ${Track.One}`)).toBeInTheDocument();

    for (const next of [Track.Two, Track.Three, Track.Four, Track.One]) {
        fireEvent.click(screen.getByRole("button", { name: "Cross the line" }));
        fireEvent.click(screen.getByRole("button", { name: "Next track" }));
        expect(screen.getByText(`on ${next}`)).toBeInTheDocument();
    }
});

it("offers only another go after a crash", async () => {
    await openApp();
    fireEvent.click(screen.getByRole("button", { name: "Stall" }));

    expect(screen.getByRole("button", { name: "Play again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next track" })).toBeNull();
});
