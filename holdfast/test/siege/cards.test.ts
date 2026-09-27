// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { fixedStepSeconds, Movement } from "@spawnite/engine";
import { CardId, cards } from "../../src/siege/cards";
import { pickWeapons, readyWeapon } from "../../src/siege/signals";
import { readWardenStat, WardenStat } from "../../src/siege/stats";
import { SiegePhase, WardenTrait } from "../../src/siege/traits";
import { breatherSeconds, firstBreatherSeconds } from "../../src/siege/waves";
import {
    fortify,
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

/** Holds wave 1, every monster killed as it spawns, and returns in the
 *  breather after it. */
function holdFirstWave(game: OpenedSiege) {
    game.step(firstBreatherSeconds + 0.1);
    holdWave(game);
}

async function openBreather() {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField(-4) });
    const bo = joinWarden(game, { name: "Bo", position: onField(4) });
    takePlaces(game, ada, bo);
    fortify(game, ada);
    fortify(game, bo);
    holdFirstWave(game);
    expect(readSiege(game.world).phase).toBe(SiegePhase.Breather);
    return { game, ada, bo };
}

function readOffer(warden: Entity) {
    return warden.get(WardenTrait)?.offer ?? [];
}

it("offers no card before the first wave", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });
    takePlaces(siege, ada);
    siege.step(1);

    expect(readOffer(ada)).toEqual([]);
});

it("offers each warden three different cards once a wave is held", async () => {
    const { ada, bo } = await openBreather();

    for (const warden of [ada, bo]) {
        const offer = readOffer(warden);
        expect(offer).toHaveLength(3);
        expect(new Set(offer).size).toBe(3);
        for (const card of offer) expect(Object.keys(cards)).toContain(card);
    }
});

it("takes the card she picks, and no second one that breather", async () => {
    const { game, ada } = await openBreather();
    const offer = readOffer(ada);

    deliverSignal(game.world, { hero: ada, name: pickWeapons[1] });
    game.step(fixedStepSeconds);
    deliverSignal(game.world, { hero: ada, name: pickWeapons[2] });
    game.step(fixedStepSeconds);

    const survivor = ada.get(WardenTrait);
    expect(survivor?.taken).toBe(offer[1]);
    expect(survivor?.cards).toEqual([offer[1]]);
});

it("takes no pick while a wave is being fought", async () => {
    const { game, ada } = await openBreather();
    game.step(breatherSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(SiegePhase.Fight);

    deliverSignal(game.world, { hero: ada, name: pickWeapons[0] });
    game.step(fixedStepSeconds);

    expect(ada.get(WardenTrait)?.cards).toHaveLength(1);
});

it("gives a warden who did not pick one of her three as the next wave opens", async () => {
    const { game, ada } = await openBreather();
    const offer = readOffer(ada);

    game.step(breatherSeconds + 0.1);

    const survivor = ada.get(WardenTrait);
    expect(survivor?.cards).toHaveLength(1);
    expect(offer).toContain(survivor?.cards[0]);
    expect(survivor?.offer).toEqual([]);
});

it("raises her damage by the card she takes", async () => {
    const { game, ada } = await openBreather();
    ada.set(WardenTrait, {
        offer: [CardId.HeavyRounds, CardId.FleetFoot, CardId.IronHeart],
    });
    const before = readWardenStat(ada, WardenStat.Damage);

    deliverSignal(game.world, { hero: ada, name: pickWeapons[0] });
    game.step(fixedStepSeconds);

    expect(readWardenStat(ada, WardenStat.Damage)).toBeGreaterThan(before);
});

it("walks her faster with the speed card", async () => {
    const { game, ada } = await openBreather();
    ada.set(WardenTrait, {
        offer: [CardId.HeavyRounds, CardId.FleetFoot, CardId.IronHeart],
    });
    const before = ada.get(Movement)?.speed ?? 0;

    deliverSignal(game.world, { hero: ada, name: pickWeapons[1] });
    game.step(fixedStepSeconds);

    expect(ada.get(Movement)?.speed).toBeGreaterThan(before);
});

it("raises her greatest health and fills what it adds with the health card", async () => {
    const { game, ada } = await openBreather();
    ada.set(WardenTrait, { health: 50, maximum: 100 });
    ada.set(WardenTrait, {
        offer: [CardId.HeavyRounds, CardId.FleetFoot, CardId.IronHeart],
    });

    deliverSignal(game.world, { hero: ada, name: pickWeapons[2] });
    game.step(fixedStepSeconds);

    const survivor = ada.get(WardenTrait);
    expect(survivor?.maximum).toBeGreaterThan(100);
    expect(survivor?.health).toBeGreaterThan(50);
});

it("takes every card away when the wardens go again", async () => {
    const { game, ada, bo } = await openBreather();
    deliverSignal(game.world, { hero: ada, name: pickWeapons[0] });
    game.step(fixedStepSeconds);
    for (const warden of [ada, bo]) warden.set(WardenTrait, { health: 0 });
    game.step(fixedStepSeconds * 2);
    expect(readSiege(game.world).phase).toBe(SiegePhase.Over);

    deliverSignal(game.world, { hero: ada, name: readyWeapon });
    deliverSignal(game.world, { hero: bo, name: readyWeapon });
    game.step(fixedStepSeconds * 2);

    expect(ada.get(WardenTrait)?.cards).toEqual([]);
    for (const stat of Object.values(WardenStat))
        expect(readWardenStat(ada, stat)).toBe(readWardenStat(bo, stat));
});
