import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    type RenderResult,
} from "@testing-library/react";
import { useWorld } from "koota/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
    loadRapier,
    Round,
    useLevels,
    useRound,
    AuthorityTrait,
    RunContext,
    WalletTrait,
    type LevelId,
} from "@spawnite/engine";
import { resetPersistedStores, resetPageSave } from "@spawnite/engine/testing";
import { App } from "../../src/app/app";
import { RunScreen } from "../../src/components/RunScreen";
import { Track } from "../../src/levels";

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);
//  Nor Web Audio: the run's sounds play nothing.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    Sound: () => null,
}));
vi.mock("../../src/app/devtools", () => ({ default: () => null }));
//  The track needs WebGL: the scene is its round and its screen.
vi.mock("../../src/scenes/Run", () => ({ Run: RoundOnly }));
//  So do the lobby's models: the lobby is its controls.
vi.mock("../../src/lobby/Stage", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    Stage: () => null,
}));

//  The run's round and its screen, with buttons that end it as the course
//  does.
function RoundOnly() {
    const world = useWorld();
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
                    fail("crashed");
                }}
            >
                Stall
            </button>
            <button
                type="button"
                onClick={() => {
                    //  The rider's wallet, as the course pays it.
                    world.spawn(
                        WalletTrait({ coins: 5 }),
                        AuthorityTrait({ context: RunContext.Client }),
                    );
                    start();
                    fail("crashed");
                }}
            >
                Stall with five coins
            </button>
            <RunScreen />
        </>
    );
}

//  The loop suspends until the physics wasm is loaded; loaded first, the
//  render inside act settles in one pass.
beforeAll(loadRapier);
afterEach(async () => {
    //  Unmounted first: the Game writes its save as it unmounts.
    cleanup();
    await resetPageSave();
    resetPersistedStores();
    localStorage.clear();
});

/** Unmounts the app and waits for the save it writes as it goes. */
async function closeApp({ unmount }: RenderResult) {
    await act(async () => unmount());
    await resetPageSave();
}

async function openApp() {
    let rendered: RenderResult | undefined;
    await act(async () => {
        rendered = render(<App />);
    });
    return rendered!;
}

/** Presses the lobby's play button, which plays the selected track. */
function playFromLobby() {
    fireEvent.click(screen.getByRole("button", { name: /^Play track/ }));
}

//  The bank's total on the round screen.
function banked() {
    return screen.getByRole("status", { name: "Coins banked" });
}

//  The record the dev page keeps in the browser, under the Game's name.
const recordKey = "sled-record";

function readRecord() {
    return JSON.parse(localStorage.getItem(recordKey) ?? "null") as Record<
        string,
        unknown
    > | null;
}

//  A save that has finished each of `ids`, as a won run leaves it.
function saveFinished(...ids: LevelId[]) {
    const finished = Object.fromEntries(
        ids.map((id) => [id, { score: 0, seconds: 1 }]),
    );
    localStorage.setItem(
        recordKey,
        JSON.stringify({
            engine: { levels: { version: 1, state: { finished } } },
        }),
    );
}

it("opens on the lobby, the first track not finished selected, and plays it", async () => {
    saveFinished(Track.One, Track.Two);
    await openApp();
    playFromLobby();
    expect(screen.getByText(`on ${Track.Three}`)).toBeInTheDocument();
});

it("goes back to the lobby from the round screen's home button, the track last played selected", async () => {
    await openApp();
    playFromLobby();
    fireEvent.click(screen.getByRole("button", { name: "Cross the line" }));
    fireEvent.click(screen.getByRole("button", { name: "Lobby" }));

    expect(screen.queryByText(`on ${Track.One}`)).toBeNull();
    expect(
        screen.getByRole("button", { name: "Play track 1" }),
    ).toBeInTheDocument();
});

it("offers the next track after a finish, and level 1 after the last", async () => {
    await openApp();
    playFromLobby();
    expect(screen.getByText(`on ${Track.One}`)).toBeInTheDocument();

    for (const next of [...Object.values(Track).slice(1), Track.One]) {
        fireEvent.click(screen.getByRole("button", { name: "Cross the line" }));
        fireEvent.click(screen.getByRole("button", { name: "Next track" }));
        expect(screen.getByText(`on ${next}`)).toBeInTheDocument();
    }
});

it("offers only another go after a crash", async () => {
    await openApp();
    playFromLobby();
    fireEvent.click(screen.getByRole("button", { name: "Stall" }));

    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next track" })).toBeNull();
});

it("banks a run's coins in the player's save, and the next run counts on from them", async () => {
    const app = await openApp();
    playFromLobby();
    fireEvent.click(
        screen.getByRole("button", { name: "Stall with five coins" }),
    );
    expect(banked()).toHaveTextContent(/^5$/);

    await closeApp(app);
    expect(readRecord()).toMatchObject({
        game: { version: 2, state: { coins: 5 } },
    });
});

it("keeps a finished track in the player's save", async () => {
    const app = await openApp();
    playFromLobby();
    fireEvent.click(screen.getByRole("button", { name: "Cross the line" }));

    await closeApp(app);
    expect(readRecord()).toMatchObject({
        engine: {
            levels: {
                version: 1,
                state: { finished: { [Track.One]: { score: 0 } } },
            },
        },
    });
});

it("restores what a save wrote after a reload: the banked coins and the finished tracks", async () => {
    const first = await openApp();
    playFromLobby();
    fireEvent.click(screen.getByRole("button", { name: "Cross the line" }));
    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    fireEvent.click(
        screen.getByRole("button", { name: "Stall with five coins" }),
    );
    await closeApp(first);
    const written = readRecord();

    const second = await openApp();
    playFromLobby();
    expect(screen.getByText(`on ${Track.Two}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stall" }));
    expect(banked()).toHaveTextContent(/^5$/);
    await closeApp(second);
    expect(readRecord()).toEqual(written);
});
