import { act, cleanup, render, screen } from "@testing-library/react";
import { createWorld } from "koota";
import { useWorld } from "koota/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { Game, loadRapier, Scene, useScenes } from "@spawnite/engine";
import { resetPageSave, resetPersistedStores } from "@spawnite/engine/testing";
import { LookId, WeaponId } from "../../src/rules/data";
import { StageId } from "../../src/rules/stages";
import { RunPhase, RunTrait } from "../../src/rules/traits";
import { useChoice } from "../../src/store/choice";
import {
    endRun,
    fieldScene,
    keepGoing,
    leaveRun,
    lobbyScene,
    playFromLobby,
    restartRun,
} from "../../src/store/flow";
import { readProgress } from "../../src/store/progress";

//  The page's way between its scenes: Play leaves the lobby's picks
//  pending and goes to the field, and leaving the run comes back to the
//  lobby with its line about the run.

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);

beforeAll(loadRapier);
afterEach(async () => {
    cleanup();
    await resetPageSave();
    resetPersistedStores();
    localStorage.clear();
});

function Lobby() {
    const scenes = useScenes();
    return (
        <button type="button" onClick={() => playFromLobby(scenes)}>
            Play
        </button>
    );
}

function Field() {
    const world = useWorld();
    const scenes = useScenes();
    const pending = useChoice((choice) => choice.pending);
    return (
        <>
            <p>{`Run on ${pending?.stage} with ${pending?.starter}`}</p>
            <button
                type="button"
                onClick={() => leaveRun(world, scenes, "Run left early.")}
            >
                Leave
            </button>
        </>
    );
}

it("plays the lobby's picks on the field, and leaving comes back to the lobby", () => {
    const kept = useChoice.getState();
    useChoice.setState({
        nickname: "",
        look: LookId.Tide,
        starter: WeaponId.Laser,
        stage: StageId.Grid,
    });
    render(
        <Game name="depthfield" start={lobbyScene}>
            <Scene name={lobbyScene} component={Lobby} />
            <Scene name={fieldScene} component={Field} />
        </Game>,
    );

    act(() => screen.getByRole("button", { name: "Play" }).click());
    const field = screen.getByText("Run on grid with laser").textContent;
    const nickname = useChoice.getState().pending?.nickname;
    act(() => screen.getByRole("button", { name: "Leave" }).click());
    const after = useChoice.getState();
    useChoice.setState(kept, true);

    expect(field).toBe("Run on grid with laser");
    expect(nickname).toBe("Runner");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(after).toMatchObject({
        pending: null,
        lastResult: "Run left early.",
    });
});

it("puts an endless run's whole length on the board when it restarts, as leaving does", () => {
    const kept = useChoice.getState();
    const world = createWorld();
    const run = world.spawn(RunTrait).get(RunTrait)!;
    Object.assign(run, {
        phase: RunPhase.Complete,
        time: 180,
        kills: 40,
        damageDealt: 1000,
    });
    endRun(world, true);
    keepGoing(world);
    Object.assign(run, { time: 600, kills: 90, damageDealt: 5000 });

    restartRun(world, { reload: vi.fn() });
    useChoice.setState(kept, true);

    expect(readProgress()).toMatchObject({
        careerKills: 90,
        board: [{ seconds: 600, kills: 90, damage: 5000, won: true }],
    });
    world.destroy();
});
