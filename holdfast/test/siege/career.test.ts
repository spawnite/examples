// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import {
    fixedStepSeconds,
    seedRandom,
    takeSaveRequests,
    writeStateTags,
    type PredictedEntity,
} from "@spawnite/engine";
import {
    readLevel,
    readLevelStart,
    xpForDawn,
    xpPerKill,
    xpPerWave,
} from "../../src/siege/career";
import { LifeMachine } from "../../src/siege/life";
import { PhaseMachine, PhaseTrait } from "../../src/siege/phase";
import { save } from "../../src/save";
import { lastFallSeconds } from "../../src/siege/siege";
import { siegePlugin } from "../../src/siege/siege.plugin";
import {
    CareerTrait,
    recentRunsKept,
    SiegeStateTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    countdownSeconds,
    nightWaves,
    shelterSeconds,
} from "../../src/siege/waves";
import {
    deliverSignal,
    holdWave,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    setPhase,
    skipToBreather,
    takePlaces,
    type OpenedSiege,
} from "./room";

//  A warden's career across runs: the XP and the runs she played, which
//  the room adds to as a run ends or dawn breaks, and the level the XP
//  gives, which nothing stores.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Two wardens apart on the field, their run started. */
async function openRun() {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(game, { name: "Bo", position: onField(6) });
    takePlaces(game, ada, bo);
    return { game, ada, bo };
}

/** Every warden down at once, and the beat on the last fall run out: the
 *  end screen. */
function fallTogether(game: OpenedSiege, wardens: Entity[]) {
    for (const warden of wardens) warden.set(WardenTrait, { health: 0 });
    game.step(lastFallSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
}

/** Each warden says she is ready, and the countdown runs out. */
function goAgain(game: OpenedSiege, wardens: Entity[]) {
    for (const hero of wardens)
        deliverSignal(game.world, {
            hero,
            message: siegePlugin.messages.ready,
        });
    game.step(countdownSeconds + fixedStepSeconds * 2);
}

/** The run in wave `wave`'s fight, the waves before it held. */
function skipToFight(game: OpenedSiege, wave: number) {
    game.world
        .queryFirst(SiegeStateTrait)
        ?.set(SiegeStateTrait, { wave: wave - 1, held: wave - 1 });
    setPhase(game.world, PhaseMachine.is.breather, 1);
    game.step(1 + fixedStepSeconds * 2);
    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave,
    });
}

function readCareer(warden: Entity) {
    return warden.get(CareerTrait);
}

/** The XP dawn gives a warden who came with `fromWave` waves held. */
function readDawnShare(fromWave: number) {
    return Math.round((xpForDawn * (nightWaves - fromWave)) / nightWaves);
}

/** Her save as the room reads it off `warden`, put back on `hero`: a
 *  player who left and joins again as a new hero. */
function carrySave(game: OpenedSiege, warden: Entity, hero: Entity) {
    const player = { id: "ada" };
    const saved = save.read?.({ world: game.world, hero: warden, player });
    if (!saved) throw new Error("Holdfast's save read nothing.");
    //  As the engine hands a restore her hero, as she appears.
    save.restore?.(
        { world: game.world, hero: hero as PredictedEntity, player },
        saved,
    );
}

it("gives a level from the XP alone, each level 100 XP dearer than the last", () => {
    expect(readLevel(0)).toBe(1);
    expect(readLevel(99)).toBe(1);
    expect(readLevel(100)).toBe(2);
    expect(readLevel(299)).toBe(2);
    expect(readLevel(300)).toBe(3);
    expect(readLevel(600)).toBe(4);
    expect(readLevelStart(1)).toBe(0);
    expect(readLevelStart(4)).toBe(600);
});

it("gives every warden an empty career as the siege takes her in", async () => {
    const { ada } = await openRun();

    expect(readCareer(ada)).toMatchObject({
        xp: 0,
        runs: 0,
        dawns: 0,
        runXp: 0,
    });
});

it("adds her kills and the waves held to her career, and counts the run, as the run ends", async () => {
    const { game, ada, bo } = await openRun();
    skipToBreather(game, 3);
    ada.set(WardenTrait, { kills: 7 });
    bo.set(WardenTrait, { kills: 2 });

    fallTogether(game, [ada, bo]);

    const adaXp = 7 * xpPerKill + 3 * xpPerWave;
    expect(readCareer(ada)).toMatchObject({
        xp: adaXp,
        runs: 1,
        dawns: 0,
        runXp: adaXp,
    });
    expect(readCareer(bo)?.xp).toBe(2 * xpPerKill + 3 * xpPerWave);
});

it("counts no wave the wardens fell in", async () => {
    const { game, ada, bo } = await openRun();
    skipToFight(game, 4);

    fallTogether(game, [ada, bo]);

    expect(readCareer(ada)?.xp).toBe(3 * xpPerWave);
});

it("adds the night once as dawn breaks, and only what Endless added as the run ends", async () => {
    const { game, ada, bo } = await openRun();
    ada.set(WardenTrait, { kills: 40 });
    skipToFight(game, nightWaves);
    holdWave(game);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.dawn);

    const night = 40 * xpPerKill + nightWaves * xpPerWave + xpForDawn;
    expect(readCareer(ada)).toMatchObject({
        xp: night,
        runs: 1,
        dawns: 1,
        runXp: night,
    });

    goAgain(game, [ada, bo]);
    skipToFight(game, nightWaves + 2);
    ada.set(WardenTrait, { kills: 55 });
    fallTogether(game, [ada, bo]);

    const run = 55 * xpPerKill + (nightWaves + 1) * xpPerWave + xpForDawn;
    expect(readCareer(ada)).toMatchObject({
        xp: run,
        runs: 1,
        dawns: 1,
        runXp: run,
    });
});

it("adds each run to the last, from nothing at each start", async () => {
    const { game, ada, bo } = await openRun();
    skipToBreather(game, 2);
    fallTogether(game, [ada, bo]);

    goAgain(game, [ada, bo]);
    expect(readCareer(ada)?.runXp).toBe(0);
    skipToBreather(game, 5);
    fallTogether(game, [ada, bo]);

    expect(readCareer(ada)).toMatchObject({
        xp: 7 * xpPerWave,
        runs: 2,
        runXp: 5 * xpPerWave,
    });
});

it("gives a warden who joined a run going only the waves held after she came", async () => {
    const { game, ada, bo } = await openRun();
    skipToBreather(game, 4);
    const cy = joinWarden(game, { name: "Cy", position: onField(0, 4) });
    //  Her shelter runs out, so she may fall with the rest.
    game.step(shelterSeconds + 1);

    skipToBreather(game, 6);
    fallTogether(game, [ada, bo, cy]);

    expect(readCareer(cy)).toMatchObject({
        xp: 2 * xpPerWave,
        runs: 1,
        runXp: 2 * xpPerWave,
    });
    expect(readCareer(ada)?.xp).toBe(6 * xpPerWave);
});

it("counts the wave just held, not yet the next, for a warden who joins as the next opens", async () => {
    const { game, ada, bo } = await openRun();
    skipToBreather(game, 4);
    //  The breather ran out: the next wave opens on the step she joins.
    const siege = game.world.queryFirst(PhaseTrait);
    siege?.set(PhaseTrait, { state: { fight: "opening" }, waited: 0 });
    if (siege) writeStateTags(siege, PhaseTrait);
    const cy = joinWarden(game, { name: "Cy", position: onField(0, 4) });
    game.step(shelterSeconds + 1);

    skipToBreather(game, 6);
    fallTogether(game, [ada, bo, cy]);

    expect(readCareer(cy)?.xp).toBe(2 * xpPerWave);
});

it("asks the room to store each warden's save as her run is added, each on her own", async () => {
    const { game, ada, bo } = await openRun();
    //  The first take marks the world as one a room takes requests from.
    takeSaveRequests(game.world);
    skipToBreather(game, 2);

    fallTogether(game, [ada, bo]);

    const asked = takeSaveRequests(game.world);
    expect(asked).toHaveLength(2);
    expect(asked.map((heroes) => heroes.length)).toEqual([1, 1]);
    expect(asked.flat()).toEqual(expect.arrayContaining([ada, bo]));
});

it("gives a warden who joins during a wave nothing for it, and no share of dawn", async () => {
    const { game, ada } = await openRun();
    skipToFight(game, nightWaves);
    const cy = joinWarden(game, { name: "Cy", position: onField(0, 4) });

    holdWave(game);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.dawn);
    expect(readCareer(cy)).toMatchObject({ xp: 0, runs: 0, dawns: 0 });
    expect(readCareer(ada)).toMatchObject({ runs: 1, dawns: 1 });
});

it("pays a latecomer dawn's share of the night by the waves she held", async () => {
    const { game } = await openRun();
    skipToBreather(game, 9);
    const cy = joinWarden(game, { name: "Cy", position: onField(0, 4) });
    game.step(shelterSeconds + 1);

    skipToFight(game, nightWaves);
    holdWave(game);

    expect(readDawnShare(9)).toBe(40);
    expect(readCareer(cy)).toMatchObject({
        xp: (nightWaves - 9) * xpPerWave + readDawnShare(9),
        runs: 1,
        dawns: 1,
    });
});

it("counts no run in which she held no wave, and keeps its kills", async () => {
    const { game, ada, bo } = await openRun();
    skipToFight(game, 1);
    ada.set(WardenTrait, { kills: 3 });

    fallTogether(game, [ada, bo]);

    expect(readCareer(ada)).toMatchObject({ xp: 3 * xpPerKill, runs: 0 });
});

it("counts a run once for a player who left after dawn and joined it again", async () => {
    const { game, ada, bo } = await openRun();
    skipToFight(game, nightWaves);
    holdWave(game);
    const night = nightWaves * xpPerWave + xpForDawn;
    expect(readCareer(ada)).toMatchObject({ xp: night, runs: 1, dawns: 1 });

    //  Her hold ran out: the room took her hero, and she joins again with
    //  the save it stored.
    const back = joinWarden(game, { name: "Ada", position: onField(-6) });
    carrySave(game, ada, back);
    ada.destroy();
    game.step(1 / 60);
    goAgain(game, [back, bo]);
    //  Her shelter runs out, so she may fall with the rest.
    game.step(shelterSeconds + 1);
    skipToFight(game, nightWaves + 2);
    fallTogether(game, [back, bo]);

    expect(readCareer(back)).toMatchObject({
        xp: night + xpPerWave,
        runs: 1,
        dawns: 1,
        runXp: xpPerWave,
    });
});

it("counts a run once for a player who played a run in another room before she came back", async () => {
    const { game, ada, bo } = await openRun();
    skipToFight(game, nightWaves);
    holdWave(game);

    //  Her hold ran out at dawn, and she plays a run in another room,
    //  which draws its own seed as a room does.
    const other = await openSiege();
    seedRandom(other.world, 7);
    try {
        const away = joinWarden(other, { name: "Ada", position: onField(-6) });
        const cy = joinWarden(other, { name: "Cy", position: onField(6) });
        carrySave(other, ada, away);
        takePlaces(other, away, cy);
        skipToBreather(other, 2);
        fallTogether(other, [away, cy]);
        expect(readCareer(away)).toMatchObject({ runs: 2 });

        //  She comes back to the first room, whose run went on.
        const back = joinWarden(game, { name: "Ada", position: onField(-6) });
        carrySave(game, away, back);
        ada.destroy();
        game.step(1 / 60);
        goAgain(game, [back, bo]);
        game.step(shelterSeconds + 1);
        skipToFight(game, nightWaves + 2);
        fallTogether(game, [back, bo]);

        expect(readCareer(back)).toMatchObject({ runs: 2, dawns: 1 });
    } finally {
        await other.close();
    }
});

it("remembers only the last runs counted, the newest last, so her save stays one the schema takes", async () => {
    const { game, ada, bo } = await openRun();
    const older = Array.from({ length: recentRunsKept }, (_, run) => run);
    ada.set(CareerTrait, { recentRuns: older });
    skipToBreather(game, 1);

    fallTogether(game, [ada, bo]);

    const { nightSeed } = readSiege(game.world);
    expect(readCareer(ada)?.recentRuns).toEqual([...older.slice(1), nightSeed]);
});

it("counts every wave held before a fall that comes as a wave opens", async () => {
    const { game, ada, bo } = await openRun();
    skipToBreather(game, 4);
    const siege = game.world.queryFirst(PhaseTrait);
    siege?.set(PhaseTrait, { state: { fight: "opening" }, waited: 0 });
    if (siege) writeStateTags(siege, PhaseTrait);
    for (const warden of [ada, bo]) {
        warden.set(WardenTrait, { health: 0 });
        LifeMachine.send(warden, "DOWN");
    }

    game.step(lastFallSeconds + 0.1);

    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.over,
        wave: 4,
    });
    expect(readCareer(ada)?.xp).toBe(4 * xpPerWave);
});
