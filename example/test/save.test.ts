// @vitest-environment node
import { createWorld } from "koota";
import { afterEach, expect, it } from "vitest";
import {
    createSaveSession,
    RoundMachine,
    RoundTrait,
    spawnHero,
    type SaveSession,
} from "@spawnite/engine/core";
import { countRunsWon, readRunsWon, setRunsWon } from "../src/runs";
import { save } from "../src/save";
import { Lobby, save as lobbySave } from "../src/scenes/Lobby";

//  The example keeps where the player's hero stands, from the engine's
//  hero save, and the runs she has won, its own part.

const worlds: ReturnType<typeof createWorld>[] = [];
afterEach(() => {
    for (const world of worlds.splice(0)) world.destroy();
});

/** A world with her hero, and her save session on it. */
function openSession() {
    const world = createWorld();
    worlds.push(world);
    const hero = spawnHero(world, {
        position: { x: 0, y: 0, z: 0 },
        facing: 0,
        health: { current: 100, maximum: 100 },
    });
    const session = createSaveSession(world, {
        save,
        player: () => ({ id: "player" }),
    });
    return { world, hero, session };
}

/** The record the session holds now, as a write would read it. */
function readRecord(session: SaveSession) {
    const read = session.read();
    if (!read?.ok) throw new Error("The save did not read.");
    return read.record;
}

it("restores the runs she won onto her next hero", () => {
    const first = openSession();
    first.session.load(null);
    first.session.attachHero(first.hero);
    setRunsWon(first.hero, 3);
    const record: unknown = JSON.parse(
        JSON.stringify(readRecord(first.session)),
    );

    const next = openSession();
    expect(next.session.load(record)).toMatchObject({ ok: true });
    next.session.attachHero(next.hero);
    expect(readRunsWon(next.hero)).toBe(3);
    expect(readRecord(next.session)).toEqual(record);
});

it("refuses a save whose run count is no whole number from 0", () => {
    const { session } = openSession();
    expect(
        session.load({ game: { version: 1, state: { runsWon: -1 } } }),
    ).toMatchObject({ ok: false, key: "game" });
});

it("counts a won round once for each hero", () => {
    const { world, hero } = openSession();
    const round = world.spawn(RoundTrait);
    countRunsWon(world);
    expect(readRunsWon(hero)).toBe(0);

    RoundMachine.send(round, "WIN");
    countRunsWon(world);
    countRunsWon(world);
    expect(readRunsWon(hero)).toBe(1);
});

it("stops counting at the largest whole number a save holds, so a read stays one its schema takes", () => {
    const { world, hero } = openSession();
    setRunsWon(hero, Number.MAX_SAFE_INTEGER);
    RoundMachine.send(world.spawn(RoundTrait), "WIN");
    countRunsWon(world);
    expect(readRunsWon(hero)).toBe(Number.MAX_SAFE_INTEGER);
});

it("keeps her hero's save and her runs, and exports it from the scene its room mounts", () => {
    expect(save.include).toEqual(["hero"]);
    expect(lobbySave).toBe(save);
    expect(typeof Lobby).toBe("function");
});
