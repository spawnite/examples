// @vitest-environment node
import type { Entity } from "koota";
import { Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine, readPhase } from "../../src/siege/phase";
import {
    fixedStepSeconds,
    teleportActor,
    TransformTrait,
} from "@spawnite/engine";
import { Element } from "../../src/siege/elements";
import { lastFallSeconds } from "../../src/siege/siege";
import { siegePlugin } from "../../src/siege/siege.plugin";
import {
    MonsterKind,
    MonsterTrait,
    SiegeStateTrait,
    SiegeTrait,
    WardenElementsTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    breatherSeconds,
    countdownSeconds,
    firstBreatherSeconds,
    nameWave,
    nightWaves,
    readyBreatherSeconds,
    waveClearSeconds,
} from "../../src/siege/waves";
import {
    clearWave,
    deliverSignal,
    fortify,
    holdWave,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    takePlaces,
    type OpenedSiege,
    setPhase,
} from "./room";
import { ReadinessMachine } from "../../src/siege/life";

//  The night: fifteen waves from dusk, dawn as the win, Endless after it,
//  and the breathers between, which end early once every warden is ready.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Two wardens apart on the field, their run started and its first
 *  breather counting. */
async function openNight() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(6) });
    takePlaces(siege, ada, bo);
    fortify(siege, ada);
    fortify(siege, bo);
    return { game: siege, ada, bo };
}

/** Moves the run on to the breather before wave `wave`, as if the waves
 *  before it had been held. */
function skipTo(game: OpenedSiege, wave: number) {
    game.world
        .queryFirst(SiegeStateTrait)
        ?.set(SiegeStateTrait, { wave: wave - 1 });
    setPhase(game.world, PhaseMachine.is.breather, 1);
    game.step(1 + fixedStepSeconds * 2);
    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave,
    });
}

/** Each warden says she is ready, as her key does. */
function readyAll(game: OpenedSiege, wardens: Entity[]) {
    for (const hero of wardens)
        deliverSignal(game.world, {
            hero,
            message: siegePlugin.messages.ready,
        });
    game.step(fixedStepSeconds * 2);
}

it("holds fifteen waves, then dawn breaks and the run is won", async () => {
    const { game } = await openNight();
    skipTo(game, nightWaves);

    holdWave(game);

    const state = readSiege(game.world);
    expect(state.phase).toBe(PhaseMachine.is.dawn);
    expect(state.wave).toBe(nightWaves);
    expect(state.best).toBe(nightWaves);
    expect(game.world.query(MonsterTrait)).toHaveLength(0);
});

it("holds every wave from the first to the fifteenth in order, then dawn breaks", async () => {
    const { game, ada, bo } = await openNight();
    const fought: number[] = [];
    game.step(firstBreatherSeconds + fixedStepSeconds * 2);

    while (readSiege(game.world).phase === PhaseMachine.is.fight) {
        fought.push(readSiege(game.world).wave);
        holdWave(game);
        if (readSiege(game.world).phase !== PhaseMachine.is.breather) break;
        readyAll(game, [ada, bo]);
        game.step(readyBreatherSeconds + fixedStepSeconds * 2);
    }

    expect(fought).toEqual(
        Array.from({ length: nightWaves }, (_, index) => index + 1),
    );
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.dawn);
}, 20_000);

it("sends a larger colossus at the last wave, ahead of its escort", async () => {
    const { game } = await openNight();
    skipTo(game, 10);
    game.step(fixedStepSeconds * 2);
    const tenth = game.world
        .query(MonsterTrait)
        .find(
            (monster) =>
                monster.get(MonsterTrait)?.kind === MonsterKind.Colossus,
        );
    expect(tenth?.get(MonsterTrait)?.size).toBe(1);
    holdWave(game);
    skipTo(game, nightWaves);
    game.step(fixedStepSeconds * 2);

    const last = game.world
        .query(MonsterTrait)
        .find(
            (monster) =>
                monster.get(MonsterTrait)?.kind === MonsterKind.Colossus,
        );
    expect(last?.get(MonsterTrait)?.size).toBeGreaterThan(1);
    expect(readSiege(game.world).toSpawn).toBeGreaterThan(0);
});

it("waits at dawn, dealing no card, until every warden is ready", async () => {
    const { game, ada, bo } = await openNight();
    skipTo(game, nightWaves);
    holdWave(game);

    game.step(30);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.dawn);
    expect(ada.get(WardenTrait)?.offer).toEqual([]);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    game.step(countdownSeconds + 1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.dawn);
    expect(bo.has(ReadinessMachine.is.ready)).toBe(false);
});

it("goes on into Endless from dawn: a breather with cards, then wave 16, and keeps what the wardens built", async () => {
    const { game, ada, bo } = await openNight();
    ada.set(WardenTrait, { kills: 40, cards: ["heavy-rounds"] });
    //  Both elements already, so the breather deals her cards.
    for (const warden of [ada, bo])
        warden.set(WardenElementsTrait, {
            first: Element.Storm,
            firstLevel: 1,
            second: Element.Frost,
            secondLevel: 1,
        });
    skipTo(game, nightWaves);
    holdWave(game);

    readyAll(game, [ada, bo]);
    game.step(countdownSeconds + fixedStepSeconds * 2);

    const breather = readSiege(game.world);
    expect(breather.phase).toBe(PhaseMachine.is.breather);
    expect(breather.endless).toBe(true);
    expect(breather.wave).toBe(nightWaves);
    expect(ada.get(WardenTrait)?.offer).toHaveLength(3);
    expect(ada.get(WardenTrait)?.kills).toBe(40);
    expect(game.world.queryFirst(SiegeTrait)?.get(SiegeTrait)?.endless).toBe(
        true,
    );

    game.step(breatherSeconds + fixedStepSeconds * 2);
    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave: nightWaves + 1,
    });
    expect(ada.get(WardenTrait)?.cards).toHaveLength(2);
});

it("climbs past twenty in Endless with no second dawn, and ends as a run does", async () => {
    const { game, ada, bo } = await openNight();
    skipTo(game, nightWaves);
    holdWave(game);
    readyAll(game, [ada, bo]);
    game.step(countdownSeconds + fixedStepSeconds * 2);
    skipTo(game, 20);

    holdWave(game);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);

    skipTo(game, 21);
    for (const warden of [ada, bo]) warden.set(WardenTrait, { health: 0 });
    game.step(lastFallSeconds + 0.1);

    const over = readSiege(game.world);
    expect(over.phase).toBe(PhaseMachine.is.over);
    expect(over.best).toBe(21);
});

it("starts the next run at dusk, out of Endless, once the wardens go again", async () => {
    const { game, ada, bo } = await openNight();
    skipTo(game, nightWaves);
    holdWave(game);
    readyAll(game, [ada, bo]);
    game.step(countdownSeconds + fixedStepSeconds * 2);
    skipTo(game, 17);
    for (const warden of [ada, bo]) warden.set(WardenTrait, { health: 0 });
    game.step(lastFallSeconds + 0.1);

    readyAll(game, [ada, bo]);
    game.step(countdownSeconds + fixedStepSeconds * 2);

    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.breather,
        wave: 0,
        endless: false,
    });
});

//  The cards came up as the last monster fell, in a playtest of
//  2026-09-28: the held wave's call, its last death and its coins flying
//  in land first.
it("deals the cards a beat after the wave is held, and counts the breather from the deal", async () => {
    const { game, ada } = await openNight();
    skipTo(game, 1);
    clearWave(game);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
    expect(ada.get(WardenTrait)?.offer).toEqual([]);
    game.step(waveClearSeconds - 0.25);
    expect(ada.get(WardenTrait)?.offer).toEqual([]);
    expect(readSiege(game.world).secondsLeft).toBe(breatherSeconds);

    game.step(0.35);
    expect(ada.get(WardenTrait)?.offer).toHaveLength(3);
    expect(readSiege(game.world).secondsLeft).toBeGreaterThan(
        breatherSeconds - 0.25,
    );
});

it("rests up to twenty seconds between waves", async () => {
    const { game } = await openNight();
    skipTo(game, 1);
    holdWave(game);

    game.step(breatherSeconds - 1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);

    game.step(1 + fixedStepSeconds * 2);
    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave: 2,
    });
});

it("ends a breather a few seconds after every warden says she is ready", async () => {
    const { game, ada, bo } = await openNight();
    skipTo(game, 1);
    holdWave(game);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    game.step(readyBreatherSeconds + 1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
    expect(ada.has(ReadinessMachine.is.ready)).toBe(true);

    deliverSignal(game.world, {
        hero: bo,
        message: siegePlugin.messages.ready,
    });
    game.step(fixedStepSeconds * 2);
    expect(readSiege(game.world).secondsLeft).toBeLessThanOrEqual(
        readyBreatherSeconds,
    );
    game.step(readyBreatherSeconds);

    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave: 2,
    });
    for (const warden of [ada, bo])
        expect(warden.has(ReadinessMachine.is.ready)).toBe(false);
});

it("readies a warden who steps into the ring during a breather, and not one already standing in it", async () => {
    const { game, ada, bo } = await openNight();
    const inRing = new Vector3(0, 0, 2.2);
    bo.set(TransformTrait, inRing.clone());
    teleportActor(game.world, bo);
    skipTo(game, 1);
    bo.set(TransformTrait, inRing.clone());
    teleportActor(game.world, bo);
    holdWave(game);
    game.step(fixedStepSeconds * 2);
    expect(bo.has(ReadinessMachine.is.ready)).toBe(false);

    ada.set(TransformTrait, new Vector3(-2.2, 0, 0));
    teleportActor(game.world, ada);
    game.step(fixedStepSeconds * 2);

    expect(ada.has(ReadinessMachine.is.ready)).toBe(true);
});

it("lets a warden take back her ready during a breather", async () => {
    const { game, ada, bo } = await openNight();
    skipTo(game, 1);
    holdWave(game);
    readyAll(game, [ada]);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.unready,
    });
    deliverSignal(game.world, {
        hero: bo,
        message: siegePlugin.messages.ready,
    });
    game.step(readyBreatherSeconds + 1);

    expect(ada.has(ReadinessMachine.is.ready)).toBe(false);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
});

it("announces each named wave a breather ahead, and names the wave while it is fought", async () => {
    const { game } = await openNight();
    const seed = readSiege(game.world).nightSeed;
    const named = Array.from(
        { length: nightWaves },
        (_, index) => index + 1,
    ).find((wave) => nameWave(seed, wave) !== "");
    if (named === undefined) throw new Error("No named wave in the night.");
    skipTo(game, named - 1);
    holdWave(game);

    const shown = () => {
        const siege = game.world.queryFirst(SiegeTrait);
        return { ...siege?.get(SiegeTrait), phase: readPhase(siege) };
    };
    expect(shown()?.named).toBe(nameWave(seed, named));

    game.step(breatherSeconds + fixedStepSeconds * 2);
    expect(shown()).toMatchObject({
        phase: "fight",
        wave: named,
        named: nameWave(seed, named),
    });
});

it("counts the first breather down to wave 1 from dusk", async () => {
    const { game } = await openNight();

    game.step(firstBreatherSeconds + fixedStepSeconds * 2);

    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave: 1,
        endless: false,
    });
});
