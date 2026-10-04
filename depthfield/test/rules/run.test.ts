// @vitest-environment node
import { Vector2, Vector3 } from "three";
import { expect } from "vitest";
import {
    dumpState,
    HealthTrait,
    InvulnerableTrait,
    placePlayer,
    sendInput,
    stepSeconds,
    TransformTrait,
    type HeadlessGame,
} from "@spawnite/engine/core";
import { ClassId, EnemyKind, LookId, u, WeaponId } from "../../src/rules/data";
import { spawnEnemy } from "../../src/rules/enemies";
import { readRun } from "../../src/rules/field";
import { StageId } from "../../src/rules/stages";
import { beginEndless, startRun } from "../../src/rules/run";
import {
    EnemyTrait,
    GemTrait,
    OfferKind,
    RunTrait,
    RunPhase,
    Shooter,
    ShotsTrait,
    type Shot,
} from "../../src/rules/traits";
import { pickCard } from "../../src/rules/upgrades";
import { plugins } from "../../src/game";
import { it, type CreateGame } from "@spawnite/engine/testing";

//  The run's rules on a headless world: the engine's step with the field's
//  plugin, a hero, and a run started as the lobby's Play starts one.

async function startField(
    createGame: CreateGame,
    { seed = 1, invulnerable = true } = {},
) {
    const game = await createGame({
        scene: (world) => void world.spawn(RunTrait),
        plugins,
        seed,
    });
    const hero = placePlayer(game, new Vector3(0, 0, 0));
    if (invulnerable) hero.add(InvulnerableTrait);
    startRun(game.world, {
        nickname: "Tester",
        look: LookId.Grove,
        starter: WeaponId.Pulse,
        classId: ClassId.Soldier,
        stage: StageId.Grid,
        zapUnlocked: false,
    });
    return { game, hero, run: readRun(game.world) };
}

function countKinds(game: HeadlessGame) {
    const kinds = new Set<EnemyKind>();
    for (const entity of game.world.query(EnemyTrait))
        kinds.add(entity.get(EnemyTrait)!.kind);
    return kinds;
}

it("fills the soldier's health to the class's and walks at its speed", async ({
    createGame,
}) => {
    const { game, hero, run } = await startField(createGame);
    stepSeconds(game, 0.1);
    expect(hero.get(HealthTrait)).toEqual({ current: 100, maximum: 100 });
    expect(run.speed).toBe(210);
});

it("spawns grunts alone until the runners join at thirty seconds", async ({
    createGame,
}) => {
    const { game, run } = await startField(createGame);
    //  No level-up holds the clock: the orbs stay out of reach.
    stepSeconds(game, 29);
    expect(run.time).toBeGreaterThan(28.9);
    expect([...countKinds(game)]).toEqual([EnemyKind.Grunt]);
    stepSeconds(game, 20);
    expect(countKinds(game).has(EnemyKind.Runner)).toBe(true);
});

it("shoots an enemy beside the hero dead, counts it and leaves its orb", async ({
    createGame,
}) => {
    const { game, run } = await startField(createGame);
    run.spawning = false;
    spawnEnemy(game.world, { kind: EnemyKind.Grunt, x: u(200), z: 0 });
    stepSeconds(game, 2);
    expect(run.kills).toBe(1);
    expect(run.weaponDamage.pulse).toBeGreaterThan(0);
    expect(game.world.query(GemTrait).length).toBe(1);
});

it("tells the view each shot: the weapon, who fired it and where at", async ({
    createGame,
}) => {
    const { game, run } = await startField(createGame);
    run.spawning = false;
    spawnEnemy(game.world, { kind: EnemyKind.Grunt, x: u(200), z: 0 });
    const heard: Shot[] = [];
    for (let step = 0; step < 60 && !heard.length; step++) {
        stepSeconds(game, 1 / 60);
        for (const entity of game.world.query(ShotsTrait))
            heard.push(...(entity.get(ShotsTrait)?.list ?? []));
    }
    expect(heard[0]).toMatchObject({
        weapon: WeaponId.Pulse,
        owner: Shooter.Hero,
        toZ: 0,
    });
    expect(heard[0].toX).toBeCloseTo(u(200), 0);
});

it("deals four weapon cards at level two, and a pick plays on", async ({
    createGame,
}) => {
    const { game, run } = await startField(createGame);
    run.spawning = false;
    run.xp = run.nextXp;
    stepSeconds(game, 1 / 60);
    expect(run.phase).toBe(RunPhase.Upgrade);
    expect(run.level).toBe(2);
    expect(run.offer?.kind).toBe(OfferKind.Weapon);
    expect(run.offer?.cards).toHaveLength(4);
    pickCard(game.world, 0);
    expect(run.phase).toBe(RunPhase.Playing);
    expect(run.offer).toBeNull();
});

it("offers two new weapons at level three, and the pick joins the loadout", async ({
    createGame,
}) => {
    const { game, run } = await startField(createGame);
    run.spawning = false;
    run.level = 2;
    run.xp = run.nextXp;
    stepSeconds(game, 1 / 60);
    expect(run.offer?.kind).toBe(OfferKind.Loadout);
    const cards = run.offer!.cards.filter((card) =>
        card.id.startsWith("unlock-"),
    );
    expect(cards).toHaveLength(2);
    const added = cards[0].id.replace("unlock-", "") as WeaponId;
    pickCard(game.world, 0);
    expect(run.loadout).toEqual([WeaponId.Pulse, added]);
    expect(run.weapons[added].owned).toBe(true);
});

it("dashes 180 units the way the hero faces, then waits four seconds", async ({
    createGame,
}) => {
    const { game, hero, run } = await startField(createGame);
    run.spawning = false;
    sendInput(game, { intent: new Vector2(1, 0), steering: true });
    stepSeconds(game, 0.2);
    sendInput(game, { intent: new Vector2(0, 0), steering: false });
    stepSeconds(game, 0.1);
    const before = hero.get(TransformTrait)!.x;
    sendInput(game, { jump: true });
    stepSeconds(game, 0.3);
    expect(hero.get(TransformTrait)!.x - before).toBeCloseTo(u(180), 0);
    expect(run.dashCooldown).toBeGreaterThan(3.5);
});

it("empties the field at three minutes and lands the boss", async ({
    createGame,
}) => {
    const { game, run } = await startField(createGame);
    run.spawning = false;
    spawnEnemy(game.world, { kind: EnemyKind.Grunt, x: u(600), z: 0 });
    run.time = 179.9;
    stepSeconds(game, 0.2);
    expect(run.bossPhase).toBe(true);
    expect(game.world.query(EnemyTrait)[0].get(EnemyTrait)!.flee).toBe(true);
    stepSeconds(game, 1.8);
    expect(countKinds(game).has(EnemyKind.Boss)).toBe(true);
});

/** Lands the boss at three minutes and kills it, to the victory screen. */
function beatBoss(game: HeadlessGame) {
    const run = readRun(game.world);
    run.time = 179.9;
    stepSeconds(game, 2);
    const boss = game.world
        .query(EnemyTrait)
        .find((entity) => entity.get(EnemyTrait)!.kind === EnemyKind.Boss)!;
    boss.set(HealthTrait, { current: 1 });
    stepSeconds(game, 3);
}

it("keeps going after the boss: the same field plays on, endless", async ({
    createGame,
}) => {
    const { game, run } = await startField(createGame);
    beatBoss(game);
    expect(run.phase).toBe(RunPhase.Complete);
    beginEndless(game.world);
    expect(run.phase).toBe(RunPhase.Playing);
    expect(run.endless).toBe(true);
    stepSeconds(game, 2);
    expect(run.time).toBeGreaterThan(183);
    expect(run.bossPhase).toBe(false);
    expect(countKinds(game).has(EnemyKind.Boss)).toBe(false);
    expect(game.world.query(EnemyTrait).length).toBeGreaterThan(0);
});

it("ends an endless run as won when the hero falls", async ({ createGame }) => {
    const { game, hero, run } = await startField(createGame);
    beatBoss(game);
    beginEndless(game.world);
    run.spawning = false;
    hero.remove(InvulnerableTrait);
    hero.set(HealthTrait, { current: 5 });
    spawnEnemy(game.world, { kind: EnemyKind.Grunt, x: u(10), z: 0 });
    stepSeconds(game, 0.1);
    expect(run.phase).toBe(RunPhase.Dying);
    stepSeconds(game, 2);
    expect(run.phase).toBe(RunPhase.Complete);
});

it("falls at zero health and shows the death screen after the fall", async ({
    createGame,
}) => {
    const { game, hero, run } = await startField(createGame, {
        invulnerable: false,
    });
    run.spawning = false;
    stepSeconds(game, 0.1);
    hero.set(HealthTrait, { current: 5 });
    spawnEnemy(game.world, { kind: EnemyKind.Grunt, x: u(10), z: 0 });
    stepSeconds(game, 0.1);
    expect(run.phase).toBe(RunPhase.Dying);
    stepSeconds(game, 2);
    expect(run.phase).toBe(RunPhase.Defeated);
});

it("runs the same seed to the same field", async ({ createGame }) => {
    const play = async (seed: number) => {
        const { game } = await startField(createGame, { seed });
        stepSeconds(game, 20);
        return dumpState(game.world).hash;
    };
    expect(await play(3)).toBe(await play(3));
});
