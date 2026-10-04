// @vitest-environment node
import type { Entity } from "koota";
import { Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine, readPhase } from "../../src/siege/phase";
import {
    DisconnectedTrait,
    fixedStepSeconds,
    MovementTrait,
    teleportActor,
    TransformTrait,
    WalletTrait,
} from "@spawnite/engine";
import { siegePlugin } from "../../src/siege/siege.plugin";
import { spawnMonster } from "../../src/siege/monsters";
import { lastFallSeconds } from "../../src/siege/siege";
import {
    EndCause,
    MonsterKind,
    MonsterTrait,
    SiegeStateTrait,
    SiegeTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    firstBreatherSeconds,
    countdownSeconds,
    planWave,
} from "../../src/siege/waves";
import { reviveSeconds } from "../../src/siege/downs";
import { fireMetres } from "../../src/siege/fire";
import {
    joinWarden,
    onField,
    holdWave,
    openSiege,
    readSiege,
    deliverSignal,
    takePlaces,
    type OpenedSiege,
} from "./room";
import { LifeMachine, LifeTrait, ReadinessMachine } from "../../src/siege/life";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Takes all her health, as the last blow of a fight does. */
function knockDown(warden: Entity) {
    warden.set(WardenTrait, { health: 0 });
}

/** The run as pages read it: the shown record, and the phase from the
 *  machine's tags. */
function readShown(game: OpenedSiege) {
    const siege = game.world.queryFirst(SiegeTrait);
    return { ...siege?.get(SiegeTrait), phase: readPhase(siege) };
}

/** Opens wave 1 with two wardens apart, and returns them. */
async function openFight() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(6) });
    takePlaces(siege, ada, bo);
    siege.step(firstBreatherSeconds + 0.1);
    expect(readSiege(siege.world).phase).toBe(PhaseMachine.is.fight);
    return { game: siege, ada, bo };
}

it("downs a warden at no health and keeps her in the room, unable to walk", async () => {
    const { game, ada } = await openFight();

    knockDown(ada);
    game.step(fixedStepSeconds);

    expect(ada.isAlive()).toBe(true);
    expect(ada.has(LifeMachine.is.down)).toBe(true);
    expect(ada.get(MovementTrait)?.speed).toBe(0);
});

it("sends the monsters past a downed warden to the one still standing", async () => {
    const { game, ada } = await openFight();
    knockDown(ada);
    game.step(fixedStepSeconds);
    //  Nearer her than him.
    const husk = spawnMonster(game.world, {
        kind: MonsterKind.Husk,
        position: onField(-6, 4),
        plan: planWave(1, 1),
    });

    game.step(1);

    const at = husk.get(TransformTrait);
    if (!at) throw new Error("No place.");
    expect(at.x).toBeGreaterThan(onField(-6).x + 1);
});

it("gets a downed warden up once a teammate has stood over her long enough", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    game.step(fixedStepSeconds);
    bo.set(TransformTrait, onField(-6, 1));
    teleportActor(game.world, bo);

    game.step(reviveSeconds + 0.2);

    expect(ada.has(LifeMachine.is.down)).toBe(false);
    expect(ada.get(WardenTrait)?.health).toBeGreaterThan(0);
    expect(ada.get(MovementTrait)?.speed).toBeGreaterThan(0);
});

it("gets every downed warden up when the wave is held", async () => {
    const { game, ada } = await openFight();
    knockDown(ada);
    game.step(fixedStepSeconds);

    holdWave(game);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
    expect(ada.has(LifeMachine.is.down)).toBe(false);
});

it("ends the run on the wave reached once every warden is down", async () => {
    const { game, ada, bo } = await openFight();

    knockDown(ada);
    knockDown(bo);
    game.step(lastFallSeconds + 0.1);

    const state = readSiege(game.world);
    expect(state.phase).toBe(PhaseMachine.is.over);
    expect(state.wave).toBe(1);
});

//  A warden alone knocked from 2 health to none saw the run end while she
//  stood, in the playthrough of 2026-09-28: her page never drew the fall.
it("holds a beat on the last fall, every warden down where pages draw her, before the run ends", async () => {
    const { game, ada, bo } = await openFight();

    knockDown(ada);
    knockDown(bo);
    game.step(fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
    expect(readShown(game)).toMatchObject({
        phase: "fight",
        cause: EndCause.EveryoneDown,
    });
    for (const warden of [ada, bo])
        expect(warden.has(LifeMachine.is.down)).toBe(true);

    game.step(lastFallSeconds - 0.25);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);

    game.step(0.35);
    expect(readShown(game)).toMatchObject({
        phase: "over",
        cause: EndCause.EveryoneDown,
    });
});

it("moves the run no further on during the last fall: a wave emptied then opens no breather", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    knockDown(bo);
    game.step(fixedStepSeconds * 2);

    for (const monster of game.world.query(MonsterTrait)) monster.destroy();
    game.world
        .queryFirst(SiegeStateTrait)
        ?.set(SiegeStateTrait, { toSpawn: 0 });
    game.step(fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
    expect(ada.has(LifeMachine.is.down)).toBe(true);
    game.step(lastFallSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
});

//  A teammate who drops on the last fall leaves one warden alone, whose
//  self-revive would get her up as the end screen opens.
it("gets nobody up on the last fall, whoever drops in it", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    knockDown(bo);
    game.step(fixedStepSeconds * 2);

    bo.add(DisconnectedTrait);
    ada.set(LifeTrait, { revived: 2.9 });
    game.step(1);

    expect(ada.has(LifeMachine.is.down)).toBe(true);
    expect(ada.get(LifeTrait)?.revived).toBeCloseTo(2.9);
});

//  The end screen once read its reason off the wardens connected, so a
//  teammate who dropped while it showed turned a team's loss into a solo
//  one.
it("keeps why the run ended as it stands, whoever drops after", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    knockDown(bo);
    game.step(lastFallSeconds + 0.1);

    bo.add(DisconnectedTrait);
    game.step(1);

    expect(readShown(game)).toMatchObject({
        phase: "over",
        cause: EndCause.EveryoneDown,
    });
});

it("clears why the last run ended as the next one starts", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    knockDown(bo);
    game.step(lastFallSeconds + 0.1);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    deliverSignal(game.world, {
        hero: bo,
        message: siegePlugin.messages.ready,
    });
    game.step(countdownSeconds + fixedStepSeconds * 2);

    expect(readShown(game)).toMatchObject({
        phase: "breather",
        cause: EndCause.None,
    });
});

it("waits on the end screen until every warden asks to go again", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    knockDown(bo);
    game.step(lastFallSeconds + 0.1);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    game.step(1);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
    expect(ada.has(ReadinessMachine.is.ready)).toBe(true);
});

it("starts a new run from the first breather once every warden asks to go again", async () => {
    const { game, ada, bo } = await openFight();
    ada.set(WalletTrait, { coins: 12 });
    ada.set(WardenTrait, { kills: 9 });
    knockDown(ada);
    knockDown(bo);
    game.step(lastFallSeconds + 0.1);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    deliverSignal(game.world, {
        hero: bo,
        message: siegePlugin.messages.ready,
    });
    game.step(countdownSeconds + fixedStepSeconds * 2);

    const state = readSiege(game.world);
    expect(state.phase).toBe(PhaseMachine.is.breather);
    expect(state.wave).toBe(0);
    expect(game.world.query(MonsterTrait)).toHaveLength(0);
    for (const warden of [ada, bo]) {
        const survivor = warden.get(WardenTrait);
        expect(warden.has(LifeMachine.is.down)).toBe(false);
        expect(survivor?.health).toBe(survivor?.maximum);
        expect(warden.has(ReadinessMachine.is.ready)).toBe(false);
    }
    expect(ada.get(WalletTrait)?.coins).toBe(0);
    expect(ada.get(WardenTrait)?.kills).toBe(0);
});

it("ignores a warden asking to go again while the run is still on", async () => {
    const { game, ada } = await openFight();

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    game.step(fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
    expect(ada.has(ReadinessMachine.is.ready)).toBe(false);
});

it("stands each warden at her own place by the fire as a run starts", async () => {
    siege = await openSiege();
    //  Side by side, as the room's own spawn ring can put two.
    const ada = joinWarden(siege, { name: "Ada", position: onField(-0.4) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(0.4) });

    deliverSignal(siege.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    deliverSignal(siege.world, {
        hero: bo,
        message: siegePlugin.messages.ready,
    });
    siege.step(countdownSeconds + fixedStepSeconds * 2);

    const adaFeet = ada.get(TransformTrait);
    const boFeet = bo.get(TransformTrait);
    if (!adaFeet || !boFeet) throw new Error("No place.");
    //  Clear of the fire's stones, 1.2 m round, and a stride apart.
    for (const feet of [adaFeet, boFeet])
        expect(Math.hypot(feet.x, feet.z)).toBeGreaterThan(4);
    expect(adaFeet.distanceTo(boFeet)).toBeGreaterThan(4);
});

it("heals a warden resting by the fire between waves, and not one away from it", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, {
        name: "Ada",
        position: new Vector3(0, 0, fireMetres - 2),
    });
    const bo = joinWarden(siege, { name: "Bo", position: onField(0, 12) });
    takePlaces(siege, ada, bo);
    for (const warden of [ada, bo]) warden.set(WardenTrait, { health: 50 });

    siege.step(1);

    expect(ada.get(WardenTrait)?.health).toBeGreaterThan(55);
    expect(bo.get(WardenTrait)?.health).toBe(50);
});

it("clears the monsters off the field when the run ends", async () => {
    const { game, ada, bo } = await openFight();
    game.step(3);
    expect(game.world.query(MonsterTrait).length).toBeGreaterThan(0);

    knockDown(ada);
    knockDown(bo);
    game.step(lastFallSeconds + 0.1);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
    expect(game.world.query(MonsterTrait)).toHaveLength(0);
});
