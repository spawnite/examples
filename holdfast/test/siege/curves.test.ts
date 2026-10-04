// @vitest-environment node
import { createWorld, type Entity, type World } from "koota";
import { afterEach, expect, it } from "vitest";
import {
    addStatModifier,
    readWeaponNumber,
    WeaponNumber,
} from "@spawnite/engine";
import { blasterSettings } from "../../src/siege/blaster";
import { cards, CardId } from "../../src/siege/cards";
import { declareWardenStats } from "../../src/siege/stats";
import { EliteModifier, MonsterKind } from "../../src/siege/traits";
import {
    drawElite,
    drawMonsterKind,
    monsterSettings,
    planWave,
} from "../../src/siege/waves";

let world: World | undefined;

afterEach(() => {
    world?.destroy();
    world = undefined;
});

/** The cards a warden holds on average entering wave `wave`: one taken
 *  after each wave held, each card of the deck as likely as another, so a
 *  share of each card's modifiers. The Lance changes the lance, not
 *  the blaster, so it is left out. */
function holdAveragePicks(warden: Entity, wave: number) {
    const deck = Object.values(CardId).filter((id) => id !== CardId.StormLance);
    const share = (wave - 1) / Object.values(CardId).length;
    for (const id of deck)
        for (const { stat, modifier } of cards[id].modifiers)
            addStatModifier(warden, stat, {
                source: `average:${id}`,
                flat: (modifier.flat ?? 0) * share,
                percent: (modifier.percent ?? 0) * share,
                more: (1 + (modifier.more ?? 0)) ** share - 1,
            });
}

/** Blaster hits a husk of wave `wave` takes from a warden on average
 *  picks. */
function countHuskHits(wave: number) {
    world = createWorld();
    const warden = world.spawn();
    declareWardenStats(warden);
    holdAveragePicks(warden, wave);
    const damage = readWeaponNumber(
        blasterSettings,
        warden,
        WeaponNumber.Damage,
    );
    const health = Math.round(
        monsterSettings[MonsterKind.Husk].health * planWave(wave, 1).health,
    );
    world.destroy();
    world = undefined;
    return Math.ceil(health / damage);
}

it("keeps a husk at two to four blaster hits through wave 10 on average picks", () => {
    for (let wave = 1; wave <= 10; wave++) {
        const hits = countHuskHits(wave);
        expect(hits, `wave ${wave}`).toBeGreaterThanOrEqual(2);
        expect(hits, `wave ${wave}`).toBeLessThanOrEqual(4);
    }
});

it("raises health a tenth a wave past wave 10, faster than before it", () => {
    const early = planWave(10, 1).health / planWave(9, 1).health;
    const late = planWave(12, 1).health / planWave(11, 1).health;

    expect(late).toBeCloseTo(1.1, 5);
    expect(late).toBeGreaterThan(early);
});

it("makes every wave hit harder than the one before", () => {
    for (let wave = 1; wave < 20; wave++)
        expect(planWave(wave + 1, 1).damage).toBeGreaterThan(
            planWave(wave, 1).damage,
        );
});

it("sends a colossus on every fifth wave and on no other", () => {
    for (let wave = 1; wave <= 20; wave++)
        expect(planWave(wave, 1).bosses, `wave ${wave}`).toBe(
            wave % 5 === 0 ? 1 : 0,
        );
});

it("gives the colossus more health for each warden, and the rest the same", () => {
    const one = planWave(5, 1);
    const two = planWave(5, 2);

    expect(two.bossHealth).toBeGreaterThan(one.bossHealth * 1.5);
    expect(two.health).toBe(one.health);
});

it("sends a spitter from wave 4 and never draws a colossus", () => {
    const seeded = { seed: 3 };
    const kindsBy = (wave: number) => {
        const drawn = new Set<MonsterKind>();
        for (let draw = 0; draw < 500; draw++)
            drawn.add(drawMonsterKind(seeded, wave));
        return drawn;
    };

    expect(kindsBy(3).has(MonsterKind.Spitter)).toBe(false);
    expect(kindsBy(4).has(MonsterKind.Spitter)).toBe(true);
    expect(kindsBy(20).has(MonsterKind.Colossus)).toBe(false);
});

it("makes no elite before wave 6, and some of each kind from it", () => {
    const seeded = { seed: 5 };
    const elitesBy = (wave: number) => {
        const drawn: EliteModifier[] = [];
        for (let draw = 0; draw < 500; draw++)
            drawn.push(drawElite(seeded, wave));
        return drawn;
    };

    expect(elitesBy(5).every((elite) => elite === EliteModifier.None)).toBe(
        true,
    );
    const sixth = elitesBy(6);
    for (const elite of [
        EliteModifier.Swift,
        EliteModifier.Armoured,
        EliteModifier.Splitting,
    ])
        expect(sixth).toContain(elite);
    const share =
        sixth.filter((elite) => elite !== EliteModifier.None).length /
        sixth.length;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.25);
});
