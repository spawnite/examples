import { createQuery, type World } from "koota";
import {
    findPlayerHero,
    playClip,
    random,
    readEach,
    shakeCamera,
    TransformTrait,
} from "@spawnite/engine/core";
import { bossAtSeconds, EnemyKind, findClass, u, weaponIds } from "./data";
import { beginBoss, spawnBoss, spawnElite, spawnWaveEnemy } from "./enemies";
import type { StepSeconds } from "./enemies";
import { playCue, readHeroPosition, readRun, say, throwSparks } from "./field";
import { findStage, StageId, UnlockMoment, type SpawnKind } from "./stages";
import { releaseAim, spawnDrop } from "./weapons";
import { magnetizeGems } from "./pickups";
import { offerUpgrades } from "./upgrades";
import {
    Cue,
    DropKind,
    EnemyTrait,
    RunPhase,
    type RunChoice,
    type RunState,
} from "./traits";

//  The run's clock: three minutes of waves, on the stage's mix and tempo,
//  elites at one and two, then the boss. A level-up holds the world for its cards; the hero's fall and the
//  boss's each play out before their screen. A player who keeps going
//  after the boss plays on, endless, until the hero falls.

/** Seconds the hero's fall plays before the death screen. */
export const dyingSeconds = 1.8;
/** Seconds the boss bursts apart before the victory screen. */
export const bossDeathSeconds = 2;

/** Seconds between two wave spawns at the start, and the seconds each
 *  second of the clock takes off them. */
const spawnStartSeconds = 0.75;
const spawnShrinkPerSecond = 1 / 200;
/** The fewest seconds between two wave spawns before endless. */
const spawnFloorSeconds = 0.18;
/** Seconds the floor loses for each second past the boss, in endless:
 *  about a hundredth every half minute. */
const endlessFloorShrinkPerSecond = 0.0003;
/** The fewest seconds between two wave spawns, however long endless runs. */
const endlessFloorSeconds = 0.08;
/** Seconds between two endless elites, which alternate gold and crimson. */
const endlessEliteSeconds = 45;
/** Seconds between two endless bosses. */
const endlessBossSeconds = 180;

/** What the lobby hands a run: the player's picks and what they have
 *  unlocked. */
export interface RunStart extends RunChoice {
    zapUnlocked: boolean;
}

/** Starts a run on a fresh field: the class's health, speed and weapon
 *  timing, the starting weapon, and the clock at zero. */
export function startRun(world: World, start: RunStart) {
    const run = readRun(world);
    const runClass = findClass(start.classId);
    run.phase = RunPhase.Playing;
    run.nickname = start.nickname;
    run.look = start.look;
    run.starter = start.starter;
    run.classId = start.classId;
    run.stage = start.stage;
    run.zapUnlocked = start.zapUnlocked;
    run.loadout = [start.starter];
    run.speed = Math.round(210 * runClass.move);
    for (const id of weaponIds) {
        const weapon = run.weapons[id];
        weapon.owned = id === start.starter;
        weapon.interval = Math.max(0.12, weapon.interval / runClass.rate);
        if (weapon.range)
            weapon.range = Math.round(weapon.range * runClass.range);
        if (weapon.radius)
            weapon.radius = Math.round(weapon.radius * runClass.range);
    }
    run.maxHealth = Math.round(100 * runClass.hp);
    run.healthFilled = false;
    say(world, "Hold until the third minute. Then the boss.");
}

/** The line that says a kind joins the field; the grunts start it. */
const introductions: Partial<Record<SpawnKind, string>> = {
    runner: "Runners join the field.",
    tank: "Tanks join the field.",
    shooter: "Shooters join the field.",
    summoner: "Summoners join the field.",
};

/** A magnet 110 units from the hero, at one minute and at two. */
function dropMagnet(world: World) {
    const angle = random(world) * Math.PI * 2;
    const hero = readHeroPosition(world);
    spawnDrop(world, DropKind.Magnet, {
        x: hero.x + Math.cos(angle) * u(110),
        z: hero.z + Math.sin(angle) * u(110),
    });
}

/** The fewest seconds between two wave spawns now: in endless, a floor
 *  that keeps shrinking slowly. */
function readSpawnFloor(run: RunState) {
    if (!run.endless) return spawnFloorSeconds;
    const past = run.time - bossAtSeconds;
    return Math.max(
        endlessFloorSeconds,
        spawnFloorSeconds - past * endlessFloorShrinkPerSecond,
    );
}

/** In endless, calls an elite every 45 seconds, gold then crimson, and the
 *  boss every third minute. Neither comes while a boss is on the field. */
function callEndless(world: World) {
    const run = readRun(world);
    if (run.bossPhase) return;
    if (run.time >= run.nextBossAt) {
        run.nextBossAt = run.time + endlessBossSeconds;
        beginBoss(world);
        return;
    }
    if (run.time < run.nextEliteAt) return;
    run.nextEliteAt = run.time + endlessEliteSeconds;
    spawnElite(
        world,
        run.endlessElites++ % 2 ? EnemyKind.CrimsonElite : EnemyKind.Elite,
    );
}

/** Runs the clock: says each new kind, drops the minute magnets, spawns
 *  the elites and the waves, and lands the boss at three minutes, and in
 *  endless every third minute after. */
export function advanceRun(world: World, { deltaSeconds }: StepSeconds) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    run.time += deltaSeconds;
    const stage = findStage(run.stage);
    for (const [index, { at, kind }] of stage.joins.entries())
        if (run.seenIntro <= index && run.time >= at) {
            run.seenIntro = index + 1;
            const line = introductions[kind];
            if (line) say(world, line);
        }
    if (!run.magnetAt60 && run.time >= 60) {
        run.magnetAt60 = true;
        dropMagnet(world);
    }
    if (!run.eliteAt60 && run.time >= 60) {
        run.eliteAt60 = true;
        spawnElite(world, EnemyKind.Elite);
    }
    if (!run.magnetAt120 && run.time >= 120) {
        run.magnetAt120 = true;
        dropMagnet(world);
    }
    if (!run.eliteAt120 && run.time >= 120) {
        run.eliteAt120 = true;
        spawnElite(world, EnemyKind.CrimsonElite);
    }
    if (run.endless) callEndless(world);
    else if (!run.bossPhase && run.time >= bossAtSeconds) beginBoss(world);
    if (run.bossPhase && run.bossLand > 0) {
        run.bossLand -= deltaSeconds;
        if (run.bossLand <= 0) {
            run.bossLand = 0;
            spawnBoss(world);
            magnetizeGems(world);
            playCue(world, Cue.BossMusic);
            say(world, "Leave the landing circle. Experience is pulled in.");
        }
    }
    run.spawnClock -= deltaSeconds;
    if (!run.bossPhase && run.spawnClock <= 0) {
        run.spawnClock =
            Math.max(
                readSpawnFloor(run),
                spawnStartSeconds - run.time * spawnShrinkPerSecond,
            ) * stage.spawnIntervalShare;
        if (run.spawning) {
            spawnWaveEnemy(world);
            if (run.time > 40) spawnWaveEnemy(world);
        }
    }
}

/** The stage a run has opened by what it did on its own stage: the next
 *  stage once it reached or beat the boss, as that stage asks; none before.
 *  The page keeps the unlock. */
export function readEarnedStage(run: RunState): StageId | null {
    for (const id of Object.values(StageId)) {
        const unlock = findStage(id).unlock;
        if (unlock?.after !== run.stage) continue;
        const reached =
            unlock.moment === UnlockMoment.BossReached
                ? run.time >= bossAtSeconds
                : run.endless ||
                  run.phase === RunPhase.BossDeath ||
                  run.phase === RunPhase.Complete;
        if (reached) return id;
    }
    return null;
}

/** Deals the level's cards once the experience fills the bar. Last in the
 *  step, as the source's update ends on it. */
export function levelUp(world: World) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing || run.xp < run.nextXp) return;
    run.xp = Math.round((run.xp - run.nextXp) * 100) / 100;
    run.level++;
    run.nextXp += 4;
    offerUpgrades(world);
}

/** The hero falls, playing its dying clip whole, and the field fades out
 *  before the death screen. */
export function beginDeath(world: World) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    run.phase = RunPhase.Dying;
    run.deathTimer = dyingSeconds;
    releaseAim(world);
    const hero = findPlayerHero(world);
    if (hero) playClip(hero, "dead", { hold: true });
    shakeCamera(world, { strength: 0.6 });
    const { x, z } = readHeroPosition(world);
    throwSparks(world, { x, z, color: "#ff4040", count: 22 });
    throwSparks(world, { x, z, color: "#6a1010", count: 10 });
    playCue(world, Cue.Fallen);
}

/** The player keeps going after the boss: the same field plays on, the
 *  burst boss gone, the waves back, and an elite and the boss to come. */
export function beginEndless(world: World) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Complete || run.endless) return;
    run.phase = RunPhase.Playing;
    run.endless = true;
    run.bossPhase = false;
    run.bossLand = -1;
    run.spawnClock = 0;
    run.nextEliteAt = run.time + endlessEliteSeconds;
    run.nextBossAt = run.time + endlessBossSeconds;
    for (const entity of [...world.query(EnemyTrait)])
        if (entity.get(EnemyTrait)?.dying) entity.destroy();
    say(world, "Endless. The swarm returns, and the boss every third minute.");
}

/** In endless, the boss falls like any other enemy and the waves return. */
export function endEndlessBoss(world: World) {
    const run = readRun(world);
    run.bossPhase = false;
    run.bossLand = -1;
    shakeCamera(world, { strength: 0.8 });
    playCue(world, Cue.Fanfare);
    say(world, "The boss falls again. The swarm returns, harder.");
}

/** The boss falls: it bursts apart before the victory screen. */
export function beginBossDeath(world: World) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    run.phase = RunPhase.BossDeath;
    run.bossDeathTimer = bossDeathSeconds;
    shakeCamera(world, { strength: 0.8 });
    playCue(world, Cue.Fanfare);
    readEach(world, placedEnemies, ([enemy, { x, z }]) => {
        if (enemy.kind !== EnemyKind.Boss) return;
        throwSparks(world, { x, z, color: "#ff5a4a", count: 30 });
        throwSparks(world, { x, z, color: "#ffe08a", count: 18 });
        throwSparks(world, { x, z, color: "#fff", count: 8 });
    });
}

const placedEnemies = createQuery(EnemyTrait, TransformTrait);

/** Plays each fall out: the hero's to the death screen, or in endless to
 *  the victory screen, and the boss's bursts to the victory screen. */
export function playEndings(world: World, { deltaSeconds }: StepSeconds) {
    const run = readRun(world);
    if (run.phase === RunPhase.Dying) {
        run.deathTimer -= deltaSeconds;
        if (run.deathTimer > dyingSeconds - 0.35) {
            const { x, z } = readHeroPosition(world);
            throwSparks(world, { x, z, color: "#ff3030", count: 3 });
        }
        //  The boss was beaten before an endless run's fall: the run is won.
        if (run.deathTimer <= 0)
            run.phase = run.endless ? RunPhase.Complete : RunPhase.Defeated;
        return;
    }
    if (run.phase !== RunPhase.BossDeath) return;
    run.bossDeathTimer -= deltaSeconds;
    readEach(world, placedEnemies, ([enemy, { x, z }]) => {
        if (!enemy.dying) return;
        enemy.deathSeconds += deltaSeconds;
        if (enemy.deathSeconds < 1.5 && random(world) < 0.8)
            throwSparks(world, {
                x: x + u((random(world) - 0.5) * 70),
                z: z + u((random(world) - 0.5) * 50),
                color: random(world) < 0.5 ? "#ff5a4a" : "#ffe08a",
                count: 3,
            });
    });
    if (run.bossDeathTimer <= 0) run.phase = RunPhase.Complete;
}
