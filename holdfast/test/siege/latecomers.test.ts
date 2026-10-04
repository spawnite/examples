// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import {
    DisarmedTrait,
    DisconnectedTrait,
    fixedStepSeconds,
    HealthTrait,
    TransformTrait,
} from "@spawnite/engine";
import { CardId } from "../../src/siege/cards";
import { Element } from "../../src/siege/elements";
import { spawnMonster } from "../../src/siege/monsters";
import { siegePlugin } from "../../src/siege/siege.plugin";
import {
    MonsterKind,
    MonsterTrait,
    WardenElementsTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    bossEvery,
    firstBreatherSeconds,
    planWave,
    shelterSeconds,
} from "../../src/siege/waves";
import {
    deliverSignal,
    fortify,
    holdWave,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    skipToBreather,
    takePlaces,
    type OpenedSiege,
} from "./room";
import { LifeMachine, LifeTrait } from "../../src/siege/life";

//  A warden who joins a run already going: at the fire, sheltered while she
//  picks her element and takes a card for each breather she missed, and
//  the wave sized for her.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Two fortified wardens into wave `wave`'s fight: from the breather
 *  after the wave before it, its cards taken for them, the waves before
 *  that skipped rather than fought. */
async function openWave(wave: number) {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField(-4) });
    const bo = joinWarden(game, { name: "Bo", position: onField(4) });
    takePlaces(game, ada, bo);
    fortify(game, ada);
    fortify(game, bo);
    if (wave === 1) game.step(firstBreatherSeconds + 0.1);
    else {
        skipToBreather(game, wave - 1);
        //  Both ready, so the breather ends a few seconds on.
        for (const hero of [ada, bo])
            deliverSignal(game.world, {
                hero,
                message: siegePlugin.messages.ready,
            });
        while (readSiege(game.world).phase === PhaseMachine.is.breather)
            game.step(0.5);
    }
    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave,
    });
    return { game, ada, bo };
}

/** The cards of her offer, by id. */
function readOffer(warden: Entity) {
    return readWarden(warden).offer.map(({ card }) => card);
}

function readWarden(warden: Entity) {
    const survivor = warden.get(WardenTrait);
    if (!survivor) throw new Error("No warden.");
    return survivor;
}

/** A warden who joins the run now, standing where the room stands her. */
function joinLate(game: OpenedSiege, name = "Cy") {
    return joinWarden(game, { name, position: onField(0, 12) });
}

it("deals a warden who joins a running run her element, then a card for each breather she missed, one after another", async () => {
    const { game } = await openWave(3);

    const cy = joinLate(game);
    expect(readWarden(cy).catchUp).toBe(3);
    expect(cy.has(LifeMachine.is.sheltered)).toBe(true);
    expect(readOffer(cy)).toEqual([CardId.Storm, CardId.Ember, CardId.Frost]);

    deliverSignal(game.world, {
        hero: cy,
        message: siegePlugin.messages.pick,
        payload: { slot: 1 },
    });
    game.step(fixedStepSeconds * 2);
    expect(cy.get(WardenElementsTrait)?.first).toBe(Element.Ember);
    expect(readWarden(cy).catchUp).toBe(2);
    expect(cy.has(LifeMachine.is.sheltered)).toBe(true);
    expect(readWarden(cy).cards).toHaveLength(0);
    expect(readWarden(cy).offer).toHaveLength(3);

    deliverSignal(game.world, {
        hero: cy,
        message: siegePlugin.messages.pick,
        payload: { slot: 0 },
    });
    game.step(fixedStepSeconds * 2);
    expect(readWarden(cy).catchUp).toBe(1);
    expect(cy.has(LifeMachine.is.sheltered)).toBe(true);
    expect(readWarden(cy).cards).toHaveLength(1);
    expect(readWarden(cy).offer).toHaveLength(3);

    deliverSignal(game.world, {
        hero: cy,
        message: siegePlugin.messages.pick,
        payload: { slot: 2 },
    });
    game.step(fixedStepSeconds * 2);

    expect(readWarden(cy)).toMatchObject({ catchUp: 0, offer: [] });
    expect(cy.has(LifeMachine.is.sheltered)).toBe(false);
    expect(readWarden(cy).cards).toHaveLength(2);
});

it("counts the breather she joins in among those she missed", async () => {
    const { game } = await openWave(1);
    holdWave(game);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);

    const cy = joinLate(game);

    expect(readWarden(cy).catchUp).toBe(2);
    expect(cy.has(LifeMachine.is.sheltered)).toBe(true);
});

it("keeps her offers through the wave's opening while she catches up", async () => {
    const { game } = await openWave(1);
    holdWave(game);
    const cy = joinLate(game);
    const offer = readWarden(cy).offer;
    //  Past the breather's length, so the wave opens while she still picks.
    cy.set(LifeTrait, { waited: shelterSeconds - 1000 });

    while (readSiege(game.world).phase === PhaseMachine.is.breather)
        game.step(0.5);

    expect(readWarden(cy)).toMatchObject({ catchUp: 2, offer });
    expect(readWarden(cy).cards).toHaveLength(0);
});

it("adds the next breather's card to what she still has to take, after her own", async () => {
    const { game } = await openWave(3);
    const cy = joinLate(game);
    const offer = readWarden(cy).offer;
    //  Past a wave's length, so the wave is held while she still picks.
    cy.set(LifeTrait, { waited: shelterSeconds - 1000 });

    holdWave(game);

    expect(readWarden(cy)).toMatchObject({ catchUp: 4, offer });
});

it("deals a warden who joins before a breather has dealt her element alone, sheltered while she picks it", async () => {
    const { game } = await openWave(1);

    const cy = joinLate(game);

    expect(readWarden(cy).catchUp).toBe(1);
    expect(cy.has(LifeMachine.is.sheltered)).toBe(true);
    expect(readOffer(cy)).toEqual([CardId.Storm, CardId.Ember, CardId.Frost]);
});

it("keeps the monsters off a sheltered warden, and her health whole", async () => {
    const { game } = await openWave(3);
    for (const monster of game.world.query(MonsterTrait)) monster.destroy();
    const cy = joinLate(game);
    const feet = cy.get(TransformTrait);
    if (!feet) throw new Error("No place.");
    spawnMonster(game.world, {
        kind: MonsterKind.Husk,
        position: feet.clone().setX(feet.x + 0.9),
        plan: planWave(3, 3),
    });

    game.step(2);

    expect(readWarden(cy).health).toBe(readWarden(cy).maximum);
});

it("disarms a sheltered warden, and arms her once she has taken her cards", async () => {
    const { game } = await openWave(2);
    const cy = joinLate(game);
    expect(cy.has(DisarmedTrait)).toBe(true);

    for (const slot of [1, 1]) {
        deliverSignal(game.world, {
            hero: cy,
            message: siegePlugin.messages.pick,
            payload: { slot },
        });
        game.step(fixedStepSeconds * 2);
    }

    expect(cy.has(DisarmedTrait)).toBe(false);
});

it("takes the cards she has not taken for her at random once her shelter runs out", async () => {
    const { game } = await openWave(3);
    const cy = joinLate(game);
    expect(cy.has(LifeMachine.is.sheltered.catchingUp)).toBe(true);
    //  The last second of it, so a wave that floods the field steps little.
    cy.set(LifeTrait, { waited: shelterSeconds - 1 });

    game.step(1.1);

    expect(readWarden(cy).catchUp).toBe(0);
    expect(cy.has(LifeMachine.is.sheltered)).toBe(false);
    expect(readWarden(cy).cards).toHaveLength(2);
    expect(cy.get(WardenElementsTrait)?.firstLevel).toBe(1);
    expect(cy.has(DisarmedTrait)).toBe(false);
});

it("takes her cards for her once her shelter runs out, though her connection dropped while she picked", async () => {
    const { game } = await openWave(3);
    const cy = joinLate(game);
    deliverSignal(game.world, {
        hero: cy,
        message: siegePlugin.messages.pick,
        payload: { slot: 0 },
    });
    game.step(fixedStepSeconds * 2);

    cy.add(DisconnectedTrait);
    cy.set(LifeTrait, { waited: shelterSeconds - 1 });
    game.step(1.1);

    expect(readWarden(cy).catchUp).toBe(0);
    expect(cy.has(LifeMachine.is.sheltered)).toBe(false);
    expect(readWarden(cy).cards).toHaveLength(2);
});

it("tops the wave up to what it would have planned for one more warden", async () => {
    const { game } = await openWave(4);
    const before = readSiege(game.world).toSpawn;

    joinLate(game);

    expect(readSiege(game.world).toSpawn).toBe(
        before + planWave(4, 3).count - planWave(4, 2).count,
    );
});

it("changes nothing of the wave when a warden leaves", async () => {
    const { game, bo } = await openWave(4);
    const before = readSiege(game.world).toSpawn;

    bo.destroy();
    game.step(fixedStepSeconds);

    expect(readSiege(game.world).toSpawn).toBeLessThanOrEqual(before);
    expect(readSiege(game.world).toSpawn).toBeGreaterThanOrEqual(before - 3);
});

it("tops a boss wave up with escorts and keeps the risen boss's health", async () => {
    const { game } = await openWave(bossEvery);
    game.step(0.5);
    const boss = game.world
        .query(MonsterTrait)
        .find(
            (monster) =>
                monster.get(MonsterTrait)?.kind === MonsterKind.Colossus,
        );
    const health = boss?.get(HealthTrait)?.maximum;
    expect(health).toBeGreaterThan(0);

    joinLate(game);
    game.step(0.5);

    expect(readSiege(game.world).bosses).toBe(0);
    expect(boss?.get(HealthTrait)?.maximum).toBe(health);
});
