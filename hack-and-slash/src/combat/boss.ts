import {
    findPlayerHero,
    HealthTrait,
    TransformTrait,
    VelocityTrait,
    type System,
} from "@spawnite/engine";
import { createQuery, type World } from "koota";
import { elements, kindOf, type BossSkill } from "../monsters/kinds";
import { slotKind } from "../monsters/spawns";
import {
    BossStateTrait,
    MonsterTrait,
    MonsterMode,
    MonsterStateTrait,
} from "../monsters/traits";
import { shakeCamera } from "../view/cameraFx";
import { useBattle } from "./battle";
import { hurtHero } from "./hurt";
import { burstHazard } from "./motes";
import { HazardTrait, HazardShape } from "./traits";

//  A boss's skills: each is a hazard laid on the ground, drawn as it fills
//  over its warning, which goes off at the end and hurts the hero if she
//  still stands in it. An area attack deals the boss's damage a second for
//  each second of warning, so the long ones hit hardest and are the ones
//  to run from. The dash is a bar too, and the boss charges along it as it
//  goes off.

/** Seconds a boss's strike takes once its attack goes off, standing where
 *  it cast; and the seconds between its skills, shortened once it is below
 *  half its health. It stands still through the whole warning before, so
 *  the attack is its doing and not the ground's. */
export const strikeSeconds = 0.45;
const restLeast = 2.4;
const restMore = 1.6;
const enragedRest = 0.7;
/** Metres from the hero within which a boss uses its skills. */
const skillReach = 16;
/** Seconds a dash warns for, and takes to run. */
export const dashWarning = 1;
export const dashSeconds = 0.3;
/** Metres the hero's body reaches past her middle, for the hit tests. */
const heroRadius = 0.35;
/** Seconds a hazard flashes after it goes off. */
export const hazardFlashSeconds = 0.3;

const bosses = createQuery(
    MonsterTrait,
    MonsterStateTrait,
    BossStateTrait,
    TransformTrait,
    VelocityTrait,
    HealthTrait,
);
const hazards = createQuery(HazardTrait);

/** Casts, dashes and rests each boss that hunts the hero. After the hunt,
 *  so its stillness while it casts and its charge override the chase. */
export const castBossSkills: System = (world, { deltaSeconds }) => {
    const hero = findPlayerHero(world);
    const heroAt = hero?.get(TransformTrait);
    const defeated = useBattle.getState().defeated;
    world
        .query(bosses)
        .updateEach(([monster, state, boss, position, velocity, health]) => {
            if (health.current <= 0) return;
            if (state.mode !== MonsterMode.Hunt || defeated) {
                boss.casting = 0;
                boss.dashIn = -1;
                boss.dashing = 0;
                return;
            }
            if (boss.dashing > 0) {
                boss.dashing -= deltaSeconds;
                const speed = boss.dashLength / dashSeconds;
                velocity.set(boss.dashX * speed, 0, boss.dashZ * speed);
                return;
            }
            if (boss.dashIn >= 0) {
                boss.dashIn -= deltaSeconds;
                velocity.set(0, 0, 0);
                if (boss.dashIn < 0) boss.dashing = dashSeconds;
                return;
            }
            if (boss.casting > 0) {
                boss.casting -= deltaSeconds;
                velocity.set(0, 0, 0);
                return;
            }
            boss.cooldown -= deltaSeconds;
            if (boss.cooldown > 0 || !heroAt || state.attack >= 0) return;
            const toX = heroAt.x - position.x;
            const toZ = heroAt.z - position.z;
            const apart = Math.hypot(toX, toZ);
            if (apart > skillReach) return;
            const kind = kindOf(slotKind(monster.slot) ?? "mossKing");
            if (!kind.boss) return;
            const enraged = health.current < health.maximum / 2;
            const skill = pickSkill(kind.boss.skills, enraged);
            const dirX = apart > 1e-3 ? toX / apart : 0;
            const dirZ = apart > 1e-3 ? toZ / apart : 1;
            const cast = {
                world,
                owner: monster.slot,
                x: position.x,
                y: position.y,
                z: position.z,
                dirX,
                dirZ,
                heroX: heroAt.x,
                heroZ: heroAt.z,
                perSecond: kind.boss.damagePerSecond,
                radius: monster.radius,
                element: elements.indexOf(kind.boss.element),
            };
            if (skill === "dash") {
                const length = Math.min(10, apart + 3);
                layHazard(cast, {
                    shape: HazardShape.Bar,
                    size: length,
                    inner: monster.radius * 2 + 0.4,
                    delay: dashWarning,
                    damage: kind.boss.dashDamage,
                });
                boss.dashIn = dashWarning;
                boss.dashX = dirX;
                boss.dashZ = dirZ;
                boss.dashLength = length;
                state.attackCooldown = dashWarning + dashSeconds;
            } else {
                const warning = castArea(cast, skill);
                boss.casting = warning + strikeSeconds;
                boss.castLength = warning;
                boss.castX = dirX;
                boss.castZ = dirZ;
                //  No lunge while it casts: it stands and strikes.
                state.attackCooldown = boss.casting;
            }
            velocity.set(0, 0, 0);
            boss.cooldown =
                (restLeast + Math.random() * restMore) *
                (enraged ? enragedRest : 1);
        });
};

/** A skill at random from the boss's list; the cataclysm only once it is
 *  enraged. */
function pickSkill(skills: readonly BossSkill[], enraged: boolean) {
    const open = skills.filter((skill) => skill !== "cataclysm" || enraged);
    return open[Math.floor(Math.random() * open.length)];
}

type Cast = {
    world: World;
    owner: number;
    x: number;
    y: number;
    z: number;
    dirX: number;
    dirZ: number;
    heroX: number;
    heroZ: number;
    perSecond: number;
    radius: number;
    element: number;
};

type Shape = {
    shape: HazardShape;
    size: number;
    inner?: number;
    spread?: number;
    delay: number;
    damage?: number;
    x?: number;
    z?: number;
    dirX?: number;
    dirZ?: number;
};

/** Lays one hazard, from the boss unless it says where. An area attack
 *  deals the boss's damage a second for each second it warns. */
function layHazard(cast: Cast, shape: Shape) {
    cast.world.spawn(
        HazardTrait({
            shape: shape.shape,
            x: shape.x ?? cast.x,
            y: cast.y,
            z: shape.z ?? cast.z,
            dirX: shape.dirX ?? cast.dirX,
            dirZ: shape.dirZ ?? cast.dirZ,
            size: shape.size,
            inner: shape.inner ?? 0,
            spread: shape.spread ?? 0,
            delay: shape.delay,
            damage: shape.damage ?? Math.round(cast.perSecond * shape.delay),
            owner: cast.owner,
            element: cast.element,
        }),
    );
    return shape.delay;
}

/** Lays an area attack's hazards, and returns the seconds it warns for. */
function castArea(cast: Cast, skill: BossSkill): number {
    switch (skill) {
        case "slam":
            //  Where she stands as it casts: a step aside saves her.
            return layHazard(cast, {
                shape: HazardShape.Circle,
                x: cast.heroX,
                z: cast.heroZ,
                size: 3.2,
                delay: 1.5,
            });
        case "cleave":
            return layHazard(cast, {
                shape: HazardShape.Cone,
                size: 7,
                spread: (50 * Math.PI) / 180,
                delay: 1.2,
            });
        case "ripple":
            //  Safe right beside it, or far away.
            return layHazard(cast, {
                shape: HazardShape.Ring,
                inner: cast.radius + 2.2,
                size: 8,
                delay: 2.5,
            });
        case "cross":
            //  One arm at her, the others square to it.
            for (let turn = 0; turn < 4; turn++) {
                const angle = (turn * Math.PI) / 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                layHazard(cast, {
                    shape: HazardShape.Bar,
                    size: 11,
                    inner: 2,
                    delay: 3,
                    dirX: cast.dirX * cos - cast.dirZ * sin,
                    dirZ: cast.dirX * sin + cast.dirZ * cos,
                });
            }
            return 3;
        case "cataclysm":
            //  The long warning: time to run clear of it.
            return layHazard(cast, {
                shape: HazardShape.Circle,
                size: 9.5,
                delay: 5,
            });
        case "dash":
            return 0;
    }
}

/** Ages each hazard; at the end of its warning it goes off, once, and hurts
 *  the hero if she is inside it, then flashes a moment and is gone. */
export const fireHazards: System = (world, { deltaSeconds }) => {
    const hero = findPlayerHero(world);
    const heroAt = hero?.get(TransformTrait);
    for (const entity of world.query(hazards)) {
        const hazard = entity.get(HazardTrait)!;
        const age = hazard.age + deltaSeconds;
        if (age >= hazard.delay + hazardFlashSeconds) {
            entity.destroy();
            continue;
        }
        const fires = !hazard.fired && age >= hazard.delay;
        entity.set(HazardTrait, { age, fired: hazard.fired || fires });
        if (!fires) continue;
        shakeCamera(0.12);
        burstHazard(hazard);
        if (hero && heroAt && inside(hazard, heroAt.x, heroAt.z))
            hurtHero(world, hero, hazard.damage);
    }
};

/** Whether a body `radius` metres round standing at (x, z), the hero's
 *  unless named, is caught by the hazard or a skill's area. */
export function inside(
    hazard: {
        shape: HazardShape;
        x: number;
        z: number;
        dirX: number;
        dirZ: number;
        size: number;
        inner: number;
        spread: number;
    },
    x: number,
    z: number,
    radius = heroRadius,
) {
    const toX = x - hazard.x;
    const toZ = z - hazard.z;
    const apart = Math.hypot(toX, toZ);
    switch (hazard.shape) {
        case HazardShape.Circle:
            return apart <= hazard.size + radius;
        case HazardShape.Ring:
            return (
                apart >= hazard.inner - radius && apart <= hazard.size + radius
            );
        case HazardShape.Cone: {
            if (apart > hazard.size + radius) return false;
            if (apart <= radius) return true;
            const along = (toX * hazard.dirX + toZ * hazard.dirZ) / apart;
            return Math.acos(Math.min(1, along)) <= hazard.spread;
        }
        case HazardShape.Bar: {
            const along = toX * hazard.dirX + toZ * hazard.dirZ;
            const across = Math.abs(toX * hazard.dirZ - toZ * hazard.dirX);
            return (
                along >= -radius &&
                along <= hazard.size + radius &&
                across <= hazard.inner / 2 + radius
            );
        }
    }
}

/** Removes a slain boss's hazards still waiting to go off. */
export function clearBossHazards(world: World, owner: number) {
    for (const entity of world.query(hazards))
        if (entity.get(HazardTrait)!.owner === owner) entity.destroy();
}

/** Every hazard, for a scene to clear as it leaves. */
export function clearHazards(world: World) {
    world.query(hazards).forEach((entity) => entity.destroy());
}
