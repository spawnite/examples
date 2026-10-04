import { createQuery, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    aimAt,
    ClipLayer,
    dealDamage,
    requireAuthority,
    findPlayerHero,
    HealthTrait,
    playClip,
    random,
    readEach,
    stopClip,
    TransformTrait,
} from "@spawnite/engine/core";
import {
    enemyStats,
    EnemyKind,
    findClass,
    u,
    WeaponId,
    weaponIds,
    type WeaponState,
} from "./data";
import {
    echoOffsetX,
    echoOffsetZ,
    markFall,
    measureSegmentDistance,
    placeOnGround,
    markShot,
    playCue,
    readGrid,
    readHeroPosition,
    readRun,
    say,
    throwSparks,
    type Area,
    type Placed,
    type Spot,
} from "./field";
import type { StepSeconds } from "./enemies";
import { isRolling } from "./hero";
import { beginBossDeath, endEndlessBoss } from "./run";
import {
    BoltTrait,
    BoltKind,
    BoomerangTrait,
    Cue,
    DropTrait,
    DropKind,
    GemTrait,
    LaserTrait,
    MineTrait,
    NovaTrait,
    RunPhase,
    Shooter,
    type BoltState,
} from "./traits";

//  The hero's seven weapons: each fires at the nearest enemy on its own
//  clock, and the Prismatic echo fires a copy of each shot beside the hero.
//  Each of the hero's shots turns it to the shot, and each shot of the gun
//  in its hands, the loadout's first, plays one shot of the shooting clip
//  on its arms.

/** Seconds after a shot the hero keeps turned to it, its arms raised. */
export const aimSeconds = 0.6;
/** The shooting clip's seconds that hold one shot. It loops a burst, and
 *  its first shot kicks hardest: the hands are still at frame 2 of its 30
 *  a second, snap back by frame 4, and settle into the aim by frame 10. */
const shotFireSeconds = 2 / 30;
const shotSettledSeconds = 10 / 30;

/** The run's class's range multiplier. */
function readRange(world: World) {
    return findClass(readRun(world).classId).range;
}

/** A hit on an enemy: the damage, the sparks' colour and the weapon that
 *  dealt it, for the run's damage by weapon; a stage's hazard deals none,
 *  and its damage stays off the run's. */
interface Strike {
    amount: number;
    color: string;
    weapon?: WeaponId;
}

/** Deals a strike to an enemy, shows its bar, and on the kill counts it,
 *  drops what it drops and leaves its orb. The boss's kill starts its
 *  fall instead, but in endless its orb drops like any other's. */
export function hitEnemy(world: World, placed: Placed, strike: Strike) {
    const { entity, enemy, position } = placed;
    const health = entity.get(HealthTrait);
    if (!health || health.current <= 0 || enemy.flee || enemy.dying) return;
    const run = readRun(world);
    enemy.healthBarUntil = run.time + 5;
    const dealt = Math.min(strike.amount, Math.max(0, health.current));
    dealDamage(requireAuthority(world), entity, {
        amount: strike.amount,
        weapon: strike.weapon,
    });
    if (strike.weapon) {
        run.damageDealt += dealt;
        run.weaponDamage[strike.weapon] =
            (run.weaponDamage[strike.weapon] ?? 0) + dealt;
    }
    enemy.hit = 0.13;
    const { x, z } = position;
    throwSparks(world, { x, z, color: strike.color, count: 3 });
    if (health.current - strike.amount > 0) return;
    run.kills++;
    playCue(world, Cue.Death);
    //  In endless the boss falls like any other enemy.
    const bursts = enemy.kind === EnemyKind.Boss && !run.endless;
    if (!bursts) markFall(world, { x, z, kind: enemy.kind });
    if (enemy.kind === EnemyKind.Boss && run.endless) endEndlessBoss(world);
    if (bursts) {
        //  Out of the engine's reap, so it stays to burst apart.
        entity.remove(HealthTrait);
        enemy.dying = true;
        enemy.deathSeconds = 0;
        beginBossDeath(world);
        return;
    }
    if (enemy.kind === EnemyKind.LootRunner) {
        dropLoot(world, position);
        return;
    }
    const supply = 1 + run.consumableBonus;
    if (random(world) < 0.004 * supply)
        spawnDrop(world, DropKind.Magnet, position);
    if (random(world) < run.dropChance)
        spawnDrop(world, DropKind.Health, position);
    if (random(world) < 0.005 * supply)
        spawnDrop(world, DropKind.DoubleXp, position);
    if (random(world) < 0.05 * supply)
        spawnDrop(world, DropKind.Food, position);
    world.spawn(
        GemTrait({
            value: enemyStats[enemy.kind].xp,
            kind: enemy.kind,
            magnetized: false,
        }),
        ...placeOnGround({ x, z }),
    );
    throwSparks(world, {
        x,
        z,
        color: enemyStats[enemy.kind].color,
        count: 12,
    });
}

export function spawnDrop(world: World, kind: DropKind, at: Spot) {
    world.spawn(DropTrait({ kind }), ...placeOnGround(at));
}

/** The loot runner's twelve orbs, round where it fell: two levels'
 *  experience, pulled to the hero at once. */
function dropLoot(world: World, at: Spot) {
    const run = readRun(world);
    const total = run.nextXp + (run.nextXp + 4);
    const orbs = 12;
    const share = Math.floor((total / orbs) * 100) / 100;
    let remaining = total;
    for (let index = 0; index < orbs; index++) {
        const angle =
            (Math.PI * 2 * index) / orbs + (random(world) - 0.5) * 0.35;
        const distance = u(28 + random(world) * 78);
        const value =
            index === orbs - 1 ? Math.round(remaining * 100) / 100 : share;
        remaining = Math.round((remaining - value) * 100) / 100;
        world.spawn(
            GemTrait({ value, kind: EnemyKind.Elite, magnetized: true }),
            ...placeOnGround({
                x: at.x + Math.cos(angle) * distance,
                z: at.z + Math.sin(angle) * distance,
            }),
        );
    }
    throwSparks(world, { x: at.x, z: at.z, color: "#ffe27a", count: 34 });
    throwSparks(world, { x: at.x, z: at.z, color: "#fff6c2", count: 14 });
    say(world, "Loot runner down. Two levels of experience.");
}

//  Scratch for each search: one list each, so a search inside another's
//  loop leaves the outer list whole.
const bounceFound: Placed[] = [];
const targetFound: Placed[] = [];
const pathFound: Placed[] = [];
const blastFound: Placed[] = [];
const area = { from: new Vector3(), to: new Vector3(), pad: 0 } satisfies Area;

/** Sets the scratch area to the box round (x, z) of `reach` metres. */
function setAreaAround(at: Spot, reach: number) {
    area.from.x = at.x - reach;
    area.from.z = at.z - reach;
    area.to.x = at.x + reach;
    area.to.z = at.z + reach;
    area.pad = 0;
    return area;
}

/** A zap that hit `from` jumps on to the nearest enemy it has not hit
 *  within 240 units, at 95% of its damage. */
function bounceZap(world: World, zap: BoltState, from: Placed) {
    if (!zap.bounces) return;
    const radius = u(240) * readRange(world);
    let best: Placed | null = null;
    let nearest = radius;
    for (const placed of readGrid(world).near(
        setAreaAround(from.position, radius),
        bounceFound,
    )) {
        if (placed === from || zap.hit.includes(placed.entity)) continue;
        if ((placed.entity.get(HealthTrait)?.current ?? 0) <= 0) continue;
        const distance = placed.position.distanceTo(from.position);
        if (distance > u(8) && distance < nearest) {
            nearest = distance;
            best = placed;
        }
    }
    if (!best) return;
    const speed = u(900);
    const dx = best.position.x - from.position.x;
    const dz = best.position.z - from.position.z;
    const length = Math.hypot(dx, dz) || 1;
    world.spawn(
        BoltTrait({
            kind: BoltKind.Zap,
            vx: (dx / length) * speed,
            vz: (dz / length) * speed,
            life: nearest / speed + 0.08,
            damage: Math.max(1, Math.round(zap.damage * 0.95)),
            bounces: zap.bounces - 1,
            hit: zap.hit,
        }),
        ...placeOnGround(from.position),
    );
}

interface Shot {
    id: WeaponId;
    target: Spot;
    origin: Spot;
    owner: Shooter;
}

/** Fires weapon `id` from `origin` at `target`. */
function fireWeapon(world: World, { id, target, origin, owner }: Shot) {
    const run = readRun(world);
    const weapon: WeaponState = run.weapons[id];
    if (!weapon.owned) return;
    if (owner === Shooter.Hero) {
        playCue(world, cueOf[id]);
        aimShot(world, id, target);
    }
    markShot(world, { weapon: id, owner, toX: target.x, toZ: target.z });
    const range = readRange(world);
    const base = Math.atan2(target.z - origin.z, target.x - origin.x);
    const at = () => placeOnGround(origin);
    if (id === WeaponId.Zap) {
        world.spawn(
            BoltTrait({
                kind: BoltKind.Zap,
                vx: Math.cos(base) * u(720),
                vz: Math.sin(base) * u(720),
                life: 1.05 * range,
                damage: weapon.damage,
                bounces: weapon.bounces || 1,
                hit: [],
            }),
            ...at(),
        );
        return;
    }
    if (id === WeaponId.Shard) {
        const pellets = 5;
        const spread = 0.62;
        const life = 0.3;
        const speed = u(weapon.range || 160) / life;
        for (let pellet = 0; pellet < pellets; pellet++) {
            const angle =
                base + (pellet - (pellets - 1) / 2) * (spread / (pellets - 1));
            world.spawn(
                BoltTrait({
                    kind: BoltKind.Shard,
                    vx: Math.cos(angle) * speed,
                    vz: Math.sin(angle) * speed,
                    life,
                    damage: weapon.damage,
                    bounces: 0,
                    hit: [],
                }),
                ...at(),
            );
        }
        return;
    }
    if (id === WeaponId.Nova) {
        world.spawn(
            NovaTrait({
                radius: u(16),
                max: u(weapon.radius || 150),
                life: 0.7,
                damage: weapon.damage,
                hits: [],
            }),
            ...at(),
        );
        return;
    }
    if (id === WeaponId.Mine) {
        for (let mine = 0; mine < weapon.count; mine++)
            world.spawn(
                MineTrait({
                    life: 7,
                    arm: 0.3,
                    radius: u(78) * range,
                    damage: weapon.damage,
                    spent: false,
                }),
                ...placeOnGround({
                    x: origin.x + u((mine - (weapon.count - 1) / 2) * 28),
                    z: origin.z,
                }),
            );
        return;
    }
    for (let shot = 0; shot < weapon.count; shot++) {
        const angle =
            base +
            (shot - (weapon.count - 1) / 2) *
                (id === WeaponId.Laser ? 0.16 : 0.2);
        const vx = Math.cos(angle);
        const vz = Math.sin(angle);
        if (id === WeaponId.Pulse)
            world.spawn(
                BoltTrait({
                    kind: BoltKind.Pulse,
                    vx: vx * u(650),
                    vz: vz * u(650),
                    life: 1.3 * range,
                    damage: weapon.damage,
                    bounces: 0,
                    hit: [],
                }),
                ...at(),
            );
        if (id === WeaponId.Laser) {
            const length = u(720) * range;
            const beam = {
                fromX: origin.x,
                fromZ: origin.z,
                toX: origin.x + vx * length,
                toZ: origin.z + vz * length,
                life: 0.22,
            };
            world.spawn(LaserTrait(beam));
            area.from.x = beam.fromX;
            area.from.z = beam.fromZ;
            area.to.x = beam.toX;
            area.to.z = beam.toZ;
            area.pad = u(6);
            for (const placed of readGrid(world).near(area, pathFound))
                if (
                    measureSegmentDistance(placed.position, area) <
                    placed.enemy.radius + u(6)
                )
                    hitEnemy(world, placed, {
                        amount: weapon.damage,
                        color: "#80ddff",
                        weapon: WeaponId.Laser,
                    });
        }
        if (id === WeaponId.Boomerang)
            world.spawn(
                BoomerangTrait({
                    vx: vx * u(430) * range,
                    vz: vz * u(430) * range,
                    age: 0,
                    returning: false,
                    life: 4,
                    damage: weapon.damage,
                    owner,
                    hits: [],
                }),
                ...at(),
            );
    }
}

const cueOf: Record<WeaponId, Cue> = {
    pulse: Cue.Pulse,
    laser: Cue.Laser,
    boomerang: Cue.Boomerang,
    shard: Cue.Shard,
    nova: Cue.Nova,
    mine: Cue.Mine,
    zap: Cue.Zap,
};

const echo = { x: 0, z: 0 };
//  Where the step's shots aim, written in place.
const aim = { x: 0, z: 0 };
//  The point the hero turns to, at its own height, so it turns flat.
const aimPoint = { x: 0, y: 0, z: 0 };

/** Turns the hero to a shot of weapon `id` at `target`, and plays one shot
 *  of the shooting clip on its arms where `id` is the gun in its hands,
 *  fast enough to settle before the gun's next. Not in a roll, which the
 *  arms play too. */
function aimShot(world: World, id: WeaponId, target: Spot) {
    const hero = findPlayerHero(world);
    if (!hero) return;
    const run = readRun(world);
    aimPoint.x = target.x;
    aimPoint.y = readHeroPosition(world).y;
    aimPoint.z = target.z;
    aimAt(hero, aimPoint);
    run.aimTime = aimSeconds;
    if (id !== (run.loadout[0] ?? run.starter) || isRolling(run)) return;
    const shotSeconds = shotSettledSeconds - shotFireSeconds;
    playClip(hero, "shoot", {
        layer: ClipLayer.UpperBody,
        start: shotFireSeconds,
        end: shotSettledSeconds,
        speed: Math.max(1, shotSeconds / run.weapons[id].interval),
        hold: true,
    });
}

/** Lets the hero's aim go: it turns back to its step, and its arms to the
 *  legs' clip. */
export function releaseAim(world: World) {
    readRun(world).aimTime = 0;
    const hero = findPlayerHero(world);
    if (!hero) return;
    aimAt(hero, null);
    stopClip(hero, { layer: ClipLayer.UpperBody });
}

/** Counts the hero's aim down, and lets it go once no weapon has fired
 *  for `aimSeconds`. A level-up's cards hold it, as they hold the world. */
function countAimDown(world: World, deltaSeconds: number) {
    const run = readRun(world);
    if (run.aimTime <= 0 || run.phase === RunPhase.Upgrade) return;
    run.aimTime -= deltaSeconds;
    if (run.aimTime <= 0) releaseAim(world);
}

/** Where the Prismatic echo stands beside the hero. */
export function readEchoPosition(world: World) {
    const hero = readHeroPosition(world);
    echo.x = hero.x + echoOffsetX;
    echo.z = hero.z + echoOffsetZ;
    return echo;
}

/** Counts each owned weapon's clock down and fires it at the nearest enemy
 *  within 650 units once it runs out. */
export function fireWeapons(world: World, { deltaSeconds }: StepSeconds) {
    countAimDown(world, deltaSeconds);
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    const grid = readGrid(world);
    grid.rebuild(world);
    const hero = readHeroPosition(world);
    const reach = Math.round(650 * readRange(world));
    let target: Placed | null = null;
    let best = u(reach);
    for (const placed of grid.near(
        setAreaAround(hero, u(reach)),
        targetFound,
    )) {
        if ((placed.entity.get(HealthTrait)?.current ?? 0) <= 0) continue;
        const distance = Math.hypot(
            placed.position.x - hero.x,
            placed.position.z - hero.z,
        );
        if (distance < best) {
            best = distance;
            target = placed;
        }
    }
    for (const id of weaponIds) {
        const weapon = run.weapons[id];
        if (!weapon.owned) continue;
        weapon.clock -= deltaSeconds;
        if (weapon.clock > 0 || !target) continue;
        aim.x = target.position.x;
        aim.z = target.position.z;
        fireWeapon(world, {
            id,
            target: aim,
            origin: hero,
            owner: Shooter.Hero,
        });
        if (run.phase !== RunPhase.Playing) return;
        if (run.hasTwin)
            fireWeapon(world, {
                id,
                target: aim,
                origin: readEchoPosition(world),
                owner: Shooter.Echo,
            });
        if (run.phase !== RunPhase.Playing) return;
        weapon.clock = weapon.interval;
    }
}

const bolts = createQuery(BoltTrait, TransformTrait);
const lasers = createQuery(LaserTrait);
const boomerangs = createQuery(BoomerangTrait, TransformTrait);
const novas = createQuery(NovaTrait, TransformTrait);
const mines = createQuery(MineTrait, TransformTrait);

//  The entities a walk found spent, destroyed once the walk ends.
const spent: Entity[] = [];
const stepFrom = new Vector3();

const boltColors: Record<BoltKind, string> = {
    pulse: "#d0f8a9",
    shard: "#d7c4ff",
    zap: "#b8fff4",
};

const boltWeapons: Record<BoltKind, WeaponId> = {
    pulse: WeaponId.Pulse,
    shard: WeaponId.Shard,
    zap: WeaponId.Zap,
};

/** Flies every shot the weapons fired and lands its hits. */
export function flyShots(world: World, { deltaSeconds }: StepSeconds) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    const grid = readGrid(world);
    readEach(world, bolts, ([bolt, position], entity) => {
        if (run.phase !== RunPhase.Playing) return;
        stepFrom.copy(position);
        position.x += bolt.vx * deltaSeconds;
        position.z += bolt.vz * deltaSeconds;
        bolt.life -= deltaSeconds;
        area.from.copy(stepFrom);
        area.to.copy(position);
        area.pad = u(7);
        let struck: Placed | null = null;
        let nearest = Infinity;
        for (const placed of grid.near(area, pathFound)) {
            if ((placed.entity.get(HealthTrait)?.current ?? 0) <= 0) continue;
            if (bolt.hit.includes(placed.entity)) continue;
            if (
                measureSegmentDistance(placed.position, area) >=
                placed.enemy.radius + u(7)
            )
                continue;
            const distance = placed.position.distanceTo(stepFrom);
            if (distance < nearest) {
                nearest = distance;
                struck = placed;
            }
        }
        if (struck) {
            hitEnemy(world, struck, {
                amount: bolt.damage,
                color: boltColors[bolt.kind],
                weapon: boltWeapons[bolt.kind],
            });
            if (bolt.kind === BoltKind.Zap) {
                bolt.hit.push(struck.entity);
                bounceZap(world, bolt, struck);
            }
            bolt.life = 0;
        }
        if (bolt.life <= 0) spent.push(entity);
    });
    readEach(world, lasers, ([laser], entity) => {
        laser.life -= deltaSeconds;
        if (laser.life <= 0) spent.push(entity);
    });
    const hero = readHeroPosition(world);
    readEach(world, boomerangs, ([boomerang, position], entity) => {
        if (run.phase !== RunPhase.Playing) return;
        boomerang.age += deltaSeconds;
        boomerang.life -= deltaSeconds;
        if (boomerang.age >= 0.65 && !boomerang.returning) {
            boomerang.returning = true;
            boomerang.hits.length = 0;
        }
        stepFrom.copy(position);
        if (boomerang.returning) {
            const owner =
                boomerang.owner === Shooter.Echo
                    ? readEchoPosition(world)
                    : hero;
            const dx = owner.x - position.x;
            const dz = owner.z - position.z;
            const distance = Math.hypot(dx, dz);
            if (distance < Math.max(u(18), u(560) * deltaSeconds)) {
                spent.push(entity);
                return;
            }
            boomerang.vx = (dx / distance) * u(560);
            boomerang.vz = (dz / distance) * u(560);
        }
        position.x += boomerang.vx * deltaSeconds;
        position.z += boomerang.vz * deltaSeconds;
        area.from.copy(stepFrom);
        area.to.copy(position);
        area.pad = u(14);
        for (const placed of grid.near(area, pathFound)) {
            if ((placed.entity.get(HealthTrait)?.current ?? 0) <= 0) continue;
            if (boomerang.hits.includes(placed.entity)) continue;
            if (
                measureSegmentDistance(placed.position, area) >=
                placed.enemy.radius + u(14)
            )
                continue;
            hitEnemy(world, placed, {
                amount: boomerang.damage,
                color: "#ffc589",
                weapon: WeaponId.Boomerang,
            });
            if (run.phase !== RunPhase.Playing) return;
            boomerang.hits.push(placed.entity);
        }
        if (boomerang.life <= 0) spent.push(entity);
    });
    readEach(world, novas, ([nova, position], entity) => {
        if (run.phase !== RunPhase.Playing) return;
        const previous = nova.radius;
        nova.radius = Math.min(
            nova.max,
            nova.radius + (nova.max / 0.55) * deltaSeconds,
        );
        nova.life -= deltaSeconds;
        for (const placed of grid.near(
            setAreaAround(position, nova.radius),
            pathFound,
        )) {
            if ((placed.entity.get(HealthTrait)?.current ?? 0) <= 0) continue;
            if (nova.hits.includes(placed.entity)) continue;
            const distance = Math.hypot(
                placed.position.x - position.x,
                placed.position.z - position.z,
            );
            const radius = placed.enemy.radius;
            if (distance > nova.radius + radius) continue;
            if (distance < previous - radius - u(8)) continue;
            hitEnemy(world, placed, {
                amount: nova.damage,
                color: "#9ad7ff",
                weapon: WeaponId.Nova,
            });
            if (run.phase !== RunPhase.Playing) return;
            nova.hits.push(placed.entity);
        }
        if (nova.life <= 0 || nova.radius >= nova.max + u(8))
            spent.push(entity);
    });
    readEach(world, mines, ([mine, position], entity) => {
        if (run.phase !== RunPhase.Playing) return;
        mine.life -= deltaSeconds;
        mine.arm -= deltaSeconds;
        if (!mine.spent) {
            const near = grid.near(
                setAreaAround(position, mine.radius),
                blastFound,
            );
            const tripped =
                mine.life <= 0 ||
                (mine.arm <= 0 &&
                    near.some(
                        (placed) =>
                            Math.hypot(
                                placed.position.x - position.x,
                                placed.position.z - position.z,
                            ) < mine.radius,
                    ));
            if (tripped) {
                mine.spent = true;
                mine.life = 0.16;
                for (const placed of near) {
                    if ((placed.entity.get(HealthTrait)?.current ?? 0) <= 0)
                        continue;
                    const distance = Math.hypot(
                        placed.position.x - position.x,
                        placed.position.z - position.z,
                    );
                    if (distance < mine.radius + placed.enemy.radius)
                        hitEnemy(world, placed, {
                            amount: mine.damage,
                            color: "#ffd0ea",
                            weapon: WeaponId.Mine,
                        });
                    if (run.phase !== RunPhase.Playing) return;
                }
                throwSparks(world, {
                    x: position.x,
                    z: position.z,
                    color: "#ffd0ea",
                    count: 14,
                });
            }
        }
        if (mine.life <= 0) spent.push(entity);
    });
    for (const entity of spent) if (entity.isAlive()) entity.destroy();
    spent.length = 0;
}
