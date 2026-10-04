// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { HealthTrait, InvulnerableTrait, readTimeline } from "@spawnite/engine";
import { timeline } from "../../src/scenes/Holdfast";
import { reviveSeconds } from "../../src/siege/downs";
import { spawnMonster } from "../../src/siege/monsters";
import { lastFallSeconds } from "../../src/siege/siege";
import { firstBreatherSeconds, planWave } from "../../src/siege/waves";
import { Element, Reaction } from "../../src/siege/elements";
import {
    FireTrait,
    LedgerTrait,
    MonsterKind,
    MonsterTrait,
    ReactionTallyTrait,
    SiegeTrait,
    WardenElementsTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    joinWarden,
    onField,
    openSiege,
    takePlaces,
    type OpenedSiege,
} from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

it("records the wave, the phase and the wardens' tallies, and ends the run once every warden is down", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(6) });

    expect(readTimeline(siege.world, timeline)).toEqual({
        values: {
            wave: 0,
            phase: "waiting",
            kills: 0,
            downs: 0,
            coins: 0,
            monsters: 0,
            earned: 0,
            spent: 0,
            rerolls: 0,
            guns: 0,
            upgrades: 0,
            cards: 0,
            fed: 0,
            fire: 0,
            chainShocks: 0,
            blasts: 0,
            steamClouds: 0,
            ownReactions: 0,
            linePoints: 0,
            capstones: 0,
            monsterSeconds: 0,
            colossusSeconds: 0,
            killsHusk: 0,
            damageHusk: 0,
            hurtHusk: 0,
            killsSkitter: 0,
            damageSkitter: 0,
            hurtSkitter: 0,
            killsBrute: 0,
            damageBrute: 0,
            hurtBrute: 0,
            killsSpitter: 0,
            damageSpitter: 0,
            hurtSpitter: 0,
            killsColossus: 0,
            damageColossus: 0,
            hurtColossus: 0,
            hurt: 0,
            revives: 0,
            selfRevives: 0,
        },
        over: false,
    });

    takePlaces(siege, ada, bo);
    siege.step(firstBreatherSeconds + 0.1);
    ada.set(WardenTrait, { health: 0, kills: 3 });
    siege.step(1 / 60);

    const fighting = readTimeline(siege.world, timeline);
    expect(fighting.values).toMatchObject({
        wave: 1,
        phase: "fight",
        kills: 3,
        downs: 1,
    });
    expect(fighting.values.monsters).toBeGreaterThan(0);
    expect(fighting.over).toBe(false);

    bo.set(WardenTrait, { health: 0 });
    siege.step(lastFallSeconds + 0.1);
    expect(readTimeline(siege.world, timeline).over).toBe(true);
});

it("records what the wardens earned, spent and bought, and the fire's level", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(6) });
    siege.step(1 / 60);
    ada.add(
        LedgerTrait({ earned: 40, spent: 30, rerolls: 1, guns: 1, fed: 20 }),
    );
    bo.add(LedgerTrait({ earned: 40, spent: 50, upgrades: 1 }));
    siege.world.queryFirst(FireTrait)?.set(FireTrait, { level: 2 });

    expect(readTimeline(siege.world, timeline).values).toMatchObject({
        earned: 80,
        spent: 80,
        rerolls: 1,
        guns: 1,
        upgrades: 1,
        fed: 20,
        fire: 2,
    });
});

it("records each reaction the wardens set off, and a warden's own apart", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(6) });
    siege.step(1 / 60);
    const hues = [ada, bo].map((warden) => warden.get(WardenTrait)?.hue ?? 0);
    siege.world.queryFirst(SiegeTrait)?.add(
        ReactionTallyTrait({
            counts: {
                [`${hues[0]}-${hues[1]}:${Reaction.ChainShock}`]: 3,
                [`${hues[0]}-${hues[1]}:${Reaction.Blast}`]: 1,
                [`${hues[0]}-${hues[0]}:${Reaction.SteamCloud}`]: 2,
            },
        }),
    );

    expect(readTimeline(siege.world, timeline).values).toMatchObject({
        chainShocks: 3,
        blasts: 1,
        steamClouds: 2,
        ownReactions: 2,
    });
});

it("records the points on the wardens' element lines and the capstones they hold", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(6) });
    siege.step(1 / 60);
    //  Added where the gathering gave none yet, as a pick does.
    for (const warden of [ada, bo]) warden.add(WardenElementsTrait);
    ada.set(WardenElementsTrait, {
        first: Element.Storm,
        firstLevel: 3,
        firstPoints: 10,
        second: Element.Frost,
        secondLevel: 1,
        secondPoints: 2,
    });
    bo.set(WardenElementsTrait, {
        first: Element.Ember,
        firstLevel: 2,
        firstPoints: 5,
    });

    expect(readTimeline(siege.world, timeline).values).toMatchObject({
        linePoints: 17,
        capstones: 1,
    });
});

it("records the seconds monsters stand, each kind's kills and health felled, the blows the wardens take and how they get up", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField(-1) });
    const bo = joinWarden(game, { name: "Bo", position: onField(1) });
    takePlaces(game, ada, bo);
    game.step(firstBreatherSeconds + 0.1);
    for (const monster of game.world.query(MonsterTrait)) monster.destroy();
    const before = readTimeline(game.world, timeline).values;
    const rise = (name: string) =>
        Number(readTimeline(game.world, timeline).values[name]) -
        Number(before[name]);

    const colossus = spawnMonster(game.world, {
        kind: MonsterKind.Colossus,
        position: onField(0, 12),
        plan: planWave(5, 2),
    });
    game.step(1);
    const greatest = colossus.get(HealthTrait)?.maximum ?? 0;
    colossus.set(HealthTrait, { current: 0 });
    game.step(1 / 60);

    expect(rise("monsterSeconds")).toBeGreaterThan(0.9);
    expect(rise("colossusSeconds")).toBeCloseTo(1, 1);
    expect(rise("killsColossus")).toBe(1);
    expect(rise("damageColossus")).toBe(greatest);

    //  A blow counts though it takes no health.
    bo.add(InvulnerableTrait);
    spawnMonster(game.world, {
        kind: MonsterKind.Husk,
        position: onField(1, 0.8),
        plan: planWave(1, 2),
    });
    game.step(1.5);
    expect(rise("hurt")).toBeGreaterThan(0);
    expect(rise("hurtHusk")).toBe(rise("hurt"));
    expect(rise("hurtColossus")).toBe(0);
    for (const monster of game.world.query(MonsterTrait)) monster.destroy();

    ada.set(WardenTrait, { health: 0 });
    game.step(reviveSeconds + 0.5);
    expect(rise("revives")).toBe(1);
    expect(rise("selfRevives")).toBe(0);
});
