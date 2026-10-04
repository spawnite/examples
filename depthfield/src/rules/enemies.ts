import { createQuery, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    HealthTrait,
    random,
    readEach,
    shakeCamera,
    TransformTrait,
} from "@spawnite/engine/core";
import { enemyCap, enemyStats, EnemyKind, isBig, u } from "./data";
import { findStage, type Stage } from "./stages";
import { readThreat } from "./threat";
import {
    collide,
    measureSegmentDistance,
    placeOnGround,
    readGrid,
    readHeroPosition,
    readProps,
    readRun,
    say,
    throwSparks,
    type Placed,
} from "./field";
import { hurtHero } from "./hero";
import {
    BlastTrait,
    createEnemy,
    EnemyTrait,
    EnemyPhase,
    EnemyShotTrait,
    RunPhase,
    StompTrait,
    type EnemyState,
} from "./traits";

//  The enemies: spawned round the hero off the screen, each kind walking
//  and striking in its own way, the elites and the boss with telegraphed
//  attacks.

/** Metres from the hero a spawn lands: just past the screen's edge.
 *  ponytail: the source measured the viewport; a fixed ring keeps the
 *  simulation the same headless, and a tall phone sees spawns land. */
const spawnDistance = u(530);
/** The hero's touch reach beyond an enemy's own radius. */
const touchReach = u(16);

interface SpawnOptions {
    kind: EnemyKind;
    x: number;
    z: number;
}

/** Spawns one enemy of `kind` at a spot, its health grown by the threat;
 *  the loot runner, a reward, keeps its own. */
export function spawnEnemy(world: World, { kind, x, z }: SpawnOptions) {
    const run = readRun(world);
    const stats = enemyStats[kind];
    let health = stats.health;
    if (kind !== EnemyKind.LootRunner)
        health = Math.max(
            1,
            Math.round(health * readThreat(run, isBig(kind)).health),
        );
    const enemy: EnemyState = {
        ...createEnemy(),
        kind,
        radius: stats.radius,
        speed: stats.speed,
        shotTimer: 1.2 + random(world),
        javelinCooldown: kind === EnemyKind.CrimsonElite ? 1.1 : 1.4,
        riftCooldown: kind === EnemyKind.CrimsonElite ? 2.6 : 3.2,
        shearCooldown: kind === EnemyKind.CrimsonElite ? 2.2 : 99,
        landRadius: u(280),
        wander: random(world) * 6.28,
    };
    const position = new Vector3(x, 0, z);
    collide(world, { enemy, position });
    return world.spawn(
        EnemyTrait(enemy),
        ...placeOnGround(position),
        HealthTrait({ current: health, maximum: health }),
    );
}

/** A kind the stage's clock has let onto the field, picked by `roll`, 0
 *  to 1, by each kind's weight. */
export function pickWaveKind(stage: Stage, { time, roll }: WaveRoll) {
    let total = 0;
    for (const join of stage.joins) if (time >= join.at) total += join.weight;
    let left = roll * total;
    for (const join of stage.joins) {
        if (time < join.at) continue;
        left -= join.weight;
        if (left < 0) return join.kind;
    }
    return stage.joins[0].kind;
}

interface WaveRoll {
    time: number;
    roll: number;
}

const enemies = createQuery(EnemyTrait, TransformTrait);

function countEnemies(world: World, kind?: EnemyKind) {
    let count = 0;
    readEach(world, enemies, ([enemy]) => {
        if (kind === undefined || enemy.kind === kind) count++;
    });
    return count;
}

/** Spawns one enemy round the hero: a kind the clock allows, or now and
 *  then the loot runner, twice a run at most. At most three summoners. */
export function spawnWaveEnemy(world: World, forced?: EnemyKind) {
    const run = readRun(world);
    if (run.bossPhase || countEnemies(world) >= enemyCap) return;
    const angle = random(world) * Math.PI * 2;
    let kind = forced;
    if (kind === undefined) {
        if (run.lootSpawned < 2 && random(world) < 0.005)
            kind = EnemyKind.LootRunner;
        else
            kind = pickWaveKind(findStage(run.stage), {
                time: run.time,
                roll: random(world),
            });
    }
    if (
        kind === EnemyKind.Summoner &&
        countEnemies(world, EnemyKind.Summoner) >= 3
    )
        kind = EnemyKind.Grunt;
    if (kind === EnemyKind.LootRunner) run.lootSpawned++;
    const hero = readHeroPosition(world);
    spawnEnemy(world, {
        kind,
        x: hero.x + Math.cos(angle) * spawnDistance,
        z: hero.z + Math.sin(angle) * spawnDistance,
    });
}

/** Spawns an elite 400 units from the hero, unless one of its kind lives. */
export function spawnElite(world: World, kind: EnemyKind) {
    if (countEnemies(world, kind) > 0) return;
    const angle = random(world) * Math.PI * 2;
    const hero = readHeroPosition(world);
    spawnEnemy(world, {
        kind,
        x: hero.x + Math.cos(angle) * u(400),
        z: hero.z + Math.sin(angle) * u(400),
    });
    say(
        world,
        kind === EnemyKind.CrimsonElite
            ? "Crimson elite. Lanes, rifts, then a shear."
            : "Elite on the field. Watch the lane, then the rifts.",
    );
}

/** The boss's phase begins: the field empties as everything else runs.
 *  An endless run calls it again every third minute. */
export function beginBoss(world: World) {
    const run = readRun(world);
    run.bossPhase = true;
    run.bossLand = 1.7;
    shakeCamera(world, { strength: 1 });
    readEach(world, enemies, ([enemy]) => {
        if (enemy.kind !== EnemyKind.Boss) enemy.flee = true;
    });
    say(world, "The arena empties. Something is landing.");
}

/** The boss lands near the hero, its landing circle telegraphed. */
export function spawnBoss(world: World) {
    const angle = random(world) * Math.PI * 2;
    const distance = u(170 + random(world) * 80);
    const hero = readHeroPosition(world);
    const boss = spawnEnemy(world, {
        kind: EnemyKind.Boss,
        x: hero.x + Math.cos(angle) * distance,
        z: hero.z + Math.sin(angle) * distance,
    });
    const enemy = boss.get(EnemyTrait)!;
    enemy.phase = EnemyPhase.Land;
    enemy.phaseTimer = 1.05;
    enemy.tellSeconds = 1.05;
    shakeCamera(world, { strength: 0.7 });
}

/** Leaves a blast ring at a spot, which hurts at its end unless `fired`. */
function markBlast(
    world: World,
    { x, z, radius, life, fired = false }: BlastOptions,
) {
    world.spawn(
        BlastTrait({ radius, life, maxLife: life, fired }),
        ...placeOnGround({ x, z }),
    );
}

interface BlastOptions {
    x: number;
    z: number;
    radius: number;
    life: number;
    fired?: boolean;
}

//  Written in place, once per dash step.
const dashFrom = new Vector3();

/** One step of what an enemy is, the hero standing (dx, dz) from it at
 *  `distance` metres. */
interface Approach {
    enemy: EnemyState;
    position: Vector3;
    dx: number;
    dz: number;
    distance: number;
}

function moveBoss(world: World, step: number, approach: Approach) {
    const { enemy, position, dx, dz, distance } = approach;
    const hero = readHeroPosition(world);
    const nx = distance > u(1) ? dx / distance : 1;
    const nz = distance > u(1) ? dz / distance : 0;
    switch (enemy.phase) {
        case EnemyPhase.Land:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer > 0) return;
            if (distance < enemy.landRadius + u(16))
                hurtHero(world, { amount: 42, color: "#ff5a4a", big: true });
            markBlast(world, {
                x: position.x,
                z: position.z,
                radius: enemy.landRadius,
                life: 0.35,
                fired: true,
            });
            shakeCamera(world, { strength: 0.7 });
            enemy.phase = EnemyPhase.Walk;
            enemy.ringCooldown = 1.1;
            enemy.rushCooldown = 2.1;
            enemy.triadCooldown = 3.2;
            return;
        case EnemyPhase.RingTell:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.RingFire;
                enemy.phaseTimer = 0.78;
                enemy.ringRadius = u(40);
                enemy.struck = false;
            }
            return;
        case EnemyPhase.RingFire: {
            enemy.phaseTimer -= step;
            enemy.ringRadius =
                u(40) + (1 - Math.max(0, enemy.phaseTimer) / 0.78) * u(300);
            if (
                !enemy.struck &&
                Math.abs(distance - enemy.ringRadius) < u(46)
            ) {
                enemy.struck = true;
                hurtHero(world, { amount: 34, color: "#ff5a4a", big: true });
            }
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.Walk;
                enemy.ringCooldown = 3.5;
            }
            return;
        }
        case EnemyPhase.RushTell:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.RushDash;
                enemy.phaseTimer = 0.32;
            }
            return;
        case EnemyPhase.RushDash: {
            const length = Math.min(step, enemy.phaseTimer);
            dashFrom.copy(position);
            position.x += enemy.dashX * u(1180) * length;
            position.z += enemy.dashZ * u(1180) * length;
            collide(world, approach);
            if (
                measureSegmentDistance(hero, { from: dashFrom, to: position }) <
                enemy.radius + u(36)
            )
                hurtHero(world, { amount: 38, color: "#ff5a4a", big: true });
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.Slash;
                enemy.phaseTimer = 0.62;
                enemy.struck = false;
                enemy.sweepFrom =
                    Math.atan2(enemy.dashZ, enemy.dashX) + Math.PI / 2;
            }
            return;
        }
        case EnemyPhase.Slash: {
            enemy.phaseTimer -= step;
            enemy.sweepAngle =
                enemy.sweepFrom +
                (1 - enemy.phaseTimer / 0.62) * Math.PI * 1.25;
            enemy.tipX = position.x + Math.cos(enemy.sweepAngle) * u(230);
            enemy.tipZ = position.z + Math.sin(enemy.sweepAngle) * u(230);
            if (
                !enemy.struck &&
                Math.hypot(hero.x - enemy.tipX, hero.z - enemy.tipZ) < u(96)
            ) {
                enemy.struck = true;
                hurtHero(world, { amount: 30, color: "#ff5a4a", big: true });
            }
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.Walk;
                enemy.rushCooldown = 4.1;
            }
            return;
        }
        case EnemyPhase.Triad: {
            enemy.phaseTimer -= step;
            for (let index = 0; index < enemy.marks.length; index++) {
                const mark = enemy.marks[index];
                if (mark.done || enemy.phaseTimer > 1.2 - triadTimes[index])
                    continue;
                mark.done = true;
                markBlast(world, {
                    x: mark.x,
                    z: mark.z,
                    radius: u(132),
                    life: 0.22,
                    fired: true,
                });
                if (Math.hypot(hero.x - mark.x, hero.z - mark.z) < u(148))
                    hurtHero(world, {
                        amount: 28,
                        color: "#ff5a4a",
                        big: true,
                    });
            }
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.Walk;
                enemy.triadCooldown = 4.8;
            }
            return;
        }
    }
    enemy.ringCooldown -= step;
    enemy.rushCooldown -= step;
    enemy.triadCooldown -= step;
    if (enemy.ringCooldown <= 0) {
        enemy.phase = EnemyPhase.RingTell;
        enemy.phaseTimer = enemy.tellSeconds = 0.72;
        return;
    }
    if (enemy.rushCooldown <= 0 && distance > u(24)) {
        enemy.dashX = nx;
        enemy.dashZ = nz;
        enemy.phase = EnemyPhase.RushTell;
        enemy.phaseTimer = enemy.tellSeconds = 0.62;
        enemy.reach = u(860);
        return;
    }
    if (enemy.triadCooldown <= 0) {
        const px = -nz;
        const pz = nx;
        enemy.marks = [
            { x: hero.x, z: hero.z, done: false },
            { x: hero.x + px * u(120), z: hero.z + pz * u(120), done: false },
            { x: hero.x - px * u(120), z: hero.z - pz * u(120), done: false },
            { x: hero.x + nx * u(160), z: hero.z + nz * u(160), done: false },
        ];
        enemy.phase = EnemyPhase.Triad;
        enemy.phaseTimer = enemy.tellSeconds = 1.2;
        return;
    }
    if (distance > u(48)) {
        position.x += nx * enemy.speed * step;
        position.z += nz * enemy.speed * step;
    }
    collide(world, approach);
}

/** Seconds into the triad each of its four marks lands. */
export const triadTimes = [0.12, 0.42, 0.72, 1.02];

function moveElite(world: World, step: number, approach: Approach) {
    const { enemy, position, dx, dz, distance } = approach;
    const hero = readHeroPosition(world);
    const crimson = enemy.kind === EnemyKind.CrimsonElite;
    enemy.javelinCooldown = Math.max(0, enemy.javelinCooldown - step);
    enemy.riftCooldown = Math.max(0, enemy.riftCooldown - step);
    enemy.shearCooldown = Math.max(0, enemy.shearCooldown - step);
    const dashSpeed = crimson ? u(980) : u(820);
    const tell = crimson ? 0.7 : 0.85;
    switch (enemy.phase) {
        case EnemyPhase.JavelinTell:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.JavelinDash;
                enemy.phaseTimer = crimson ? 0.34 : 0.42;
            }
            return;
        case EnemyPhase.JavelinDash: {
            const length = Math.min(step, enemy.phaseTimer);
            dashFrom.copy(position);
            position.x += enemy.dashX * dashSpeed * length;
            position.z += enemy.dashZ * dashSpeed * length;
            collide(world, approach);
            if (
                measureSegmentDistance(hero, { from: dashFrom, to: position }) <
                enemy.radius + u(18)
            )
                hurtHero(world, {
                    big: true,
                    amount: crimson ? 26 : 22,
                    color: crimson ? "#ff8a78" : "#ffd36a",
                });
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.Walk;
                enemy.javelinCooldown = crimson ? 3.6 : 4.4;
            }
            return;
        }
        case EnemyPhase.RiftTell:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer > 0) return;
            for (const [index, mark] of enemy.marks.entries())
                markBlast(world, {
                    x: mark.x,
                    z: mark.z,
                    radius: index === 2 ? u(110) : crimson ? u(130) : u(150),
                    life: index === 2 ? 0.7 : 0.5,
                });
            enemy.phase = EnemyPhase.Walk;
            enemy.riftCooldown = crimson ? 4.8 : 5.6;
            return;
        case EnemyPhase.ShearTell:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.ShearFire;
                enemy.phaseTimer = 0.55;
                enemy.struck = false;
            }
            return;
        case EnemyPhase.ShearFire: {
            enemy.phaseTimer -= step;
            enemy.sweepAngle =
                enemy.sweepFrom + (1 - enemy.phaseTimer / 0.55) * 1.35;
            enemy.tipX = position.x + Math.cos(enemy.sweepAngle) * u(260);
            enemy.tipZ = position.z + Math.sin(enemy.sweepAngle) * u(260);
            if (
                !enemy.struck &&
                Math.hypot(hero.x - enemy.tipX, hero.z - enemy.tipZ) < u(70)
            ) {
                enemy.struck = true;
                hurtHero(world, { amount: 24, color: "#ff8a78", big: true });
            }
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.Walk;
                enemy.shearCooldown = 5.2;
            }
            return;
        }
    }
    if (enemy.javelinCooldown <= 0 && distance > u(40)) {
        enemy.dashX = dx / (distance || 1);
        enemy.dashZ = dz / (distance || 1);
        enemy.phase = EnemyPhase.JavelinTell;
        enemy.phaseTimer = enemy.tellSeconds = tell;
        enemy.reach = crimson ? u(820) : u(720);
        return;
    }
    if (crimson && enemy.shearCooldown <= 0 && distance < u(520)) {
        enemy.sweepFrom = Math.atan2(dz, dx) - 0.7;
        enemy.sweepAngle = enemy.sweepFrom;
        enemy.phase = EnemyPhase.ShearTell;
        enemy.phaseTimer = enemy.tellSeconds = 0.8;
        return;
    }
    if (enemy.riftCooldown <= 0) {
        const nx = distance > u(1) ? dx / distance : 1;
        const nz = distance > u(1) ? dz / distance : 0;
        enemy.marks = [
            { x: hero.x, z: hero.z, done: false },
            { x: hero.x + nx * u(210), z: hero.z + nz * u(210), done: false },
        ];
        if (crimson)
            enemy.marks.push({
                x: hero.x - nz * u(160),
                z: hero.z + nx * u(160),
                done: false,
            });
        enemy.phase = EnemyPhase.RiftTell;
        enemy.phaseTimer = enemy.tellSeconds = crimson ? 0.8 : 0.95;
        return;
    }
    if (distance > u(1)) {
        position.x += (dx / distance) * enemy.speed * step;
        position.z += (dz / distance) * enemy.speed * step;
    }
    collide(world, approach);
}

//  Written in place, once per tank's dash step.
const dashTo = new Vector3();

function moveTank(world: World, step: number, approach: Approach) {
    const { enemy, position, dx, dz, distance } = approach;
    enemy.dashCooldown -= step;
    if (
        enemy.phase === EnemyPhase.Walk &&
        enemy.dashCooldown <= 0 &&
        distance < u(460) &&
        distance > u(1)
    ) {
        enemy.phase = EnemyPhase.Charge;
        enemy.phaseTimer = 1;
        enemy.dashX = dx / distance;
        enemy.dashZ = dz / distance;
    }
    switch (enemy.phase) {
        case EnemyPhase.StompCharge:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer > 0) return true;
            world.spawn(StompTrait(), ...placeOnGround(position));
            if (distance < u(176))
                hurtHero(world, { amount: 12, color: "#ffb080" });
            enemy.phase = EnemyPhase.Recover;
            enemy.phaseTimer = 0.8;
            return true;
        case EnemyPhase.Charge:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.Dash;
                enemy.phaseTimer = 0.7;
            }
            return true;
        case EnemyPhase.Recover:
            enemy.phaseTimer -= step;
            if (enemy.phaseTimer <= 0) {
                enemy.phase = EnemyPhase.Walk;
                enemy.dashCooldown = 3;
            }
            return true;
        case EnemyPhase.Dash: {
            const length = Math.min(step, enemy.phaseTimer);
            dashTo.set(
                position.x + enemy.dashX * u(560) * length,
                0,
                position.z + enemy.dashZ * u(560) * length,
            );
            position.copy(dashTo);
            collide(world, approach);
            enemy.phaseTimer -= step;
            //  A wall or a prop in the way ends the dash where it stopped.
            if (enemy.phaseTimer <= 0 || position.distanceTo(dashTo) > u(0.1)) {
                enemy.phase = EnemyPhase.StompCharge;
                enemy.phaseTimer = 0.65;
                enemy.tellSeconds = 0.65;
            }
            return true;
        }
    }
    return false;
}

function moveLootRunner(world: World, step: number, approach: Approach) {
    const { enemy, position, dx, dz, distance } = approach;
    enemy.wanderTimer -= step;
    if (enemy.wanderTimer <= 0) {
        enemy.wander += (random(world) - 0.5) * 2.6;
        enemy.wanderTimer = 0.28 + random(world) * 0.75;
    }
    let ax = Math.cos(enemy.wander);
    let az = Math.sin(enemy.wander);
    const edge = u(1050 - 160);
    if (position.x > edge) ax -= 1.6;
    if (position.x < -edge) ax += 1.6;
    if (position.z > edge) az -= 1.6;
    if (position.z < -edge) az += 1.6;
    if (distance < u(150) && distance > u(1)) {
        ax -= (dx / distance) * 0.55;
        az -= (dz / distance) * 0.55;
    }
    const length = Math.hypot(ax, az) || 1;
    dashFrom.copy(position);
    position.x += (ax / length) * enemy.speed * step;
    position.z += (az / length) * enemy.speed * step;
    collide(world, approach);
    //  Stuck on a wall or a prop: turn somewhere new.
    if (position.distanceTo(dashFrom) < enemy.speed * step * 0.3) {
        enemy.wander = random(world) * Math.PI * 2;
        enemy.wanderTimer = 0.15;
    }
}

const approach: Approach = {
    enemy: createEnemy(),
    position: new Vector3(),
    dx: 0,
    dz: 0,
    distance: 0,
};

function moveEnemy(world: World, step: number, placed: Placed) {
    const { enemy, position, entity } = placed;
    const hero = readHeroPosition(world);
    const dx = hero.x - position.x;
    const dz = hero.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (enemy.flee) {
        const away = distance || 1;
        position.x -= (dx / away) * u(340) * step;
        position.z -= (dz / away) * u(340) * step;
        if (away > u(980)) entity.destroy();
        return;
    }
    approach.enemy = enemy;
    approach.position = position;
    approach.dx = dx;
    approach.dz = dz;
    approach.distance = distance;
    switch (enemy.kind) {
        case EnemyKind.LootRunner:
            return moveLootRunner(world, step, approach);
        case EnemyKind.Boss:
            return moveBoss(world, step, approach);
        case EnemyKind.Elite:
        case EnemyKind.CrimsonElite:
            return moveElite(world, step, approach);
        case EnemyKind.Tank:
            if (moveTank(world, step, approach)) return;
    }
    if (distance > u(1)) {
        const direction =
            enemy.kind === EnemyKind.Summoner
                ? distance < u(360)
                    ? -1
                    : 0
                : enemy.kind === EnemyKind.Shooter
                  ? distance > u(300)
                      ? 1
                      : distance < u(180)
                        ? -1
                        : 0
                  : 1;
        position.x += (dx / distance) * enemy.speed * step * direction;
        position.z += (dz / distance) * enemy.speed * step * direction;
    }
    collide(world, approach);
}

/** The phases in which an enemy's body does not hurt on touch: a dash's
 *  own strike does, and a telegraph stands still. */
const harmlessPhases = new Set([
    EnemyPhase.JavelinDash,
    EnemyPhase.JavelinTell,
    EnemyPhase.RiftTell,
    EnemyPhase.ShearTell,
    EnemyPhase.Land,
    EnemyPhase.RingTell,
    EnemyPhase.RushTell,
    EnemyPhase.Slash,
    EnemyPhase.Triad,
]);

//  Written in place, once per enemy.
const stepFrom = new Vector3();

/** Walks each enemy, fires each shooter, summons from each summoner, and
 *  hurts the hero with each body that touches her. */
export function moveEnemies(world: World, { deltaSeconds }: StepSeconds) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    const grid = readGrid(world);
    grid.rebuild(world);
    for (const placed of grid.all) {
        const { enemy, position, entity } = placed;
        if (enemy.dying || !entity.isAlive()) continue;
        stepFrom.copy(position);
        moveEnemy(world, deltaSeconds, placed);
        if (readRun(world).phase !== RunPhase.Playing) return;
        if (!entity.isAlive() || enemy.flee) continue;
        const hero = readHeroPosition(world);
        const dx = hero.x - position.x;
        const dz = hero.z - position.z;
        const distance = Math.hypot(dx, dz);
        if (enemy.kind === EnemyKind.Shooter) {
            enemy.shotTimer -= deltaSeconds;
            if (enemy.shotTimer <= 0 && distance < u(650) && distance > u(1)) {
                enemy.shotTimer = 2.6;
                world.spawn(
                    EnemyShotTrait({
                        vx: (dx / distance) * u(125),
                        vz: (dz / distance) * u(125),
                        life: 6,
                    }),
                    ...placeOnGround(position),
                );
            }
        }
        if (enemy.kind === EnemyKind.Summoner && enemy.summonsMade < 3) {
            enemy.summonTimer -= deltaSeconds;
            if (enemy.summonTimer <= 0) {
                enemy.summonTimer += 5;
                if (grid.all.length < enemyCap) {
                    const angle = random(world) * Math.PI * 2;
                    const x = position.x + Math.cos(angle) * u(65);
                    const z = position.z + Math.sin(angle) * u(65);
                    spawnEnemy(world, { kind: EnemyKind.Shooter, x, z });
                    enemy.summonsMade++;
                    throwSparks(world, { x, z, color: "#6fe2d4", count: 14 });
                }
            }
        }
        enemy.hit = Math.max(0, enemy.hit - deltaSeconds);
        if (
            enemy.kind !== EnemyKind.LootRunner &&
            !harmlessPhases.has(enemy.phase) &&
            measureSegmentDistance(hero, { from: stepFrom, to: position }) <
                enemy.radius + touchReach
        ) {
            hurtHero(world, {
                amount: enemy.kind === EnemyKind.Boss ? 22 : 12,
                big: isBig(enemy.kind),
                color: enemy.kind === EnemyKind.Boss ? "#ff5a4a" : "#ed8c7e",
            });
            if (readRun(world).phase !== RunPhase.Playing) return;
        }
    }
}

/** The step's length, as the engine hands it to a system. */
export interface StepSeconds {
    deltaSeconds: number;
}

/** Flies each shooter's orb: a prop stops it, the hero takes 10. */
export function flyEnemyShots(world: World, { deltaSeconds }: StepSeconds) {
    if (readRun(world).phase !== RunPhase.Playing) return;
    const hero = readHeroPosition(world);
    readEach(world, flyingShots, ([shot, position], entity) => {
        stepFrom.copy(position);
        position.x += shot.vx * deltaSeconds;
        position.z += shot.vz * deltaSeconds;
        shot.life -= deltaSeconds;
        const blocked = readProps(world).some(
            (prop) =>
                measureSegmentDistance(prop, {
                    from: stepFrom,
                    to: position,
                }) <
                prop.radius + u(7),
        );
        if (blocked) shot.life = 0;
        else if (
            measureSegmentDistance(hero, { from: stepFrom, to: position }) <
            u(23)
        ) {
            shot.life = 0;
            hurtHero(world, { amount: 10, color: "#d8a4ff" });
        }
        if (shot.life <= 0) spent.push(entity);
    });
    destroySpent();
}

const flyingShots = createQuery(EnemyShotTrait, TransformTrait);

//  The entities a walk found spent, destroyed once the walk ends.
const spent: Entity[] = [];

function destroySpent() {
    for (const entity of spent) entity.destroy();
    spent.length = 0;
}
const blasts = createQuery(BlastTrait, TransformTrait);
const stomps = createQuery(StompTrait);

/** Fades each blast ring and stomp, and lands each blast on its last
 *  moment: 20 to the hero inside it. */
export function landBlasts(world: World, { deltaSeconds }: StepSeconds) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    const hero = readHeroPosition(world);
    readEach(world, blasts, ([blast, position], entity) => {
        blast.life -= deltaSeconds;
        if (blast.life <= 0 && !blast.fired) {
            blast.fired = true;
            if (
                Math.hypot(hero.x - position.x, hero.z - position.z) <
                blast.radius + u(16)
            )
                hurtHero(world, { amount: 20, color: "#ffd36a", big: true });
        }
        if (blast.life <= -0.02) spent.push(entity);
    });
    readEach(world, stomps, ([stomp], entity) => {
        stomp.life -= deltaSeconds;
        if (stomp.life <= 0) spent.push(entity);
    });
    destroySpent();
}
