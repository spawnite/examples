// @vitest-environment node
import type { Entity } from "koota";
import { Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import {
    fixedStepSeconds,
    Movement,
    teleportActor,
    Transform,
    Wallet,
} from "@spawnite/engine";
import { readyWeapon } from "../../src/siege/signals";
import { spawnMonster } from "../../src/siege/monsters";
import {
    MonsterKind,
    MonsterTrait,
    SiegePhase,
    WardenTrait,
} from "../../src/siege/traits";
import {
    firstBreatherSeconds,
    lobbySeconds,
    planWave,
} from "../../src/siege/waves";
import { fireMetres, reviveSeconds } from "../../src/siege/downs";
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

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Takes all her health, as the last blow of a fight does. */
function knockDown(warden: Entity) {
    warden.set(WardenTrait, { health: 0 });
}

/** Opens wave 1 with two wardens apart, and returns them. */
async function openFight() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(6) });
    takePlaces(siege, ada, bo);
    siege.step(firstBreatherSeconds + 0.1);
    expect(readSiege(siege.world).phase).toBe(SiegePhase.Fight);
    return { game: siege, ada, bo };
}

it("downs a warden at no health and keeps her in the room, unable to walk", async () => {
    const { game, ada } = await openFight();

    knockDown(ada);
    game.step(fixedStepSeconds);

    expect(ada.isAlive()).toBe(true);
    expect(ada.get(WardenTrait)?.down).toBe(true);
    expect(ada.get(Movement)?.speed).toBe(0);
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

    const at = husk.get(Transform);
    if (!at) throw new Error("No place.");
    expect(at.x).toBeGreaterThan(onField(-6).x + 1);
});

it("gets a downed warden up once a teammate has stood over her long enough", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    game.step(fixedStepSeconds);
    bo.set(Transform, onField(-6, 1));
    teleportActor(game.world, bo);

    game.step(reviveSeconds + 0.2);

    const survivor = ada.get(WardenTrait);
    expect(survivor?.down).toBe(false);
    expect(survivor?.health).toBeGreaterThan(0);
    expect(ada.get(Movement)?.speed).toBeGreaterThan(0);
});

it("gets every downed warden up when the wave is held", async () => {
    const { game, ada } = await openFight();
    knockDown(ada);
    game.step(fixedStepSeconds);

    holdWave(game);

    expect(readSiege(game.world).phase).toBe(SiegePhase.Breather);
    expect(ada.get(WardenTrait)?.down).toBe(false);
});

it("ends the run on the wave reached once every warden is down", async () => {
    const { game, ada, bo } = await openFight();

    knockDown(ada);
    knockDown(bo);
    game.step(fixedStepSeconds * 2);

    const state = readSiege(game.world);
    expect(state.phase).toBe(SiegePhase.Over);
    expect(state.wave).toBe(1);
});

it("waits on the end screen until every warden asks to go again", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    knockDown(bo);
    game.step(fixedStepSeconds * 2);

    deliverSignal(game.world, { hero: ada, name: readyWeapon });
    game.step(1);

    expect(readSiege(game.world).phase).toBe(SiegePhase.Over);
    expect(ada.get(WardenTrait)?.ready).toBe(true);
});

it("starts a new run from the first breather once every warden asks to go again", async () => {
    const { game, ada, bo } = await openFight();
    ada.set(Wallet, { coins: 12 });
    ada.set(WardenTrait, { kills: 9 });
    knockDown(ada);
    knockDown(bo);
    game.step(fixedStepSeconds * 2);

    deliverSignal(game.world, { hero: ada, name: readyWeapon });
    deliverSignal(game.world, { hero: bo, name: readyWeapon });
    game.step(fixedStepSeconds * 2);

    const state = readSiege(game.world);
    expect(state.phase).toBe(SiegePhase.Breather);
    expect(state.wave).toBe(0);
    expect(game.world.query(MonsterTrait)).toHaveLength(0);
    for (const warden of [ada, bo]) {
        const survivor = warden.get(WardenTrait);
        expect(survivor?.down).toBe(false);
        expect(survivor?.health).toBe(survivor?.maximum);
        expect(survivor?.ready).toBe(false);
    }
    expect(ada.get(Wallet)?.coins).toBe(0);
    expect(ada.get(WardenTrait)?.kills).toBe(0);
});

it("ignores a warden asking to go again while the run is still on", async () => {
    const { game, ada } = await openFight();

    deliverSignal(game.world, { hero: ada, name: readyWeapon });
    game.step(fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(SiegePhase.Fight);
    expect(ada.get(WardenTrait)?.ready).toBe(false);
});

it("stands each warden at her own place by the fire as a run starts", async () => {
    siege = await openSiege();
    //  Side by side, as the room's own spawn ring can put two.
    const ada = joinWarden(siege, { name: "Ada", position: onField(-0.4) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(0.4) });

    deliverSignal(siege.world, { hero: ada, name: readyWeapon });
    deliverSignal(siege.world, { hero: bo, name: readyWeapon });
    siege.step(fixedStepSeconds);

    const adaFeet = ada.get(Transform);
    const boFeet = bo.get(Transform);
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
    game.step(fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(SiegePhase.Over);
    expect(game.world.query(MonsterTrait)).toHaveLength(0);
});

it("starts the next run without a warden who never asks to go again", async () => {
    const { game, ada, bo } = await openFight();
    knockDown(ada);
    knockDown(bo);
    game.step(fixedStepSeconds * 2);

    deliverSignal(game.world, { hero: ada, name: readyWeapon });
    game.step(lobbySeconds - 1);
    expect(readSiege(game.world).phase).toBe(SiegePhase.Over);
    game.step(1.1);

    expect(readSiege(game.world).phase).toBe(SiegePhase.Breather);
});
