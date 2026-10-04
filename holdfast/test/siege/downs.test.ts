// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import {
    DisconnectedTrait,
    fixedStepSeconds,
    readWeaponNumber,
    teleportActor,
    TransformTrait,
    WeaponNumber,
} from "@spawnite/engine";
import { blasterSettings } from "../../src/siege/blaster";
import { CardId, offerCards, pickCard } from "../../src/siege/cards";
import {
    reviveSeconds,
    riseGraceSeconds,
    selfReviveSeconds,
} from "../../src/siege/downs";
import { lanceSettings } from "../../src/siege/lance";
import { spawnMonster } from "../../src/siege/monsters";
import { lastFallSeconds } from "../../src/siege/siege";
import {
    EndCause,
    MonsterKind,
    SiegeStateTrait,
    SiegeTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    bossEvery,
    firstBreatherSeconds,
    planWave,
} from "../../src/siege/waves";
import {
    holdWave,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    takePlaces,
    type OpenedSiege,
    setPhase,
} from "./room";
import { LifeMachine } from "../../src/siege/life";

//  A downed warden keeps shooting at half her rate, which the room reads
//  off her stats as it judges each shot, and a warden alone gets herself
//  up once each boss cycle.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Takes all her health, as the last blow of a fight does, and lets the
 *  room see it. */
function knockDown(game: OpenedSiege, warden: Entity) {
    warden.set(WardenTrait, { health: 0 });
    game.step(fixedStepSeconds * 2);
}

/** The run as pages read it. */
function readShown(game: OpenedSiege) {
    return game.world.queryFirst(SiegeTrait)?.get(SiegeTrait);
}

/** Her rate with `settings` as the room's judge reads it off her. */
function readRate(warden: Entity, settings = blasterSettings) {
    return readWeaponNumber(settings, warden, WeaponNumber.ShotsPerSecond);
}

/** Opens wave 1 with `names` wardens standing apart. */
async function openFight(...names: string[]) {
    siege = await openSiege();
    const game = siege;
    const wardens = names.map((name, index) =>
        joinWarden(game, { name, position: onField(index * 8 - 4) }),
    );
    takePlaces(game, ...wardens);
    game.step(firstBreatherSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
    return { game, wardens };
}

it("fires at half her rate while she is down, and at all of it once she is up", async () => {
    const {
        game,
        wardens: [ada, bo],
    } = await openFight("Ada", "Bo");
    const standing = readRate(ada);

    knockDown(game, ada);
    expect(ada.has(LifeMachine.is.down)).toBe(true);
    expect(readRate(ada)).toBeCloseTo(standing / 2);

    const feet = ada.get(TransformTrait);
    if (!feet) throw new Error("No place.");
    bo.set(TransformTrait, feet.clone());
    teleportActor(game.world, bo);
    game.step(reviveSeconds + 0.2);
    expect(ada.has(LifeMachine.is.down)).toBe(false);
    expect(readRate(ada)).toBeCloseTo(standing);
});

it("halves the lance's rate too, and keeps her cards' share of it", async () => {
    const {
        game,
        wardens: [ada],
    } = await openFight("Ada", "Bo");
    ada.set(WardenTrait, {
        offer: offerCards([CardId.StormLance]),
        taken: "",
    });
    pickCard(ada, 0);
    ada.set(WardenTrait, {
        offer: offerCards([CardId.HairTrigger]),
        taken: "",
    });
    pickCard(ada, 0);
    const standing = readRate(ada, lanceSettings);

    knockDown(game, ada);

    expect(readRate(ada, lanceSettings)).toBeCloseTo(standing / 2);
});

it("stands a downed warden up at her whole rate when the wave is held", async () => {
    const {
        game,
        wardens: [ada],
    } = await openFight("Ada", "Bo");
    const standing = readRate(ada);
    knockDown(game, ada);

    holdWave(game);

    expect(readRate(ada)).toBeCloseTo(standing);
});

it("gets a warden alone up on her own after a few seconds, and the run goes on", async () => {
    const {
        game,
        wardens: [ada],
    } = await openFight("Ada");
    expect(ada.get(WardenTrait)?.selfRevive).toBe(true);

    knockDown(game, ada);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
    game.step(selfReviveSeconds - 0.5);
    expect(ada.has(LifeMachine.is.down)).toBe(true);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);

    game.step(1);

    const survivor = ada.get(WardenTrait);
    expect(ada.has(LifeMachine.is.down)).toBe(false);
    expect(survivor?.health).toBeGreaterThan(0);
    expect(survivor?.selfRevive).toBe(false);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
});

//  A warden alone lies among the monsters that downed her, and every one of
//  them strikes the moment she stands: in a playthrough on 2026-09-28 she
//  got up on wave 14 with 40 health, kept 2 of it, and fell for good 1.4 s
//  later.
it("spares a warden who just got up from every blow for a moment, then lets them land again", async () => {
    const {
        game,
        wardens: [ada],
    } = await openFight("Ada");
    knockDown(game, ada);
    const feet = ada.get(TransformTrait);
    for (const side of [-1, 1])
        spawnMonster(game.world, {
            kind: MonsterKind.Husk,
            position: feet?.clone().setX(feet.x + side * 0.9) ?? onField(),
            plan: planWave(1, 1),
        });
    game.step(selfReviveSeconds + 0.1);
    const risen = ada.get(WardenTrait);
    expect(ada.has(LifeMachine.is.down)).toBe(false);

    game.step(riseGraceSeconds - 0.3);
    expect(ada.get(WardenTrait)?.health).toBe(risen?.health);

    game.step(0.6);
    expect(ada.get(WardenTrait)?.health).toBeLessThan(risen?.health ?? 0);
});

it("ends a warden alone's run when she falls a second time in one boss cycle", async () => {
    const {
        game,
        wardens: [ada],
    } = await openFight("Ada");
    knockDown(game, ada);
    game.step(selfReviveSeconds + 0.5);
    expect(ada.has(LifeMachine.is.down)).toBe(false);

    knockDown(game, ada);
    expect(readShown(game)?.cause).toBe(EndCause.FellAlone);
    game.step(lastFallSeconds + 0.1);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
    expect(readShown(game)?.cause).toBe(EndCause.FellAlone);
});

it("gives a warden alone her self-revive back once a colossus's wave is held", async () => {
    const {
        game,
        wardens: [ada],
    } = await openFight("Ada");
    ada.set(WardenTrait, { health: 1e6, maximum: 1e6 });
    knockDown(game, ada);
    game.step(selfReviveSeconds + 0.5);
    ada.set(WardenTrait, { health: 1e6, maximum: 1e6 });
    holdWave(game);
    expect(ada.get(WardenTrait)?.selfRevive).toBe(false);

    game.world
        .queryFirst(SiegeStateTrait)
        ?.set(SiegeStateTrait, { wave: bossEvery - 1 });
    setPhase(game.world, PhaseMachine.is.breather, 0.5);
    game.step(1);
    expect(readSiege(game.world).wave).toBe(bossEvery);
    holdWave(game);

    expect(ada.get(WardenTrait)?.selfRevive).toBe(true);
});

it("gets a warden up on her own whose only teammate's connection dropped", async () => {
    const {
        game,
        wardens: [ada, bo],
    } = await openFight("Ada", "Bo");
    bo.add(DisconnectedTrait);

    knockDown(game, ada);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
    game.step(selfReviveSeconds + 0.5);

    expect(ada.has(LifeMachine.is.down)).toBe(false);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
});

it("gets nobody up on her own while two wardens hold the circle", async () => {
    const {
        game,
        wardens: [ada, bo],
    } = await openFight("Ada", "Bo");

    knockDown(game, ada);
    game.step(selfReviveSeconds + 1);

    expect(ada.has(LifeMachine.is.down)).toBe(true);
    knockDown(game, bo);
    game.step(lastFallSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
    expect(readShown(game)?.cause).toBe(EndCause.EveryoneDown);
});
