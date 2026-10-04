// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import {
    ChaseTrait,
    dealDamage,
    requireAuthority,
    fixedStepSeconds,
    HealthTrait,
    InvulnerableTrait,
    RewindTrait,
    setRewindStep,
    teleportActor,
    TransformTrait,
} from "@spawnite/engine";
import {
    boltSpeed,
    slamRadiusMetres,
    slamWindUpSeconds,
    spitRangeMetres,
} from "../../src/siege/attacks";
import { spawnMonster } from "../../src/siege/monsters";
import {
    BoltTrait,
    EliteModifier,
    FrozenTrait,
    MercyTrait,
    MonsterKind,
    MonsterTrait,
    SiegeStateTrait,
    SlamMachine,
    SlamTrait,
    SpitMachine,
    WardenTrait,
} from "../../src/siege/traits";
import {
    firstBreatherSeconds,
    monsterSettings,
    planWave,
} from "../../src/siege/waves";
import {
    joinWarden,
    onField,
    openSiege,
    readSiege,
    takePlaces,
    type OpenedSiege,
    setPhase,
} from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Her health now. */
function readHealth(warden: Entity) {
    return warden.get(WardenTrait)?.health ?? 0;
}

/** Where a test moves a warden to at once: across the field, and along it. */
interface Move {
    warden: Entity;
    x: number;
    z?: number;
}

/** Stands a warden at a spot on the field at once. */
function moveWarden(game: OpenedSiege, { warden, x, z = 0 }: Move) {
    warden.get(TransformTrait)?.copy(onField(x, z));
    teleportActor(game.world, warden);
}

/** Metres between two entities, level with the ground. */
function measureApart(one: Entity, other: Entity) {
    const first = one.get(TransformTrait);
    const second = other.get(TransformTrait);
    if (!first || !second) throw new Error("No place.");
    return Math.hypot(first.x - second.x, first.z - second.z);
}

it("raises a colossus first on the fifth wave, with the wave's boss health", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    takePlaces(game, ada);
    ada.set(WardenTrait, { health: 1e6, maximum: 1e6 });
    game.world.queryFirst(SiegeStateTrait)?.set(SiegeStateTrait, { wave: 4 });
    setPhase(game.world, PhaseMachine.is.breather, fixedStepSeconds);
    const risen: MonsterKind[] = [];
    game.world.onAdd(MonsterTrait, (monster: Entity) => {
        const kind = monster.get(MonsterTrait)?.kind;
        if (kind) risen.push(kind);
    });

    game.step(fixedStepSeconds * 3);

    expect(readSiege(game.world).wave).toBe(5);
    expect(risen[0]).toBe(MonsterKind.Colossus);
    expect(risen.filter((kind) => kind === MonsterKind.Colossus)).toHaveLength(
        1,
    );
    const colossus = game.world
        .query(MonsterTrait)
        .find(
            (monster) =>
                monster.get(MonsterTrait)?.kind === MonsterKind.Colossus,
        );
    expect(colossus?.get(HealthTrait)?.maximum).toBe(
        Math.round(
            monsterSettings[MonsterKind.Colossus].health *
                planWave(5, 1).bossHealth,
        ),
    );
});

it("winds a colossus up before its slam, and hurts only the wardens still in its ring", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField(-1.5) });
    const bo = joinWarden(game, { name: "Bo", position: onField(1.5) });
    const colossus = spawnMonster(game.world, {
        kind: MonsterKind.Colossus,
        position: onField(0, -3),
        plan: planWave(5, 2),
    });

    game.step(0.2);
    expect(colossus.get(SlamTrait)?.winding).toBe(true);
    expect([readHealth(ada), readHealth(bo)]).toEqual([100, 100]);
    moveWarden(game, { warden: bo, x: slamRadiusMetres + 6 });
    game.step(slamWindUpSeconds);

    expect(readHealth(ada)).toBeLessThan(100);
    expect(readHealth(bo)).toBe(100);
    expect(colossus.get(SlamTrait)).toMatchObject({
        winding: false,
        slams: 1,
    });
});

/** Steps the siege one fixed step at a time, counting the room's step on
 *  the world after each, as the room does. */
function stepAsRoom(game: OpenedSiege, seconds: number) {
    for (let step = 0; step < Math.round(seconds / fixedStepSeconds); step++) {
        const at = game.world.get(RewindTrait)?.step ?? 0;
        game.step(fixedStepSeconds);
        setRewindStep(game.world, at + 1);
    }
}

it("streams the room's step a colossus began its wind-up on, set once", async () => {
    siege = await openSiege();
    const game = siege;
    joinWarden(game, { name: "Ada", position: onField() });
    const colossus = spawnMonster(game.world, {
        kind: MonsterKind.Colossus,
        position: onField(0, -3),
        plan: planWave(5, 1),
    });
    setRewindStep(game.world, 500);
    let began = -1;
    while (!colossus.get(SlamTrait)?.winding) {
        began = game.world.get(RewindTrait)?.step ?? 0;
        stepAsRoom(game, fixedStepSeconds);
    }
    let changes = 0;
    game.world.onChange(SlamTrait, () => changes++);

    stepAsRoom(game, slamWindUpSeconds / 2);

    expect(colossus.get(SlamTrait)).toMatchObject({
        winding: true,
        windUpStep: began,
    });
    expect(began).toBeGreaterThanOrEqual(500);
    expect(changes).toBe(0);
});

it("moves a frozen colossus's wind-up start on by the steps it stood frozen", async () => {
    siege = await openSiege();
    const game = siege;
    joinWarden(game, { name: "Ada", position: onField() });
    const colossus = spawnMonster(game.world, {
        kind: MonsterKind.Colossus,
        position: onField(0, -3),
        plan: planWave(5, 1),
    });
    while (!colossus.get(SlamTrait)?.winding)
        stepAsRoom(game, fixedStepSeconds);
    const began = colossus.get(SlamTrait)?.windUpStep ?? 0;

    colossus.add(FrozenTrait);
    stepAsRoom(game, 30 * fixedStepSeconds);
    colossus.remove(FrozenTrait);
    stepAsRoom(game, fixedStepSeconds);

    expect(colossus.get(SlamTrait)?.windUpStep).toBe(began + 30);
});

it("lands a slam on a warden in her breath after a blow", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    spawnMonster(game.world, {
        kind: MonsterKind.Colossus,
        position: onField(0, -3),
        plan: planWave(5, 1),
    });
    game.step(fixedStepSeconds);

    ada.add(MercyTrait({ seconds: 10 }));
    game.step(slamWindUpSeconds + 0.1);

    expect(readHealth(ada)).toBeLessThan(100);
});

it("lands no slam on an invulnerable warden", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    ada.add(InvulnerableTrait);
    spawnMonster(game.world, {
        kind: MonsterKind.Colossus,
        position: onField(0, -3),
        plan: planWave(5, 1),
    });

    game.step(fixedStepSeconds + slamWindUpSeconds + 0.1);

    expect(readHealth(ada)).toBe(100);
});

it("stops a spitter short of her and spits a bolt that hits her where she stands", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    const spitter = spawnMonster(game.world, {
        kind: MonsterKind.Spitter,
        position: onField(0, -20),
        plan: planWave(4, 1),
    });
    let bolts = 0;
    game.world.onAdd(BoltTrait, () => bolts++);

    game.step(7);

    expect(measureApart(spitter, ada)).toBeGreaterThan(spitRangeMetres - 1);
    expect(measureApart(spitter, ada)).toBeLessThan(spitRangeMetres + 1.5);
    expect(bolts).toBeGreaterThan(0);
    expect(readHealth(ada)).toBeLessThan(100);
});

it("lets a warden who steps aside escape a bolt", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    spawnMonster(game.world, {
        kind: MonsterKind.Spitter,
        position: onField(0, -spitRangeMetres),
        plan: planWave(4, 1),
    });
    let bolts = 0;
    game.world.onAdd(BoltTrait, () => bolts++);
    for (let step = 0; step < 600 && bolts === 0; step++)
        game.step(fixedStepSeconds);
    expect(bolts).toBe(1);

    moveWarden(game, { warden: ada, x: 3 });
    game.step(spitRangeMetres / boltSpeed + 0.3);

    expect(readHealth(ada)).toBe(100);
});

/** Steps until a spitter has spat its first bolt, a minute at most. */
function awaitBolt(game: OpenedSiege) {
    for (let step = 0; step < 3600; step++) {
        if (game.world.query(BoltTrait).length > 0) return;
        game.step(fixedStepSeconds);
    }
    throw new Error("No bolt.");
}

it("spares a warden a bolt in her breath after a blow", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    spawnMonster(game.world, {
        kind: MonsterKind.Spitter,
        position: onField(0, -spitRangeMetres),
        plan: planWave(4, 1),
    });
    awaitBolt(game);

    ada.add(MercyTrait({ seconds: 10 }));
    game.step(spitRangeMetres / boltSpeed + 0.3);

    expect(readHealth(ada)).toBe(100);
});

it("takes every bolt still flying away when the wave is held", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    takePlaces(game, ada);
    game.step(firstBreatherSeconds + 0.1);
    game.world
        .queryFirst(SiegeStateTrait)
        ?.set(SiegeStateTrait, { toSpawn: 0 });
    for (const monster of game.world.query(MonsterTrait)) monster.destroy();
    spawnMonster(game.world, {
        kind: MonsterKind.Spitter,
        position: onField(0, -spitRangeMetres - 3),
        plan: planWave(4, 1),
    });
    awaitBolt(game);

    for (const monster of game.world.query(MonsterTrait))
        dealDamage(requireAuthority(game.world), monster, { amount: 1e6 });
    game.step(fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
    expect(game.world.query(BoltTrait)).toHaveLength(0);
});

it("hits harder on a later wave", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    spawnMonster(game.world, {
        kind: MonsterKind.Husk,
        position: onField(0, 1),
        plan: planWave(10, 1),
    });

    game.step(fixedStepSeconds);

    const blow = 100 - readHealth(ada);
    expect(blow).toBe(
        Math.round(
            monsterSettings[MonsterKind.Husk].damage * planWave(10, 1).damage,
        ),
    );
    expect(blow).toBeGreaterThan(monsterSettings[MonsterKind.Husk].damage);
});

it("walks a swift elite faster and gives an armoured one more health", async () => {
    siege = await openSiege();
    const { world } = siege;
    const spawnHusk = (elite: EliteModifier) =>
        spawnMonster(world, {
            kind: MonsterKind.Husk,
            position: onField(0, -15),
            plan: planWave(6, 1),
            elite,
        });
    const plain = spawnHusk(EliteModifier.None);
    const swift = spawnHusk(EliteModifier.Swift);
    const armoured = spawnHusk(EliteModifier.Armoured);
    const readSpeed = (monster: Entity) => monster.get(ChaseTrait)?.speed ?? 0;
    const readMaximum = (monster: Entity) =>
        monster.get(HealthTrait)?.maximum ?? 0;

    expect(readSpeed(swift)).toBeGreaterThan(readSpeed(plain) * 1.3);
    expect(readMaximum(armoured)).toBeGreaterThan(readMaximum(plain) * 2);
    expect(swift.get(MonsterTrait)?.elite).toBe(EliteModifier.Swift);
});

it("bursts a splitting elite into two skitters when it falls", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField() });
    const splitting = spawnMonster(game.world, {
        kind: MonsterKind.Husk,
        position: onField(0, -12),
        plan: planWave(6, 1),
        elite: EliteModifier.Splitting,
    });

    dealDamage(requireAuthority(game.world), splitting, {
        amount: 1e6,
        source: ada,
    });
    game.step(fixedStepSeconds);

    const left = game.world.query(MonsterTrait);
    expect(splitting.isAlive()).toBe(false);
    expect(left.map((monster) => monster.get(MonsterTrait)?.kind)).toEqual([
        MonsterKind.Skitter,
        MonsterKind.Skitter,
    ]);
    for (const monster of left)
        expect(monster.get(MonsterTrait)?.elite).toBe(EliteModifier.None);
});

it("cools a colossus down after its slam, holds its wind-up while it is frozen, and winds up again once cool", async () => {
    siege = await openSiege();
    const game = siege;
    joinWarden(game, { name: "Ada", position: onField(-1.5) });
    const colossus = spawnMonster(game.world, {
        kind: MonsterKind.Colossus,
        position: onField(0, -3),
        plan: planWave(5, 2),
    });
    const { is } = SlamMachine;

    game.step(fixedStepSeconds);
    expect(colossus.has(is.winding)).toBe(true);
    colossus.add(FrozenTrait);
    game.step(slamWindUpSeconds * 2);
    expect(colossus.has(is.winding)).toBe(true);
    expect(colossus.get(SlamTrait)?.slams).toBe(0);

    colossus.remove(FrozenTrait);
    game.step(slamWindUpSeconds);
    expect(colossus.has(is.cooling)).toBe(true);
    expect(colossus.get(SlamTrait)?.slams).toBe(1);

    game.step(monsterSettings[MonsterKind.Colossus].cooldown);
    expect(colossus.has(is.winding)).toBe(true);
});

it("spits a spitter's first bolt a second after it rises, counting the step it rose on", async () => {
    siege = await openSiege();
    const game = siege;
    joinWarden(game, { name: "Ada", position: onField(0) });
    const spitter = spawnMonster(game.world, {
        kind: MonsterKind.Spitter,
        position: onField(0, -6),
        plan: planWave(3, 1),
    });
    expect(spitter.has(SpitMachine.is.cooling)).toBe(true);
    expect(spitter.get(SpitMachine.trait)?.waited).toBeCloseTo(
        fixedStepSeconds,
    );
});
