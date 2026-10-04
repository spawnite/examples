import { createQuery, type Entity, type World } from "koota";
import { readEach, TransformTrait } from "@spawnite/engine/core";
import { u } from "./data";
import { playCue, readHeroPosition, readRun, say, throwSparks } from "./field";
import type { StepSeconds } from "./enemies";
import { healHero, setHeroMaximum } from "./hero";
import { Cue, DropTrait, DropKind, GemTrait, RunPhase } from "./traits";

//  What the enemies leave: experience orbs, and now and then a drop the
//  hero walks over. Within 115 units each drifts to the hero.

/** Metres within which the hero takes a pickup. */
const takeReach = u(22);
/** Metres within which a pickup drifts to the hero. */
const pullReach = u(115);

const gems = createQuery(GemTrait, TransformTrait);
const drops = createQuery(DropTrait, TransformTrait);
const spent: Entity[] = [];

/** Gains experience by `value`, doubled by a double-XP drop and grown by
 *  the run's multiplier. */
function gainXp(world: World, value: number) {
    const run = readRun(world);
    const gain = value * (run.xpBoost > 0 ? 2 : 1) * run.xpMult;
    run.xp = Math.round((run.xp + gain) * 100) / 100;
}

/** Pulls each orb in reach, or every magnetized one, to the hero, and
 *  takes it on touch. */
export function collectGems(world: World, { deltaSeconds }: StepSeconds) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    if (run.xpBoost > 0) run.xpBoost = Math.max(0, run.xpBoost - deltaSeconds);
    const hero = readHeroPosition(world);
    readEach(world, gems, ([gem, position], entity) => {
        const dx = hero.x - position.x;
        const dz = hero.z - position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < takeReach) {
            gainXp(world, gem.value);
            playCue(world, Cue.Orb);
            spent.push(entity);
            return;
        }
        if (!gem.magnetized && distance >= pullReach) return;
        const speed = gem.magnetized ? u(900) + distance * 0.65 : u(360);
        const step = Math.min(distance, speed * deltaSeconds);
        position.x += (dx / distance) * step;
        position.z += (dz / distance) * step;
        if (step >= distance - u(18)) {
            gainXp(world, gem.value);
            spent.push(entity);
        }
    });
    for (const entity of spent) entity.destroy();
    spent.length = 0;
}

/** Pulls every orb on the field to the hero. */
export function magnetizeGems(world: World) {
    readEach(world, gems, ([gem]) => {
        gem.magnetized = true;
    });
}

/** Takes each drop the hero touches, pulling each in reach closer. */
export function collectDrops(world: World, { deltaSeconds }: StepSeconds) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    const hero = readHeroPosition(world);
    readEach(world, drops, ([drop, position], entity) => {
        const dx = hero.x - position.x;
        const dz = hero.z - position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < takeReach) {
            takeDrop(world, drop.kind);
            spent.push(entity);
        } else if (distance < pullReach) {
            const step = Math.min(distance, u(360) * deltaSeconds);
            position.x += (dx / distance) * step;
            position.z += (dz / distance) * step;
        }
    });
    for (const entity of spent) entity.destroy();
    spent.length = 0;
}

function takeDrop(world: World, kind: DropKind) {
    const run = readRun(world);
    const { x, z } = readHeroPosition(world);
    switch (kind) {
        case DropKind.Health: {
            playCue(world, Cue.Health);
            run.permanentHealth += 5;
            setHeroMaximum(world, run.maxHealth + 5);
            healHero(world, 5);
            say(world, "+5 maximum health this run.");
            return;
        }
        case DropKind.Food:
            playCue(world, Cue.Food);
            healHero(world, 35);
            throwSparks(world, { x, z, color: "#ffb15a", count: 12 });
            say(world, "+35 health");
            return;
        case DropKind.Magnet:
            playCue(world, Cue.Magnet);
            magnetizeGems(world);
            throwSparks(world, { x, z, color: "#83e5ff", count: 18 });
            say(world, "Magnet! Pulling in every XP orb.");
            return;
        case DropKind.DoubleXp:
            playCue(world, Cue.DoubleXp);
            run.xpBoost = 10;
            throwSparks(world, { x, z, color: "#b6ff6a", count: 16 });
            say(world, "Double experience for 10 seconds.");
            return;
    }
}
