import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { Game, loadRapier, Scene } from "@spawnite/engine";
import { resetPersistedStores, resetPageSave } from "@spawnite/engine/testing";
import { LookId, WeaponId } from "../../src/rules/data";
import { StageId } from "../../src/rules/stages";
import { useChoice } from "../../src/store/choice";
import {
    bankKills,
    finishRun,
    isPrismaticUnlocked,
    isStageUnlocked,
    isZapUnlocked,
    readProgress,
    resetUnlocks,
    unlockStage,
} from "../../src/store/progress";

//  The career, the board and the lobby's picks live in the player's save,
//  under the persisted store "progress", whose schema decides what loads.

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);

beforeAll(loadRapier);
afterEach(async () => {
    vi.restoreAllMocks();
    cleanup();
    await resetPageSave();
    resetPersistedStores();
    localStorage.clear();
});

//  The record the dev page keeps in the browser, under the Game's name.
const recordKey = "depthfield-record";

const row = {
    nickname: "Nova",
    className: "Soldier",
    level: 4,
    seconds: 61,
    damage: 900,
    kills: 40,
    won: false,
    stage: StageId.Grid,
};

function Field() {
    return <p>On the field</p>;
}

function renderGame() {
    return render(
        <Game name="depthfield" start="field">
            <Scene name="field" component={Field} />
        </Game>,
    );
}

async function closeGame({ unmount }: ReturnType<typeof renderGame>) {
    act(() => unmount());
    await resetPageSave();
}

function readRecord() {
    return JSON.parse(localStorage.getItem(recordKey) ?? "null") as {
        stores?: Record<string, { version: number; state: unknown }>;
    } | null;
}

it("restores the career, the board and the picks a save wrote, after a reload", async () => {
    const first = renderGame();
    act(() => {
        bankKills(120);
        finishRun(row);
        finishRun({ ...row, damage: 300 });
        useChoice.setState({
            nickname: "Nova",
            look: LookId.Tide,
            starter: WeaponId.Laser,
        });
    });
    const played = readProgress();
    await closeGame(first);
    const written = readRecord();
    expect(written?.stores?.progress).toEqual({ version: 1, state: played });

    resetPersistedStores();
    //  As a fresh page opens: the lobby knows no picks until the save loads.
    useChoice.setState({ nickname: "", look: null, starter: null });
    const second = renderGame();
    expect(readProgress()).toEqual(played);
    expect(isPrismaticUnlocked()).toBe(true);
    expect(isZapUnlocked()).toBe(true);
    expect(useChoice.getState()).toMatchObject({
        nickname: "Nova",
        look: LookId.Tide,
        starter: WeaponId.Laser,
    });
    await closeGame(second);
    expect(readRecord()).toEqual(written);
});

it("refuses a save whose progress its schema refuses, and writes nothing over it", async () => {
    const stored = JSON.stringify({
        stores: {
            progress: {
                version: 1,
                state: { careerKills: -4, runsFinished: 0, board: [] },
            },
        },
    });
    localStorage.setItem(recordKey, stored);
    //  The failure screen logs what refused the save.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const game = renderGame();
    expect(
        await screen.findByText("We couldn't load your progress"),
    ).toBeInTheDocument();
    expect(screen.queryByText("On the field")).toBeNull();
    expect(readProgress().careerKills).toBe(0);
    await closeGame(game);
    expect(localStorage.getItem(recordKey)).toBe(stored);
});

it("starts a new player from nothing", () => {
    renderGame();
    expect(readProgress()).toEqual({
        careerKills: 0,
        runsFinished: 0,
        board: [],
        unlockedStages: [],
    });
});

it("loads a save written before the stages, each new field at its default", async () => {
    //  A board row as the save wrote it before the stages.
    const oldRow = { ...row, stage: undefined };
    localStorage.setItem(
        recordKey,
        JSON.stringify({
            stores: {
                progress: {
                    version: 1,
                    state: {
                        careerKills: 12,
                        runsFinished: 1,
                        board: [oldRow],
                        picks: {
                            nickname: "Nova",
                            look: LookId.Tide,
                            starter: WeaponId.Laser,
                        },
                    },
                },
            },
        }),
    );
    renderGame();
    expect(await screen.findByText("On the field")).toBeInTheDocument();
    expect(readProgress()).toEqual({
        careerKills: 12,
        runsFinished: 1,
        board: [row],
        unlockedStages: [],
        picks: {
            nickname: "Nova",
            look: LookId.Tide,
            starter: WeaponId.Laser,
            stage: StageId.Grid,
        },
    });
    expect(useChoice.getState().stage).toBe(StageId.Grid);
});

it("opens the Neon Grid to everyone, and each later stage once it is earned", () => {
    renderGame();
    expect(isStageUnlocked(StageId.Grid)).toBe(true);
    expect(isStageUnlocked(StageId.Foundry)).toBe(false);
    act(() => {
        expect(unlockStage(StageId.Foundry)).toBe(true);
        expect(unlockStage(StageId.Foundry)).toBe(false);
    });
    expect(isStageUnlocked(StageId.Foundry)).toBe(true);
    expect(isStageUnlocked(StageId.Vault)).toBe(false);
    act(() => resetUnlocks());
    expect(isStageUnlocked(StageId.Foundry)).toBe(false);
});

it("ranks a won run that lasted longer above a shorter one, and a run kept going replaces its own row", () => {
    renderGame();
    const won = { ...row, won: true, seconds: 190, damage: 9000 };
    const other = { ...won, nickname: "Echo" };
    act(() => {
        finishRun(row);
        finishRun(won);
        finishRun(other);
    });
    const kept = readProgress().board.find(
        (each) => each.nickname === "Nova" && each.won,
    );
    const endless = { ...won, seconds: 420, damage: 5000 };
    act(() => void finishRun(endless, kept));
    expect(readProgress().board).toEqual([endless, other, row]);
    expect(readProgress().runsFinished).toBe(3);
});
