// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import type { Entity } from "koota";
import {
    addStatModifier,
    dealDamage,
    requireAuthority,
    fixedStepSeconds,
    readWeaponNumber,
    registerWeapon,
    TransformTrait,
    WeaponKind,
    WeaponNumber,
} from "@spawnite/engine";
import { blasterSettings, blasterWeapon } from "../../src/siege/blaster";
import { CardId, offerCards, pickCard } from "../../src/siege/cards";
import {
    Element,
    elementResistances,
    frostLevels,
    stormLevels,
    thunderhead,
} from "../../src/siege/elements";
import { lanceSettings, lanceWeapon } from "../../src/siege/lance";
import { WardenStat } from "../../src/siege/stats";
import { MonsterKind, StrikeKind, WardenTrait } from "../../src/siege/traits";
import {
    armWarden,
    landHit,
    landHits,
    readAfflictionsOf,
    readHealth,
    readStrikes,
    standMonster,
} from "./elements";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Steps of a tenth of a second between two of the test's hits. */
const stepsBetweenHits = 6;

/** Fires at `monster` for `seconds`, a hit every tenth of a second, and
 *  counts the Thunderhead bolts that fell. */
function fireFor(
    game: OpenedSiege,
    {
        monster,
        warden,
        seconds,
    }: { monster: Entity; warden: Entity; seconds: number },
) {
    let bolts = 0;
    const steps = Math.round(seconds / fixedStepSeconds);
    for (let step = 0; step < steps; step++) {
        if (step % stepsBetweenHits === 0)
            dealDamage(requireAuthority(game.world), monster, {
                amount: 0,
                source: warden,
                weapon: blasterWeapon,
                data: blasterSettings.data ?? null,
            });
        game.step(fixedStepSeconds);
        bolts += readStrikes(game.world).filter(
            ({ kind }) => kind === StrikeKind.Thunderhead,
        ).length;
    }
    return bolts;
}

async function openWithWarden() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });
    return { game: siege, ada };
}

it("lays as much of an element through the blaster as through the lance, over the same seconds", async () => {
    const { game, ada } = await openWithWarden();
    ada.set(WardenTrait, { offer: offerCards([CardId.StormLance]) });
    pickCard(ada, 0);
    armWarden(ada, Element.Frost);
    const blasted = standMonster(game.world, {
        kind: MonsterKind.Colossus,
        x: -6,
    });
    const lanced = standMonster(game.world, {
        kind: MonsterKind.Colossus,
        x: 6,
    });
    const rates = [blasterSettings, lanceSettings].map((settings) =>
        readWeaponNumber(settings, ada, WeaponNumber.ShotsPerSecond),
    );

    //  One lance shot, and the blaster shots of the same seconds.
    landHits(game, { monster: blasted, warden: ada }, rates[0] / rates[1]);
    landHit(game, { monster: lanced, warden: ada, weapon: lanceWeapon });

    expect(readAfflictionsOf(blasted).chill).toBeGreaterThan(0);
    expect(readAfflictionsOf(lanced).chill).toBeCloseTo(
        readAfflictionsOf(blasted).chill,
        6,
    );
});

it("gives each pellet of a gun that fires several its share of the pull's dose", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Frost);
    registerWeapon(game.world, "scattergun", {
        kind: WeaponKind.Instant,
        damage: 2,
        range: 12,
        shotsPerSecond: 1,
        pellets: 5,
        data: { dose: 1 },
    });
    const colossus = standMonster(game.world, { kind: MonsterKind.Colossus });

    dealDamage(requireAuthority(game.world), colossus, {
        amount: 0,
        source: ada,
        weapon: "scattergun",
        data: { dose: 1 },
    });
    game.step(fixedStepSeconds);

    expect(readAfflictionsOf(colossus).chill).toBeCloseTo(
        (frostLevels[0].build * 0.2) / elementResistances.colossus.chill,
        6,
    );
});

it("spreads a pull's dose among the pellets a gun's tier adds", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Frost);
    const plain = standMonster(game.world, { kind: MonsterKind.Brute, x: -3 });
    const spread = standMonster(game.world, { kind: MonsterKind.Brute, x: 3 });
    landHit(game, { monster: plain, warden: ada });
    addStatModifier(ada, WardenStat.GunPellets, { source: "test", flat: 2 });
    landHit(game, { monster: spread, warden: ada });

    expect(readAfflictionsOf(spread).chill).toBeCloseTo(
        readAfflictionsOf(plain).chill / 3,
        6,
    );
});

it("arcs a Storm hit through the monsters nearest it, one leap each, as far as its level reaches", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Storm);
    const { jumps, metres } = stormLevels[0];
    const struck = standMonster(game.world, { kind: MonsterKind.Brute, x: 0 });
    //  Each a leap from the last; the far one out of any leap's reach.
    const chained = Array.from({ length: jumps }, (_, index) =>
        standMonster(game.world, {
            kind: MonsterKind.Brute,
            x: (index + 1) * (metres - 1),
        }),
    );
    const beyond = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: (jumps + 1) * (metres - 1),
    });
    const far = standMonster(game.world, { kind: MonsterKind.Brute, x: -20 });
    const before = readHealth(beyond);

    landHit(game, { monster: struck, warden: ada, weapon: lanceWeapon });

    for (const monster of chained)
        expect(readHealth(monster)).toBeLessThan(before);
    expect(readHealth(beyond)).toBe(before);
    expect(readHealth(far)).toBe(before);
    const arc = readStrikes(game.world).find(
        ({ kind }) => kind === StrikeKind.Arc,
    );
    expect(arc?.by).toBe(ada);
    expect(arc?.points).toHaveLength((jumps + 1) * 3);
});

it("arcs about half the blaster's Storm hits, a whole dose's worth a second", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Storm);
    const struck = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e6,
    });
    standMonster(game.world, { kind: MonsterKind.Brute, x: 2, health: 1e6 });
    let arcs = 0;

    for (let hit = 0; hit < 200; hit++) {
        landHit(game, { monster: struck, warden: ada });
        arcs += readStrikes(game.world).filter(
            ({ kind }) => kind === StrikeKind.Arc,
        ).length;
    }

    expect(arcs).toBeGreaterThan(70);
    expect(arcs).toBeLessThan(130);
});

it("chills a monster by the dose: a second of blaster hits adds one whole dose's chill", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Frost);
    const blasted = standMonster(game.world, {
        kind: MonsterKind.Colossus,
        x: -4,
    });

    landHits(game, { monster: blasted, warden: ada, weapon: blasterWeapon }, 6);

    //  A colossus takes a tenth of the chill a husk does; one second of
    //  any gun is one dose.
    expect(readAfflictionsOf(blasted).chill).toBeCloseTo(
        frostLevels[0].build / elementResistances.colossus.chill,
        6,
    );
});

it("drops Thunderhead's bolt on the monster a Storm warden last hit, every few seconds while she fires", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Storm, 3);
    const target = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e6,
    });
    const beside = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 1.5,
        health: 1e6,
    });

    //  Six seconds of firing, a hit every tenth of a second.
    const bolts = fireFor(game, { monster: target, warden: ada, seconds: 6 });

    expect(bolts).toBe(6 / thunderhead.everySeconds);
    expect(readHealth(beside)).toBeLessThan(1e6);
});

it("drops Thunderhead's bolt where her last hit brought its monster down, its dose on the nearest monster there", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Storm, 3);
    //  The farther one first, so the room's order would pick it.
    const farther = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 6,
        health: 1e4,
    });
    const nearer = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 4.5,
        health: 1e4,
    });
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: 4,
        health: 1,
    });
    const fell = husk.get(TransformTrait)?.clone();

    dealDamage(requireAuthority(game.world), husk, {
        amount: 10,
        source: ada,
        weapon: blasterWeapon,
        data: blasterSettings.data ?? null,
    });
    game.step(fixedStepSeconds);

    const strikes = readStrikes(game.world);
    const bolt = strikes.find(({ kind }) => kind === StrikeKind.Thunderhead);
    expect(bolt?.points[0]).toBeCloseTo(fell?.x ?? NaN, 1);
    expect(bolt?.points[2]).toBeCloseTo(fell?.z ?? NaN, 1);
    expect(readHealth(nearer)).toBeLessThan(1e4);
    expect(readHealth(farther)).toBeLessThan(1e4);
    //  The whole Storm dose arcs from the nearer one.
    const arc = strikes.find(({ kind }) => kind === StrikeKind.Arc);
    expect(arc?.points[0]).toBeCloseTo(nearer.get(TransformTrait)?.x ?? NaN, 1);
});

it("drops no bolt while a Thunderhead warden holds her fire", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Storm, 3);
    const target = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e6,
    });
    landHit(game, { monster: target, warden: ada });
    game.step(thunderhead.everySeconds);
    let bolts = 0;

    for (let step = 0; step < 4 * 60; step++) {
        game.step(fixedStepSeconds);
        bolts += readStrikes(game.world).filter(
            ({ kind }) => kind === StrikeKind.Thunderhead,
        ).length;
    }

    expect(bolts).toBe(0);
});

it("drops no bolt for a Storm warden below the capstone", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Storm, 2);
    const target = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e6,
    });

    expect(fireFor(game, { monster: target, warden: ada, seconds: 6 })).toBe(0);
});
