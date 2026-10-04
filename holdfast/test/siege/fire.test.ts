// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import { Vector3 } from "three";
import { teleportActor, TransformTrait, WalletTrait } from "@spawnite/engine";
import {
    feedFire,
    measureFireRing,
    measureWaveHealing,
    readLevelCost,
} from "../../src/siege/fire";
import { FireTrait, WardenTrait } from "../../src/siege/traits";
import { firstBreatherSeconds } from "../../src/siege/waves";
import {
    joinWarden,
    onField,
    openSiege,
    readSiege,
    takePlaces,
    type OpenedSiege,
    setPhase,
} from "./room";

//  The fire: the team's sink. Each level its coins raise widens its ring,
//  which heals every warden inside it between waves and, once fed, during
//  them too.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** The fire's record on the siege. */
function readFire(game: OpenedSiege) {
    return game.world.queryFirst(FireTrait)?.get(FireTrait);
}

/** Stands `warden` `metres` from the fire, at her health's half. */
function woundAt(game: OpenedSiege, warden: Entity, metres: number) {
    warden.get(TransformTrait)?.copy(new Vector3(0, 0, metres));
    teleportActor(game.world, warden);
    warden.set(WardenTrait, { health: 50, maximum: 100 });
}

/** Opens wave 1 with Ada and Bo in it. */
async function openFight() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-3) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(3) });
    takePlaces(siege, ada, bo);
    siege.step(firstBreatherSeconds + 0.1);
    expect(readSiege(siege.world).phase).toBe(PhaseMachine.is.fight);
    return { game: siege, ada, bo };
}

it("rises a level each time its fuel reaches the level's cost, 30 coins and 20 more each level, and carries the rest", async () => {
    const { game, ada, bo } = await openFight();
    ada.set(WalletTrait, { coins: 100 });
    bo.set(WalletTrait, { coins: 100 });

    for (let feed = 0; feed < 3; feed++) feedFire(game.world, ada);
    const first = { ...readFire(game) };
    for (let feed = 0; feed < 6; feed++) feedFire(game.world, bo);

    expect([0, 1, 2].map(readLevelCost)).toEqual([30, 50, 70]);
    expect(first).toEqual({ level: 1, fuel: 0, next: 50 });
    expect(readFire(game)).toEqual({ level: 2, fuel: 10, next: 70 });
    expect([ada, bo].map((warden) => warden.get(WalletTrait)?.coins)).toEqual([
        70, 40,
    ]);
});

it("widens its ring a metre each level, short of the stones, and heals more in a wave each level up to a ceiling", () => {
    expect([0, 1, 5, 20].map(measureFireRing)).toEqual([7, 8, 12, 16]);
    expect([0, 1, 4, 20].map(measureWaveHealing)).toEqual([0, 1.5, 6, 12]);
});

it("heals a warden inside its ring during a wave once it is fed, and none outside it", async () => {
    const { game, ada, bo } = await openFight();
    woundAt(game, ada, 7.5);
    game.step(1);
    const unfed = ada.get(WardenTrait)?.health;

    game.world
        .queryFirst(FireTrait)
        ?.set(FireTrait, { level: 1, fuel: 0, next: readLevelCost(1) });
    woundAt(game, ada, 7.5);
    woundAt(game, bo, 9);
    game.step(1);

    expect(unfed).toBe(50);
    expect(ada.get(WardenTrait)?.health).toBeCloseTo(51.5, 1);
    expect(bo.get(WardenTrait)?.health).toBe(50);
});

it("heals every warden inside its ring between waves, at its breather's rate, and the ring is its level's", async () => {
    const { game, ada, bo } = await openFight();
    setPhase(game.world, PhaseMachine.is.breather, 20);
    game.world.queryFirst(FireTrait)?.set(FireTrait, { level: 2 });
    woundAt(game, ada, 8.5);
    woundAt(game, bo, 9.5);
    game.step(1);

    expect(ada.get(WardenTrait)?.health).toBeCloseTo(65, 0);
    expect(bo.get(WardenTrait)?.health).toBe(50);
});
