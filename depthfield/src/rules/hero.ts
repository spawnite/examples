import { createQuery, type Entity, type World } from "koota";
import {
    ClipLayer,
    dealDamage,
    requireAuthority,
    findPlayerHero,
    HealthTrait,
    InputTrait,
    InvulnerableTrait,
    maxHealthStat,
    MovementTrait,
    playClip,
    setStatBase,
    stopClip,
    VelocityTrait,
    type HeroStep,
} from "@spawnite/engine/core";
import { findLook, u } from "./data";
import { readHeroPosition, readRun, throwSparks } from "./field";
import { readThreat } from "./threat";
import { beginDeath } from "./run";
import { RunPhase, type RunState } from "./traits";

//  The soldier: the engine's hero, walked by the engine on the player's
//  keys or stick, at the run's speed. The engine's jump is the dash here:
//  Space, or the touch screen's button, sends the soldier a quick burst
//  the way it faces, through enemies.

/** Seconds a hit leaves the hero unhurtable. */
const mercySeconds = 0.7;
const dashSeconds = 0.15;
const dashCooldownSeconds = 4;
const dashSpeed = u(1200);
/** Seconds the roll takes to play: the dash is 0.15 s, and the roll
 *  finishes as the soldier comes out of it. */
export const rollSeconds = 0.42;
/** The roll clip's rolling part, in its own seconds. */
const rollFrom = 0.6;
const rollTo = 1.5;

/** Whether the soldier still rolls out of its last dash. */
export function isRolling(run: RunState) {
    return run.dashCooldown > dashCooldownSeconds - rollSeconds;
}

interface Hurt {
    amount: number;
    /** The sparks' colour. */
    color: string;
    /** An elite's or the boss's hit, which the threat grows by level only. */
    big?: boolean;
}

/** Hurts the hero by `amount`, grown by the threat, unless a hit's mercy
 *  or a dash still guards the hero, and begins the fall at zero. Every
 *  enemy's hit lands here. */
export function hurtHero(world: World, { amount, color, big }: Hurt) {
    const run = readRun(world);
    const hero = findPlayerHero(world);
    if (!hero || run.invul > 0 || hero.has(InvulnerableTrait)) return;
    dealDamage(requireAuthority(world), hero, {
        amount: Math.round(amount * readThreat(run, big).damage),
    });
    run.invul = mercySeconds;
    const { x, z } = readHeroPosition(world);
    throwSparks(world, { x, z, color });
    if ((hero.get(HealthTrait)?.current ?? 0) <= 0) beginDeath(world);
}

/** The hero's health, and the most it can hold. */
export function readHeroHealth(world: World) {
    return (
        findPlayerHero(world)?.get(HealthTrait) ?? { current: 0, maximum: 1 }
    );
}

/** Heals the hero by `amount`, never past the most it can hold. */
export function healHero(world: World, amount: number) {
    const hero = findPlayerHero(world);
    if (!hero) return;
    const { current, maximum } = hero.get(HealthTrait)!;
    hero.set(HealthTrait, { current: Math.min(maximum, current + amount) });
}

/** Sets the most health the hero holds, as its `maxHealth` stat, which the
 *  engine's step copies onto its health. */
export function setHeroMaximum(world: World, maximum: number) {
    readRun(world).maxHealth = maximum;
    const hero = findPlayerHero(world);
    if (!hero) return;
    setStatBase(hero, maxHealthStat, maximum);
    hero.set(HealthTrait, { maximum });
}

/** The engine's jump taken as a dash: read before the engine steers, so
 *  the soldier never leaves the ground. */
export function takeDashRequest(world: World) {
    const hero = findPlayerHero(world);
    if (!hero?.get(InputTrait)?.jump) return;
    hero.set(InputTrait, { jump: false });
    const run = readRun(world);
    if (
        run.phase !== RunPhase.Playing ||
        run.dashCooldown > 0 ||
        run.dashTime > 0
    )
        return;
    const velocity = hero.get(VelocityTrait)!;
    const speed = Math.hypot(velocity.x, velocity.z);
    //  The way the keys point now; standing still, the way it last went.
    if (speed > 0.2 * u(run.speed)) {
        run.faceX = velocity.x / speed;
        run.faceZ = velocity.z / speed;
    }
    run.dashTime = dashSeconds;
    run.dashCooldown = dashCooldownSeconds;
    run.invul = Math.max(run.invul, dashSeconds);
    //  The roll plays on the whole body, the shot's arms let go for it.
    stopClip(hero, { layer: ClipLayer.UpperBody });
    playClip(hero, "roll", {
        start: rollFrom,
        end: rollTo,
        speed: (rollTo - rollFrom) / rollSeconds,
    });
    const { x, z } = readHeroPosition(world);
    throwSparks(world, {
        x,
        z,
        color: findLook(run.look).color,
        count: 10,
    });
}

const drivenHeroes = createQuery(VelocityTrait);

/** After the engine steers the hero: its speed follows the run's, a dash
 *  overrides its walk, and outside play it stands. Counts the hit mercy
 *  and the dash's cooldown down, and heals by the regen. A hero system,
 *  since it writes the hero's velocity, which a page in a room predicts.
 *  ponytail: the dash's clock and the mercy live on the run, a world
 *  trait no replay rewinds, which holds for a game of one player with no
 *  room; a room would need them in a predicted trait on the hero. */
export function driveHero(world: World, step: HeroStep) {
    step.updateEachHero(drivenHeroes, ([velocity], hero) =>
        driveOneHero(world, hero, velocity, step.deltaSeconds),
    );
}

function driveOneHero(
    world: World,
    hero: Entity,
    velocity: { x: number; z: number },
    deltaSeconds: number,
) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) {
        velocity.x = 0;
        velocity.z = 0;
        return;
    }
    if (!run.healthFilled) {
        run.healthFilled = true;
        setHeroMaximum(world, run.maxHealth);
        hero.set(HealthTrait, { current: run.maxHealth });
    }
    const speed = u(run.speed);
    if (hero.get(MovementTrait)?.speed !== speed)
        hero.set(MovementTrait, { speed });
    const health = hero.get(HealthTrait)!;
    run.invul -= deltaSeconds;
    if (run.dashCooldown > 0)
        run.dashCooldown = Math.max(0, run.dashCooldown - deltaSeconds);
    const moving = Math.hypot(velocity.x, velocity.z);
    if (run.dashTime > 0) {
        //  The last step of a dash moves it only the time it has left.
        const share = Math.min(deltaSeconds, run.dashTime) / deltaSeconds;
        velocity.x = run.faceX * dashSpeed * share;
        velocity.z = run.faceZ * dashSpeed * share;
        run.dashTime -= deltaSeconds;
        const { x, z } = readHeroPosition(world);
        throwSparks(world, {
            x,
            z,
            color: findLook(run.look).color,
            count: 2,
        });
    } else if (moving > 0.05) {
        run.faceX = velocity.x / moving;
        run.faceZ = velocity.z / moving;
        //  Out of a dash at the walk's speed, not easing down from the
        //  dash's: the source's soldier stopped dashing on the spot.
        if (moving > speed) {
            velocity.x = run.faceX * speed;
            velocity.z = run.faceZ * speed;
        }
    }
    if (run.regen > 0 && health.current > 0 && health.current < health.maximum)
        healHero(world, run.regen * deltaSeconds);
}
