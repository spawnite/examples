// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    ChaseTrait,
    dealDamage,
    requireAuthority,
    fixedStepSeconds,
    HealthTrait,
} from "@spawnite/engine";
import {
    blazingSeconds,
    Element,
    elementResistances,
    frostLevels,
    Mark,
    markSettleSeconds,
    meltdown,
} from "../../src/siege/elements";
import { lanceWeapon } from "../../src/siege/lance";
import {
    ElementLookTrait,
    FrozenTrait,
    MonsterKind,
    MonsterTrait,
    type Strike,
    StrikeKind,
    WardenTrait,
} from "../../src/siege/traits";
import {
    armWarden,
    landHit,
    landHits,
    readAfflictionsOf,
    readHealth,
    readStrikes,
    standMonster,
} from "./elements";
import {
    fortify,
    joinWarden,
    onField,
    openSiege,
    type OpenedSiege,
} from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

async function openWithWarden(element: Element, level = 1) {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });
    fortify(siege, ada);
    armWarden(ada, element, level);
    return { game: siege, ada };
}

/** Health a monster loses over the next second. */
function measureLoss(
    game: OpenedSiege,
    monster: Parameters<typeof readHealth>[0],
) {
    const before = readHealth(monster);
    game.step(1);
    return before - readHealth(monster);
}

it("burns harder the more burn a monster holds", async () => {
    const { game, ada } = await openWithWarden(Element.Ember);
    const light = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: -4,
        health: 1e4,
    });
    const heavy = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 4,
        health: 1e4,
    });
    landHits(game, { monster: light, warden: ada }, 2);
    landHits(game, { monster: heavy, warden: ada }, 4);
    const burns = [
        readAfflictionsOf(light).burn,
        readAfflictionsOf(heavy).burn,
    ];

    const losses = [measureLoss(game, light), measureLoss(game, heavy)];

    expect(burns[1]).toBeCloseTo(burns[0] * 2, 6);
    expect(losses[0]).toBeGreaterThan(0);
    expect(losses[1]).toBeGreaterThan(losses[0] * 2);
});

it("lets a burn fade once no Ember hit feeds it", async () => {
    const { game, ada } = await openWithWarden(Element.Ember);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
    });
    landHits(game, { monster: brute, warden: ada }, 12);
    const fed = readAfflictionsOf(brute).burn;

    game.step(6);

    expect(readAfflictionsOf(brute).burn).toBeLessThan(fed);
});

it("marks a monster at full burn as blazing, built by the warden whose hit filled it", async () => {
    const { game, ada } = await openWithWarden(Element.Ember);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
    });

    landHit(game, { monster: brute, warden: ada, weapon: lanceWeapon });
    landHit(game, { monster: brute, warden: ada, weapon: lanceWeapon });
    landHit(game, { monster: brute, warden: ada, weapon: lanceWeapon });

    const state = readAfflictionsOf(brute);
    expect(state.burn).toBe(1);
    expect(state.mark).toBe(Mark.Blazing);
    expect(state.markBy).toBe(ada);
    //  Its glow once the mark has settled.
    game.step(markSettleSeconds);
    expect(brute.get(ElementLookTrait)?.mark).toBe(Mark.Blazing);
    expect(brute.get(ElementLookTrait)?.markHue).toBe(
        ada.get(WardenTrait)?.hue,
    );
});

it("takes a blazing mark off once it has worn off", async () => {
    const { game, ada } = await openWithWarden(Element.Ember);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e5,
    });
    landHits(game, { monster: brute, warden: ada, weapon: lanceWeapon }, 3);

    game.step(blazingSeconds + 0.1);

    expect(readAfflictionsOf(brute).mark).toBe(Mark.None);
});

it("slows a chilled monster", async () => {
    const { game, ada } = await openWithWarden(Element.Frost);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
        walks: true,
    });
    const speed = brute.get(MonsterTrait)?.speed ?? 0;

    landHit(game, { monster: brute, warden: ada });

    const chase = brute.get(ChaseTrait)?.speed ?? 0;
    expect(chase).toBeGreaterThan(0);
    expect(chase).toBeLessThan(speed);
});

it("freezes a monster at full chill: it stops and strikes nothing, and wears the frozen mark", async () => {
    const { game, ada } = await openWithWarden(Element.Frost);
    //  Right in front of her, where it would strike her.
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        z: -1,
        health: 1e4,
        walks: true,
    });
    landHits(game, { monster: husk, warden: ada, weapon: lanceWeapon }, 2);
    const strikes = husk.get(MonsterTrait)?.strikes;
    const health = ada.get(WardenTrait)?.health;

    game.step(1);

    expect(husk.has(FrozenTrait)).toBe(true);
    expect(husk.get(ChaseTrait)?.speed).toBe(0);
    expect(husk.get(MonsterTrait)?.strikes).toBe(strikes);
    expect(ada.get(WardenTrait)?.health).toBe(health);
    expect(readAfflictionsOf(husk).mark).toBe(Mark.Frozen);
    expect(husk.get(ElementLookTrait)?.frozen).toBe(true);
});

it("thaws a frozen monster after its time, a brute sooner than a husk", async () => {
    const { game, ada } = await openWithWarden(Element.Frost);
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: -4,
        health: 1e4,
    });
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 4,
        health: 1e5,
    });
    landHits(game, { monster: husk, warden: ada, weapon: lanceWeapon }, 2);
    landHits(game, { monster: brute, warden: ada, weapon: lanceWeapon }, 4);
    const { freezeSeconds } = frostLevels[0];
    const bruteSeconds = freezeSeconds * elementResistances.brute.freeze;

    game.step(bruteSeconds + 0.1);

    expect(brute.has(FrozenTrait)).toBe(false);
    expect(husk.has(FrozenTrait)).toBe(true);
    game.step(freezeSeconds - bruteSeconds);
    expect(husk.has(FrozenTrait)).toBe(false);
    expect(readAfflictionsOf(husk).mark).toBe(Mark.None);
});

it("needs more chill to freeze a brute than a husk", async () => {
    const { game, ada } = await openWithWarden(Element.Frost);
    const husk = standMonster(game.world, { kind: MonsterKind.Husk, x: -4 });
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 4,
        health: 1e5,
    });

    landHits(game, { monster: husk, warden: ada }, 2);
    landHits(game, { monster: brute, warden: ada }, 2);

    expect(husk.has(FrozenTrait)).toBe(true);
    expect(brute.has(FrozenTrait)).toBe(false);
});

it("erupts a monster at full burn for a share of its health with Meltdown, and starts its burn again", async () => {
    const { game, ada } = await openWithWarden(Element.Ember, 3);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
    });
    const beside = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 2,
        health: 1e4,
    });
    let eruptions = 0;

    for (let hit = 0; hit < 3 && eruptions === 0; hit++) {
        landHit(game, { monster: brute, warden: ada, weapon: lanceWeapon });
        eruptions += readStrikes(game.world).filter(
            ({ kind }) => kind === StrikeKind.Meltdown,
        ).length;
    }

    expect(eruptions).toBe(1);
    expect(readAfflictionsOf(brute).burn).toBe(0);
    expect(1e4 - readHealth(brute)).toBeGreaterThanOrEqual(
        1e4 * meltdown.share,
    );
    expect(1e4 - readHealth(beside)).toBeCloseTo(
        1e4 * meltdown.share * meltdown.splash,
        6,
    );
});

it("keeps a burn below the capstone at full, with no eruption", async () => {
    const { game, ada } = await openWithWarden(Element.Ember, 2);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
    });

    landHits(game, { monster: brute, warden: ada, weapon: lanceWeapon }, 3);

    expect(readAfflictionsOf(brute).burn).toBe(1);
});

it("bursts a monster frozen at Frost's capstone as it dies, and freezes its neighbors with Shatter", async () => {
    const { game, ada } = await openWithWarden(Element.Frost, 3);
    const frozen = standMonster(game.world, { kind: MonsterKind.Husk });
    const neighbor = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: 2,
        health: 1e4,
    });
    const far = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: 10,
        health: 1e4,
    });
    landHit(game, { monster: frozen, warden: ada, weapon: lanceWeapon });
    expect(frozen.has(FrozenTrait)).toBe(true);

    dealDamage(requireAuthority(game.world), frozen, {
        amount: 1e3,
        source: ada,
    });
    game.step(fixedStepSeconds);

    expect(frozen.isAlive()).toBe(false);
    expect(neighbor.has(FrozenTrait)).toBe(true);
    expect(readHealth(neighbor)).toBeLessThan(1e4);
    expect(far.has(FrozenTrait)).toBe(false);
    expect(
        readStrikes(game.world).some(({ kind }) => kind === StrikeKind.Shatter),
    ).toBe(true);
});

it("bursts nothing as a monster frozen below the capstone dies", async () => {
    const { game, ada } = await openWithWarden(Element.Frost, 2);
    const frozen = standMonster(game.world, { kind: MonsterKind.Husk });
    const neighbor = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: 2,
        health: 1e4,
    });
    landHit(game, { monster: frozen, warden: ada, weapon: lanceWeapon });

    dealDamage(requireAuthority(game.world), frozen, {
        amount: 1e3,
        source: ada,
    });
    game.step(fixedStepSeconds);

    expect(neighbor.has(FrozenTrait)).toBe(false);
    expect(neighbor.get(HealthTrait)?.current).toBe(1e4);
});

it("gives the kill of a monster its burn brings down to the warden who lit it", async () => {
    const { game, ada } = await openWithWarden(Element.Ember);
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 4,
    });
    landHit(game, { monster: husk, warden: ada, weapon: lanceWeapon });

    game.step(3);

    expect(husk.isAlive()).toBe(false);
    expect(ada.get(WardenTrait)?.kills).toBe(1);
});

it("sums a burn's ticks into one number a second, the health they took, for the warden who lit it", async () => {
    const { game, ada } = await openWithWarden(Element.Ember);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
    });
    //  Its hits take nothing, so its burn takes all it loses.
    const before = readHealth(brute);
    landHits(game, { monster: brute, warden: ada }, 12);

    const burns: Strike[] = [];
    for (let step = 0; step < 150; step++) {
        game.step(fixedStepSeconds);
        for (const strike of readStrikes(game.world))
            if (strike.kind === StrikeKind.Burn) burns.push(strike);
    }

    //  Two and a half seconds: two whole seconds shown, the half to come.
    expect(burns.length).toBe(2);
    for (const burn of burns) {
        expect(burn.by).toBe(ada);
        expect(burn.amount).toBeGreaterThan(0);
    }
    const shown = burns.reduce((sum, burn) => sum + burn.amount, 0);
    const lost = before - readHealth(brute);
    expect(shown).toBeLessThanOrEqual(lost + 1e-6);
    expect(shown).toBeGreaterThan(lost * 0.6);
});

it("shows a burn's number on the tick that brings its monster down", async () => {
    const { game, ada } = await openWithWarden(Element.Ember);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
    });
    landHits(game, { monster: brute, warden: ada }, 12);
    brute.set(HealthTrait, { current: 3 });

    const burns: Strike[] = [];
    for (let step = 0; step < 40 && brute.isAlive(); step++) {
        game.step(fixedStepSeconds);
        for (const strike of readStrikes(game.world))
            if (strike.kind === StrikeKind.Burn) burns.push(strike);
    }

    //  Its number came on the killing tick, not a second later.
    expect(brute.isAlive()).toBe(false);
    expect(burns).toHaveLength(1);
    expect(burns[0].amount).toBeGreaterThanOrEqual(3);
});
