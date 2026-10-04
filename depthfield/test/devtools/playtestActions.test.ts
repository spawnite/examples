import { Vector3 } from "three";
import { expect } from "vitest";
import { InvulnerableTrait, placePlayer } from "@spawnite/engine/core";
import { listPlaytestActions } from "../../src/devtools/playtestActions";
import { useChoice } from "../../src/store/choice";
import { fieldScene } from "../../src/store/flow";
import { ClassId, LookId, WeaponId } from "../../src/rules/data";
import { readRun } from "../../src/rules/field";
import { startRun, type RunStart } from "../../src/rules/run";
import { StageId } from "../../src/rules/stages";
import { EnemyTrait, RunTrait } from "../../src/rules/traits";
import { plugins } from "../../src/game";
import { it, type CreateGame } from "@spawnite/engine/testing";

//  The Playtest panel's steps, as `spawnite play action` runs them by name,
//  on a headless world: the field before its run starts, or with no run,
//  the lobby's.

const testerStart: RunStart = {
    nickname: "Tester",
    look: LookId.Grove,
    starter: WeaponId.Pulse,
    classId: ClassId.Soldier,
    stage: StageId.Grid,
    zapUnlocked: false,
};

async function openField(createGame: CreateGame, { field = true } = {}) {
    const game = await createGame({
        scene: (world) => void (field && world.spawn(RunTrait)),
        plugins,
        seed: 1,
    });
    const hero = placePlayer(game, new Vector3(0, 0, 0));
    //  The scenes the steps went to.
    const scenesGone: string[] = [];
    const actions = listPlaytestActions(game.world, {
        go: (name) => void scenesGone.push(name),
    });
    const runAction = (name: string) => {
        const action = actions.find((each) => each.name === name);
        if (!action) throw new Error(`No action ${name}`);
        return action.run();
    };
    return { game, hero, runAction, scenesGone };
}

it("plays from the lobby on its picks, and refuses a quick start on the field", async ({
    createGame,
}) => {
    const kept = useChoice.getState();
    const lobby = await openField(createGame, { field: false });

    await lobby.runAction("Quick start");
    const { pending } = useChoice.getState();
    useChoice.setState(kept, true);

    expect(lobby.scenesGone).toEqual([fieldScene]);
    expect(pending).toMatchObject({ nickname: "Tester" });
    const field = await openField(createGame);
    await expect(async () => field.runAction("Quick start")).rejects.toThrow(
        "Quick start runs in the lobby: the run is title.",
    );
});

it("turns damage off and back on, and says which", async ({ createGame }) => {
    const { hero, runAction } = await openField(createGame);

    const off = await runAction("No damage");
    const on = hero.has(InvulnerableTrait);
    const back = await runAction("No damage");

    expect([off, on, back, hero.has(InvulnerableTrait)]).toEqual([
        "No damage on.",
        true,
        "No damage off.",
        false,
    ]);
});

it("spawns a small wave only while the run plays", async ({ createGame }) => {
    const { game, runAction } = await openField(createGame);

    await expect(async () => runAction("Spawn a small wave")).rejects.toThrow(
        "Spawn a small wave runs while the run plays: the run is title.",
    );
    startRun(game.world, testerStart);
    const said = await runAction("Spawn a small wave");

    expect(game.world.query(EnemyTrait).length).toBe(8);
    expect(said).toBe("Spawned 8 enemies.");
});

it("stops and restarts the spawning, and says which", async ({
    createGame,
}) => {
    const { game, runAction } = await openField(createGame);

    const stopped = await runAction("Enemy spawning");
    const spawning = readRun(game.world).spawning;

    expect([stopped, spawning]).toEqual(["Enemy spawning off.", false]);
});

it("queues the Prismatic card once, and refuses it while it waits", async ({
    createGame,
}) => {
    const { game, runAction } = await openField(createGame);

    await runAction("Next level: Prismatic");

    expect(readRun(game.world).forcePrismatic).toBe(true);
    await expect(async () =>
        runAction("Next level: Prismatic"),
    ).rejects.toThrow("Next level: Prismatic is queued already");
});
