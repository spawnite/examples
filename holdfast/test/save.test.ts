// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import {
    BodyTrait,
    createSaveSession,
    defaultWalkerBody,
    HealthTrait,
    PlayerNameTrait,
    spawnHero,
    WalletTrait,
    type SaveRecord,
} from "@spawnite/engine";
import { save } from "../src/save";
import { save as sceneSave } from "../src/scenes/Holdfast";
import { readLevel } from "../src/siege/career";
import { CareerTrait, recentRunsKept } from "../src/siege/traits";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./siege/room";

//  What Holdfast keeps of a player between runs: her career, read from
//  her hero as the room stores her save and put back as she joins again.

//  Holdfast declares its own state, so both are there.
const { read: readSave, schema } = save;
if (!readSave || !schema) throw new Error("Holdfast's save has no read.");

const opened: OpenedSiege[] = [];

afterEach(async () => {
    for (const game of opened.splice(0)) await game.close();
});

async function open() {
    const game = await openSiege();
    opened.push(game);
    return game;
}

/** A hero as the room spawns one for a page that joins, before the siege's
 *  next step takes her in: when the room restores her save. */
function spawnJoining(game: OpenedSiege, name: string) {
    const hero: Entity = spawnHero(game.world, {
        position: onField(),
        facing: 0,
        health: HealthTrait.schema,
    });
    hero.add(
        BodyTrait(defaultWalkerBody),
        WalletTrait,
        PlayerNameTrait({ name }),
    );
    return hero;
}

/** Her save as the room stores it, from the declaration the scene file
 *  exports: the record read off her hero, through JSON. */
function storeSave(game: OpenedSiege, hero: Entity): unknown {
    const session = createSaveSession(game.world, {
        save: sceneSave,
        player: () => ({ id: "ada" }),
    });
    session.load(null);
    session.attachHero(hero);
    const read = session.read();
    if (!read?.ok) throw new Error(JSON.stringify(read));
    return JSON.parse(JSON.stringify(read.record)) as SaveRecord;
}

it("gives back the same career once written, reloaded and restored as she joins again", async () => {
    const first = await open();
    const ada = joinWarden(first, { name: "Ada", position: onField() });
    ada.set(CareerTrait, {
        xp: 345,
        runs: 3,
        dawns: 1,
        recentRuns: [77],
        runXp: 40,
    });
    const stored = storeSave(first, ada);

    const second = await open();
    const back = spawnJoining(second, "Ada");
    const session = createSaveSession(second.world, {
        save: sceneSave,
        player: () => ({ id: "ada" }),
    });
    expect(session.load(stored).ok).toBe(true);
    session.attachHero(back);
    //  The siege takes her in after the room restored her.
    second.step(1 / 60);

    expect(back.get(CareerTrait)).toMatchObject({
        xp: 345,
        runs: 3,
        dawns: 1,
        recentRuns: [77],
    });
    expect(readLevel(back.get(CareerTrait)?.xp ?? 0)).toBe(
        readLevel(ada.get(CareerTrait)?.xp ?? 0),
    );
});

it("keeps the XP, the runs, the nights won and the last runs counted, and neither the level nor the last run's XP", async () => {
    const game = await open();
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    ada.set(CareerTrait, {
        xp: 120,
        runs: 1,
        dawns: 0,
        recentRuns: [77],
        runXp: 120,
    });

    expect(storeSave(game, ada)).toMatchObject({
        game: {
            version: 1,
            state: { xp: 120, runs: 1, dawns: 0, recentRuns: [77] },
        },
    });
    expect(
        readSave({ world: game.world, hero: ada, player: { id: "ada" } }),
    ).toEqual({ xp: 120, runs: 1, dawns: 0, recentRuns: [77] });
});

it("has a schema that takes everything its read returns, so no read is skipped", async () => {
    const game = await open();
    //  Before the siege took her in, with no career yet.
    const joining = spawnJoining(game, "Bo");
    const fresh = joinWarden(game, { name: "Ada", position: onField(-4) });
    const veteran = joinWarden(game, { name: "Cy", position: onField(4) });
    veteran.set(CareerTrait, {
        xp: Number.MAX_SAFE_INTEGER,
        runs: 100_000,
        dawns: 100_000,
        recentRuns: Array.from({ length: recentRunsKept }, () => 2 ** 31),
        runXp: 0,
    });

    for (const hero of [joining, fresh, veteran]) {
        const read = readSave({
            world: game.world,
            hero,
            player: { id: "ada" },
        });
        expect(schema.safeParse(read).success).toBe(true);
        expect(() => storeSave(game, hero)).not.toThrow();
    }
});
