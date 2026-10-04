// @vitest-environment node
import { Vector3 } from "three";
import { expect } from "vitest";
import {
    HealthTrait,
    InvulnerableTrait,
    placePlayer,
    stepSeconds,
    TransformTrait,
    type HeadlessGame,
} from "@spawnite/engine/core";
import {
    boundary,
    ClassId,
    EnemyKind,
    LookId,
    WeaponId,
} from "../../src/rules/data";
import { spawnEnemy } from "../../src/rules/enemies";
import { readRun } from "../../src/rules/field";
import {
    HazardPhase,
    hazardStartSeconds,
    readBeam,
    readVent,
} from "../../src/rules/hazards";
import { readEarnedStage, startRun } from "../../src/rules/run";
import { findStage, HazardKind, StageId } from "../../src/rules/stages";
import { EnemyTrait, RunTrait } from "../../src/rules/traits";
import { plugins } from "../../src/game";
import { it, type CreateGame } from "@spawnite/engine/testing";

//  The three stages on a headless world: each run starts on its stage, with
//  its props, its hazard and its mix of enemies, and the stages unlock one
//  after another.

interface StageStart {
    stage: StageId;
    invulnerable?: boolean;
    /** Where the hero stands; the centre unless named. */
    at?: Vector3;
}

async function startStage(
    createGame: CreateGame,
    { stage, invulnerable = true, at = new Vector3() }: StageStart,
) {
    const game = await createGame({
        scene: (world) => void world.spawn(RunTrait),
        plugins,
        seed: 1,
    });
    const hero = placePlayer(game, at);
    if (invulnerable) hero.add(InvulnerableTrait);
    startRun(game.world, {
        nickname: "Tester",
        look: LookId.Grove,
        starter: WeaponId.Pulse,
        classId: ClassId.Soldier,
        stage,
        zapUnlocked: false,
    });
    const run = readRun(game.world);
    //  The hero fires nothing, so the field's enemies stay as they spawn.
    run.weapons.pulse.owned = false;
    stepSeconds(game, 0.1);
    return { game, hero, run };
}

function readVents() {
    const hazard = findStage(StageId.Foundry).hazard;
    if (hazard.kind !== HazardKind.Vents) throw new Error("No vents");
    return hazard;
}

function readBeamHazard() {
    const hazard = findStage(StageId.Vault).hazard;
    if (hazard.kind !== HazardKind.Beam) throw new Error("No beam");
    return hazard;
}

function readKinds(game: HeadlessGame) {
    const kinds = new Set<EnemyKind>();
    for (const entity of game.world.query(EnemyTrait))
        kinds.add(entity.get(EnemyTrait)!.kind);
    return kinds;
}

/** Steps until `holds`, a step at a time, for at most `seconds`. */
function stepUntil(game: HeadlessGame, holds: () => boolean, seconds = 20) {
    for (let step = 0; step < seconds * 60 && !holds(); step++)
        stepSeconds(game, 1 / 60);
    expect(holds()).toBe(true);
}

it("starts a run on the picked stage, and its enemies push round that stage's props", async ({
    createGame,
}) => {
    const { game, run } = await startStage(createGame, {
        stage: StageId.Foundry,
    });
    expect(run.stage).toBe(StageId.Foundry);
    const [prop] = findStage(StageId.Foundry).props;
    expect(findStage(StageId.Foundry).props).not.toEqual(
        findStage(StageId.Grid).props,
    );
    run.spawning = false;
    const enemy = spawnEnemy(game.world, {
        kind: EnemyKind.Grunt,
        x: prop.x,
        z: prop.z,
    });
    const { x, z } = enemy.get(TransformTrait)!;
    expect(Math.hypot(x - prop.x, z - prop.z)).toBeGreaterThanOrEqual(
        prop.radius,
    );
});

it("starts the Neon Grid with no hazard", async ({ createGame }) => {
    const { run } = await startStage(createGame, { stage: StageId.Grid });
    expect(run.stage).toBe(StageId.Grid);
    expect(findStage(StageId.Grid).hazard.kind).toBe(HazardKind.None);
});

it("glows a vent before it erupts, then hurts the hero standing in it", async ({
    createGame,
}) => {
    const hazard = readVents();
    const [vent] = hazard.vents;
    const { game, hero, run } = await startStage(createGame, {
        stage: StageId.Foundry,
        invulnerable: false,
        at: new Vector3(vent.x, 0, vent.z),
    });
    run.spawning = false;
    stepUntil(
        game,
        () =>
            readVent(run, 0).phase === HazardPhase.Tell &&
            readVent(run, 0).seconds > hazard.tellSeconds - 0.05,
        hazardStartSeconds + hazard.cycleSeconds,
    );
    expect(hero.get(HealthTrait)!.current).toBe(100);
    stepUntil(game, () => readVent(run, 0).phase === HazardPhase.Strike);
    stepSeconds(game, 1 / 60);
    expect(hero.get(HealthTrait)!.current).toBeLessThan(100);
});

it("leaves the hero standing clear of every vent unhurt through a whole cycle", async ({
    createGame,
}) => {
    const { game, hero, run } = await startStage(createGame, {
        stage: StageId.Foundry,
        invulnerable: false,
    });
    run.spawning = false;
    const hazard = readVents();
    //  The centre stands clear of every vent.
    for (const vent of hazard.vents)
        expect(Math.hypot(vent.x, vent.z)).toBeGreaterThan(hazard.radius * 2);
    stepSeconds(game, hazardStartSeconds + hazard.cycleSeconds * 2);
    expect(hero.get(HealthTrait)!.current).toBe(100);
});

it("draws the beam's line before it sweeps, then hurts the hero it crosses and not before", async ({
    createGame,
}) => {
    const { game, hero, run } = await startStage(createGame, {
        stage: StageId.Vault,
        invulnerable: false,
    });
    run.spawning = false;
    const hazard = readBeamHazard();
    stepUntil(
        game,
        () => readBeam(run).phase === HazardPhase.Tell,
        hazardStartSeconds + hazard.cycleSeconds,
    );
    const start = readBeam(run).at;
    expect(Math.abs(start)).toBeGreaterThan(0);
    expect(Math.abs(start)).toBeLessThanOrEqual(boundary);
    stepUntil(game, () => readBeam(run).phase === HazardPhase.Strike);
    //  Still short of the hero, at the centre.
    stepUntil(game, () => Math.abs(readBeam(run).at) < Math.abs(start) / 2);
    expect(hero.get(HealthTrait)!.current).toBe(100);
    //  Past the hero.
    stepUntil(game, () => Math.sign(readBeam(run).at) === -Math.sign(start));
    expect(hero.get(HealthTrait)!.current).toBeLessThan(100);
});

it("burns the enemies a vent's eruption catches", async ({ createGame }) => {
    //  The hero stands in a far corner, out of the tank's reach.
    const corner = boundary - 2;
    const { game, run } = await startStage(createGame, {
        stage: StageId.Foundry,
        at: new Vector3(corner, 0, corner),
    });
    run.spawning = false;
    const [vent] = readVents().vents;
    const enemy = spawnEnemy(game.world, {
        kind: EnemyKind.Tank,
        x: vent.x,
        z: vent.z,
    });
    //  It stands still: no hero to walk to within its reach.
    enemy.get(EnemyTrait)!.speed = 0;
    const full = enemy.get(HealthTrait)!.current;
    stepUntil(
        game,
        () => readVent(run, 0).phase === HazardPhase.Strike,
        hazardStartSeconds + 8,
    );
    stepSeconds(game, 1 / 60);
    expect(enemy.get(HealthTrait)!.current).toBeLessThan(full);
});

it("lets tanks onto the Ember Foundry by twenty-five seconds, before the Neon Grid's minute", async ({
    createGame,
}) => {
    const { game } = await startStage(createGame, { stage: StageId.Foundry });
    stepSeconds(game, 15);
    expect(readKinds(game).has(EnemyKind.Tank)).toBe(false);
    stepSeconds(game, 13);
    expect(readKinds(game).has(EnemyKind.Tank)).toBe(true);
    expect(readKinds(game).has(EnemyKind.Shooter)).toBe(false);
});

it("lets runners onto the Prism Vault by fifteen seconds", async ({
    createGame,
}) => {
    const { game } = await startStage(createGame, { stage: StageId.Vault });
    stepSeconds(game, 8);
    expect([...readKinds(game)]).toEqual([EnemyKind.Grunt]);
    stepSeconds(game, 8);
    expect(readKinds(game).has(EnemyKind.Runner)).toBe(true);
});

it("earns the Ember Foundry when a Neon Grid run reaches the boss", async ({
    createGame,
}) => {
    const { game, run } = await startStage(createGame, {
        stage: StageId.Grid,
    });
    run.spawning = false;
    run.time = 179;
    expect(readEarnedStage(run)).toBeNull();
    stepSeconds(game, 1.2);
    expect(readEarnedStage(run)).toBe(StageId.Foundry);
});

it("earns the Prism Vault when the boss falls on the Ember Foundry, and not before", async ({
    createGame,
}) => {
    const { game, run } = await startStage(createGame, {
        stage: StageId.Foundry,
    });
    run.spawning = false;
    run.time = 179.9;
    stepSeconds(game, 2);
    expect(run.bossPhase).toBe(true);
    expect(readEarnedStage(run)).toBeNull();
    const boss = game.world
        .query(EnemyTrait)
        .find((entity) => entity.get(EnemyTrait)!.kind === EnemyKind.Boss)!;
    boss.set(HealthTrait, { current: 1 });
    run.weapons.pulse.owned = true;
    stepUntil(game, () => readEarnedStage(run) === StageId.Vault, 3);
});
