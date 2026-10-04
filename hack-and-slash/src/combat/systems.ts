import {
    dealDamage,
    requireAuthority,
    definePlugin,
    findPlayerHero,
    HealthTrait,
    MovementTrait,
    RunContext,
    TransformTrait,
    VelocityTrait,
    type System,
} from "@spawnite/engine";
import { createQuery, Not, type Entity, type World } from "koota";
import {
    addItem,
    deriveHero,
    dodgeStamina,
    healHero,
    gainGold,
    gainXp,
    takePotion,
    useProgress,
    type ActiveSkillId,
} from "../hero/progress";
import { readClasses } from "../classes/catalog";
import { activeDamage } from "../classes/describe";
import { cueMoves, type CueDef } from "../classes/schema";
import { rankOf } from "../hero/jobs";
import { elements } from "../monsters/kinds";
import {
    burnSeconds,
    itemDef,
    itemIds,
    poisonSeconds,
    rarities,
    rarityNames,
    rollDrops,
    type WeaponKind,
    weaponKinds,
    rolledMods,
    rollRarity,
} from "../items/items";
import { burstHazard, smolder } from "./motes";
import { goldLoot, LootTrait } from "../items/traits";
import { countRespawns, markSlain, slotKind } from "../monsters/spawns";
import {
    attackLands,
    attackLength,
    BossStateTrait,
    MonsterTrait,
    MonsterMode,
    MonsterStateTrait,
} from "../monsters/traits";
import { punchCamera, shakeCamera } from "../view/cameraFx";
import { aim } from "./aim";
import {
    castBossSkills,
    clearBossHazards,
    clearHazards,
    fireHazards,
    inside,
} from "./boss";
import { hurtHero } from "./hurt";
import { useBattle } from "./battle";
import {
    ArrowTrait,
    BurstTrait,
    FloatKind,
    FloatTextTrait,
    HazardShape,
    HeroCombatTrait,
    SlashTrait,
} from "./traits";

//  The fight, one fixed step at a time: the hero's stats and potions, her
//  attacks, the arrows, the monsters' hunt and lunge, the loot, and the
//  effects' lifetimes.

/** Metres a sword swing reaches past the hero's middle, and the half of
 *  its arc either side of the aim. */
export const swordReach = 2.1;
export const swordHalfArc = (65 * Math.PI) / 180;
/** Metres above her feet her middle is, where she swings and shoots. */
export const heroMiddle = 0.75;
/** Metres a second a crossbow's bolt flies, and the metres it flies before
 *  it drops: its range, fixed, whatever it is aimed at. */
export const boltSpeed = 20;
export const boltRange = 11;
/** Radians apart the bolts of a multishot fan. */
const boltFan = 0.14;
/** Metres a ricochet looks for its next monster in, and the share of its
 *  damage a bolt keeps each bounce. */
const ricochetReach = 7;
const ricochetKeeps = 0.8;
/** Metres from an arrow's line a monster's side may be and still be hit. */
const arrowSlack = 0.2;
/** Metres a second a hit knocks a monster back, and for how long. */
const knockSpeed = 6;
const knockSeconds = 0.14;
const hitFlashSeconds = 0.12;
/** A chase gives up once the monster is this many times its aggro range
 *  from where the chase began. */
const leashTimes = 2;
/** How much faster than its chase a monster walks home, and the metres
 *  from its spawn point at which it is home. */
const homeSpeed = 1.4;
const homeReach = 0.3;
const heroRadius = 0.35;
/** Metres between the two sides at which a monster starts its lunge, and
 *  at which the lunge still lands. */
const lungeStart = 0.55;
const lungeHits = 1;
/** Seconds between the end of one attack and the start of the next. */
const attackRest = 1;
/** Seconds a monster's lunge is put off when a hit knocks it out of one. */
const interruptRest = 0.5;
/** Share of her maximum health the hero heals a second. */
const regenShare = 0.015;
/** Seconds between two potions. */
const potionRest = 0.8;
/** Seconds loot flies out for, then waits on the ground, and metres from
 *  her at which she picks it up. */
const lootPopSeconds = 0.35;
const lootSeconds = 60;
const lootReach = 1.1;
/** Seconds an effect lasts. */
export const slashSeconds = 0.18;
export const floatSeconds = 0.9;
export const burstSeconds = 0.35;

const freshMonsters = createQuery(MonsterTrait, Not(MonsterStateTrait));
const monsters = createQuery(
    MonsterTrait,
    MonsterStateTrait,
    TransformTrait,
    HealthTrait,
);
const steeredMonsters = createQuery(
    MonsterTrait,
    MonsterStateTrait,
    TransformTrait,
    VelocityTrait,
    HealthTrait,
);

function distance(ax: number, az: number, bx: number, bz: number) {
    return Math.hypot(ax - bx, az - bz);
}

/** Gives each new monster its state, with no wander chosen yet. */
const prepareMonsters: System = (world) => {
    for (const monster of world.query(freshMonsters)) {
        monster.add(MonsterStateTrait);
        if (monster.get(MonsterTrait)!.boss) monster.add(BossStateTrait);
    }
};

let potionWait = 0;

/** Lays the hero's stats on her body: her speed, her maximum health, her
 *  slow heal, and a potion when one is asked for. Writes her height for the
 *  aim. */
const applyHeroStats: System = (world, { deltaSeconds }) => {
    const hero = findPlayerHero(world);
    const at = hero?.get(TransformTrait);
    if (!hero || !at) return;
    if (!hero.has(HeroCombatTrait)) hero.add(HeroCombatTrait);
    aim.heroY = at.y;
    const derived = deriveHero(useProgress.getState());
    const movement = hero.get(MovementTrait);
    if (movement && Math.abs(movement.speed - derived.moveSpeed) > 1e-3)
        hero.set(MovementTrait, { speed: derived.moveSpeed });
    const flash = hero.get(HeroCombatTrait)!.flash;
    if (flash > 0)
        hero.set(HeroCombatTrait, { flash: Math.max(0, flash - deltaSeconds) });
    const health = hero.get(HealthTrait);
    if (!health || useBattle.getState().defeated) {
        aim.potion = false;
        return;
    }
    //  A higher maximum, from a level, a point in VIT or new gear, comes
    //  with the health to fill it.
    const gained = Math.max(0, derived.maxHealth - health.maximum);
    let current = Math.min(
        derived.maxHealth,
        health.current + gained + derived.maxHealth * regenShare * deltaSeconds,
    );
    potionWait = Math.max(0, potionWait - deltaSeconds);
    if (aim.potion) {
        aim.potion = false;
        const heal =
            potionWait <= 0 && current < derived.maxHealth ? takePotion() : 0;
        if (heal > 0) {
            potionWait = potionRest;
            current = Math.min(derived.maxHealth, current + heal);
            world.spawn(
                FloatTextTrait({
                    x: at.x,
                    y: at.y + 1.6,
                    z: at.z,
                    amount: heal,
                    kind: FloatKind.Heal,
                }),
            );
        }
    }
    //  Only on a change: a write wakes every reader of her health, the
    //  HUD's bars among them, and at full health nothing changes.
    if (current !== health.current || derived.maxHealth !== health.maximum)
        hero.set(HealthTrait, { maximum: derived.maxHealth, current });
};

/** Swings or shoots toward the pointer while the attack is held, once per
 *  the hero's attack time, and once for a press that let go already. With
 *  mixed arms she slashes the nearest monster in a sword's reach, and
 *  shoots toward the pointer when none is. */
const attack: System = (world, { deltaSeconds }) => {
    const hero = findPlayerHero(world);
    const at = hero?.get(TransformTrait);
    if (!hero || !at || !hero.has(HeroCombatTrait)) return;
    const combat = hero.get(HeroCombatTrait)!;
    const { dodge, spin } = combat;
    let { cooldown, sinceAttack, dirX, dirZ, hand, attackKind, attackHand } =
        combat;
    cooldown = Math.max(0, cooldown - deltaSeconds);
    sinceAttack += deltaSeconds;
    const wants = aim.held || aim.pressed;
    //  Not mid-dodge or mid-spin: a press waits for it to end.
    if (
        wants &&
        cooldown <= 0 &&
        dodge <= 0 &&
        spin <= 0 &&
        !useBattle.getState().defeated
    ) {
        aim.pressed = false;
        const derived = deriveHero(useProgress.getState());
        const near = derived.offWeapon
            ? nearestInReach(world, at.x, at.z)
            : null;
        const kind: WeaponKind = derived.offWeapon
            ? near
                ? "sword"
                : "crossbow"
            : derived.weapon;
        const strikeNow =
            kind === derived.weapon ? derived : derived.offStrike!;
        const target =
            near ??
            (aim.auto
                ? autoAim(world, hero, at.x, at.z, kind)
                : aim.known
                  ? { x: aim.x, z: aim.z }
                  : null);
        if (target) {
            const toX = target.x - at.x;
            const toZ = target.z - at.z;
            const length = Math.hypot(toX, toZ);
            if (length > 1e-3) {
                dirX = toX / length;
                dirZ = toZ / length;
            }
        }
        //  The hand it is made with: in turn with two of a kind, else the
        //  hand that holds that kind.
        attackHand = derived.dual ? hand : kind === derived.weapon ? 0 : 1;
        attackKind = weaponKinds.indexOf(kind);
        const y = at.y + heroMiddle;
        if (kind === "sword")
            swingSword(world, at.x, y, at.z, dirX, dirZ, strikeNow.damage);
        else
            looseBolts(world, {
                x: at.x,
                y,
                z: at.z,
                dirX,
                dirZ,
                side: attackHand === 1 ? -1 : 1,
                count: 1 + strikeNow.multishot,
                fan: boltFan,
                damage: strikeNow.damage,
                pierce: strikeNow.pierce,
                ricochet: strikeNow.ricochet,
            });
        if (derived.dual) hand = 1 - hand;
        cooldown = 1 / strikeNow.attacksPerSecond;
        sinceAttack = 0;
    }
    hero.set(HeroCombatTrait, {
        cooldown,
        sinceAttack,
        dirX,
        dirZ,
        hand,
        attackKind,
        attackHand,
    });
};

/** Bolts loosed together: from her middle at (x, y, z), out of her right
 *  hand (`side` 1) or her left (-1), `count` of them fanned `fan` radians
 *  apart about the way (dirX, dirZ), each with its damage, pierce and
 *  ricochet. */
type Volley = {
    x: number;
    y: number;
    z: number;
    dirX: number;
    dirZ: number;
    side: number;
    count: number;
    fan: number;
    damage: number;
    pierce: number;
    ricochet: number;
};

function looseBolts(world: World, volley: Volley) {
    const { x, y, z, dirX, dirZ, side, count, fan } = volley;
    const fromX = x + dirX * 0.4 - dirZ * 0.22 * side;
    const fromZ = z + dirZ * 0.4 + dirX * 0.22 * side;
    for (let bolt = 0; bolt < count; bolt++) {
        const turn = (bolt - (count - 1) / 2) * fan;
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        world.spawn(
            ArrowTrait({
                x: fromX,
                y,
                z: fromZ,
                dirX: dirX * cos - dirZ * sin,
                dirZ: dirX * sin + dirZ * cos,
                damage: volley.damage,
                pierce: volley.pierce,
                ricochet: volley.ricochet,
            }),
        );
    }
}

//  Written in place by `nearestInReach`.
const reachTarget = { x: 0, z: 0 };

/** The nearest living monster a sword's slash from (x, z) reaches, its
 *  body counted; null for none. */
function nearestInReach(world: World, x: number, z: number) {
    let best = Infinity;
    for (const monster of world.query(monsters)) {
        if (monster.get(HealthTrait)!.current <= 0) continue;
        const position = monster.get(TransformTrait)!;
        const apart = distance(x, z, position.x, position.z);
        if (
            apart <= swordReach + monster.get(MonsterTrait)!.radius &&
            apart < best
        ) {
            best = apart;
            reachTarget.x = position.x;
            reachTarget.z = position.z;
        }
    }
    return best < Infinity ? reachTarget : null;
}

/** Metres a tap's attack looks for a monster in, by weapon: a step past
 *  the sword's reach, and a bolt's whole flight. */
const autoAimReach: Record<WeaponKind, number> = {
    sword: swordReach + 2,
    crossbow: boltRange,
};

/** Where a tap's attack aims: the nearest living monster in reach, else
 *  ahead of her as she walks, else nowhere, which keeps her last aim. */
function autoAim(
    world: World,
    hero: Entity,
    x: number,
    z: number,
    weapon: WeaponKind,
) {
    let nearest: { x: number; z: number } | null = null;
    let best = autoAimReach[weapon];
    for (const monster of world.query(monsters)) {
        if (monster.get(HealthTrait)!.current <= 0) continue;
        const position = monster.get(TransformTrait)!;
        const apart = distance(x, z, position.x, position.z);
        if (apart < best) {
            best = apart;
            nearest = { x: position.x, z: position.z };
        }
    }
    if (nearest) return nearest;
    const velocity = hero.get(VelocityTrait);
    if (velocity && Math.hypot(velocity.x, velocity.z) > 0.3)
        return { x: x + velocity.x, z: z + velocity.z };
    return null;
}

/** Hits every monster in the arc before the hero, and draws the arc. */
function swingSword(
    world: World,
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    damage: number,
) {
    world.spawn(SlashTrait({ x, y, z, dirX, dirZ }));
    const cosHalfArc = Math.cos(swordHalfArc);
    for (const monster of world.query(monsters)) {
        const position = monster.get(TransformTrait)!;
        const { radius } = monster.get(MonsterTrait)!;
        const toX = position.x - x;
        const toZ = position.z - z;
        const apart = Math.hypot(toX, toZ);
        if (apart > swordReach + radius) continue;
        //  One standing on her is hit whichever way she faces.
        const inArc =
            apart < radius + heroRadius ||
            (toX * dirX + toZ * dirZ) / apart >= cosHalfArc;
        if (inArc) strike(world, monster, damage, x, z);
    }
}

/** Takes `damage`, give or take 15%, off a living monster, as a critical
 *  hit at her chance of one, flashes it, knocks it back from (fromX,
 *  fromZ) out of any lunge it was winding up, and slays it at zero. */
function strike(
    world: World,
    monster: Entity,
    damage: number,
    fromX: number,
    fromZ: number,
) {
    const health = monster.get(HealthTrait);
    if (!health || health.current <= 0) return false;
    const { critChance, critDamage, poison, burn, leech } = deriveHero(
        useProgress.getState(),
    );
    const critical = Math.random() < critChance;
    const dealt = Math.max(
        1,
        Math.round(
            damage * (0.85 + Math.random() * 0.3) * (critical ? critDamage : 1),
        ),
    );
    dealDamage(requireAuthority(world), monster, {
        amount: dealt,
        source: findPlayerHero(world),
    });
    const position = monster.get(TransformTrait)!;
    const awayX = position.x - fromX;
    const awayZ = position.z - fromZ;
    const away = Math.hypot(awayX, awayZ) || 1;
    const state = monster.get(MonsterStateTrait)!;
    //  A boss is too heavy to knock back or out of its lunge.
    const heavy = monster.get(MonsterTrait)!.boss;
    monster.set(MonsterStateTrait, {
        flash: hitFlashSeconds,
        ...(heavy
            ? {}
            : {
                  knockX: (awayX / away) * knockSpeed,
                  knockZ: (awayZ / away) * knockSpeed,
                  knockSeconds,
              }),
        //  A hit before the lunge lands knocks it out of the lunge.
        ...(!heavy && state.attack >= 0 && state.attack < attackLands
            ? { attack: -1, attackCooldown: interruptRest }
            : {}),
        //  Her gear's poison and burn take hold, or start over.
        ...(poison > 0
            ? {
                  poison: Math.max(state.poison, poison),
                  poisonLeft: poisonSeconds,
              }
            : {}),
        ...(burn > 0
            ? { burn: Math.max(state.burn, burn), burnLeft: burnSeconds }
            : {}),
    });
    if (leech > 0) healHero(world, dealt * leech);
    //  A hit angers any monster, passive or on its way home.
    if (state.mode !== MonsterMode.Hunt && health.current - dealt > 0)
        startHunt(world, monster, position.x, position.y, position.z);
    if (roomForNumbers(world))
        world.spawn(
            FloatTextTrait({
                x: position.x,
                y: position.y + 1.2,
                z: position.z,
                amount: dealt,
                kind: critical ? FloatKind.Crit : FloatKind.Hit,
            }),
        );
    shakeCamera(critical ? 0.1 : 0.05);
    if (health.current - dealt <= 0) slay(world, monster);
    return true;
}

/** The most numbers afloat at once. Past it a hit's or a bite's number is
 *  left out, the fight going on as ever, so a very fast fight neither
 *  buries the screen in numbers nor spends the frame drawing them; the
 *  experience, the loot and the alarms always show. */
const numbersMost = 36;

function roomForNumbers(world: World) {
    return world.query(floats).length < numbersMost;
}

/** Seconds between the bites of a poison or a burn. */
const afflictEvery = 0.5;

/** Poison and burns eating at the monsters her gear afflicted: each bites
 *  every half second for its share of its damage a second, in its colour,
 *  and smoulders about the monster until it wears off. */
const afflict: System = (world, { deltaSeconds }) => {
    for (const monster of world.query(monsters)) {
        const state = monster.get(MonsterStateTrait)!;
        if (state.poisonLeft <= 0 && state.burnLeft <= 0) continue;
        const health = monster.get(HealthTrait)!;
        const position = monster.get(TransformTrait)!;
        const { radius } = monster.get(MonsterTrait)!;
        const poisoned = state.poisonLeft > 0;
        const burning = state.burnLeft > 0;
        let tick = state.afflictTick - deltaSeconds;
        if (tick <= 0 && health.current > 0) {
            tick += afflictEvery;
            const bite = Math.max(
                1,
                Math.round(
                    ((poisoned ? state.poison : 0) +
                        (burning ? state.burn : 0)) *
                        afflictEvery,
                ),
            );
            dealDamage(requireAuthority(world), monster, {
                amount: bite,
                source: findPlayerHero(world),
            });
            if (roomForNumbers(world))
                world.spawn(
                    FloatTextTrait({
                        x: position.x + (Math.random() - 0.5) * 0.6,
                        y: position.y + 1,
                        z: position.z,
                        amount: bite,
                        kind: burning ? FloatKind.Burn : FloatKind.Poison,
                    }),
                );
            if (health.current - bite <= 0) slay(world, monster);
        }
        if (burning)
            smolder(
                position.x,
                position.y,
                position.z,
                radius,
                true,
                deltaSeconds,
            );
        if (poisoned)
            smolder(
                position.x,
                position.y,
                position.z,
                radius,
                false,
                deltaSeconds,
            );
        const poisonLeft = Math.max(0, state.poisonLeft - deltaSeconds);
        const burnLeft = Math.max(0, state.burnLeft - deltaSeconds);
        monster.set(MonsterStateTrait, {
            poisonLeft,
            burnLeft,
            afflictTick: poisonLeft > 0 || burnLeft > 0 ? tick : 0,
            ...(poisonLeft <= 0 ? { poison: 0 } : {}),
            ...(burnLeft <= 0 ? { burn: 0 } : {}),
        });
    }
};

/** Credits a slain monster's experience, drops its loot, and frees its
 *  slot to respawn. The health step reaps it on the next step. */
function slay(world: World, monster: Entity) {
    const { xp, slot, radius, boss } = monster.get(MonsterTrait)!;
    const { x, y, z } = monster.get(TransformTrait)!;
    const kind = slotKind(slot);
    markSlain(slot);
    shakeCamera(boss ? 0.3 : 0.09);
    punchCamera(boss ? 0.12 : 0.035);
    //  What a slain boss still had coming goes with it.
    if (boss) clearBossHazards(world, slot);
    world.spawn(BurstTrait({ x, y, z, size: radius * 2.5 }));
    world.spawn(
        FloatTextTrait({ x, y: y + 1.7, z, amount: xp, kind: FloatKind.Xp }),
    );
    if (kind) {
        const drops = rollDrops(kind);
        dropLoot(world, x, y, z, goldLoot, drops.gold);
        for (const item of drops.items)
            dropLoot(
                world,
                x,
                y,
                z,
                itemIds.indexOf(item),
                0,
                rarities.indexOf(rollRarity(item, boss)),
            );
    }
    const levels = gainXp(xp);
    if (levels > 0) {
        const hero = findPlayerHero(world);
        const derived = deriveHero(useProgress.getState());
        hero?.set(HealthTrait, {
            maximum: derived.maxHealth,
            current: derived.maxHealth,
        });
        punchCamera(0.09);
        useBattle.setState(({ levelUps }) => ({ levelUps: levelUps + 1 }));
    }
}

/** The most loot on the ground at once. A fight fast enough to leave more
 *  sends the oldest piece straight to her instead, gold into her purse and
 *  an item into her bag if it has room, so the ground never fills with
 *  pieces to draw. */
const lootMost = 60;
/** Metres from a pile within which a drop of the same joins it. */
const pileReach = 1.6;

/** Takes the oldest piece of loot on the ground straight to her. */
function collectOldest(world: World) {
    let oldest: Entity | undefined;
    let age = -1;
    for (const piece of world.query(loot)) {
        const drop = piece.get(LootTrait)!;
        if (drop.age > age) {
            age = drop.age;
            oldest = piece;
        }
    }
    if (!oldest) return;
    const drop = oldest.get(LootTrait)!;
    if (drop.item === goldLoot) gainGold(drop.gold);
    else {
        const id = itemIds[drop.item];
        for (let one = 0; one < drop.count; one++)
            addItem(id, rolledMods(id, rarities[drop.rarity] ?? "common"));
    }
    oldest.destroy();
}

/** Throws one piece of loot out of (x, z) a random way. */
function dropLoot(
    world: World,
    x: number,
    y: number,
    z: number,
    item: number,
    gold: number,
    rarity = 0,
) {
    //  Onto a pile of the same near where it falls, if there is one: gold
    //  adds up, an item of the same kind and rarity counts one more, and
    //  the pile's time on the ground starts over.
    for (const piece of world.query(loot)) {
        const pile = piece.get(LootTrait)!;
        if (pile.item !== item || pile.rarity !== rarity) continue;
        if (distance(pile.x, pile.z, x, z) > pileReach) continue;
        piece.set(LootTrait, {
            gold: pile.gold + gold,
            count: pile.count + (item === goldLoot ? 0 : 1),
            age: Math.min(pile.age, lootPopSeconds),
        });
        return;
    }
    if (world.query(loot).length >= lootMost) collectOldest(world);
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 2;
    world.spawn(
        LootTrait({
            x,
            y,
            z,
            item,
            gold,
            rarity,
            popX: Math.cos(angle) * speed,
            popZ: Math.sin(angle) * speed,
        }),
    );
}

const arrows = createQuery(ArrowTrait);

/** Flies each arrow along its line; it stops in the first monster it meets
 *  or at the end of its range. */
const flyArrows: System = (world, { deltaSeconds }) => {
    for (const arrow of world.query(arrows)) {
        const flight = arrow.get(ArrowTrait)!;
        flight.x += flight.dirX * boltSpeed * deltaSeconds;
        flight.z += flight.dirZ * boltSpeed * deltaSeconds;
        flight.age += deltaSeconds;
        let spent = flight.age * boltSpeed >= boltRange;
        if (!spent) {
            for (const monster of world.query(monsters)) {
                if (monster.id() === flight.lastHit) continue;
                const position = monster.get(TransformTrait)!;
                const { radius } = monster.get(MonsterTrait)!;
                if (
                    distance(position.x, position.z, flight.x, flight.z) >
                    radius + arrowSlack
                )
                    continue;
                //  From behind the bolt, so the knock follows its flight.
                if (
                    !strike(
                        world,
                        monster,
                        flight.damage,
                        flight.x - flight.dirX,
                        flight.z - flight.dirZ,
                    )
                )
                    continue;
                flight.lastHit = monster.id();
                //  Through it to the next, or bounced on to the nearest
                //  other within reach, a new flight from there; else done.
                if (flight.pierce > 0) flight.pierce -= 1;
                else if (
                    flight.ricochet > 0 &&
                    bounce(world, flight, monster, position.x, position.z)
                )
                    flight.ricochet -= 1;
                else spent = true;
                break;
            }
        }
        if (spent) arrow.destroy();
        else arrow.set(ArrowTrait, flight);
    }
};

/** Turns a bolt from the monster it struck at (x, z) toward the nearest
 *  other living monster within reach, weaker for the bounce. False with
 *  none there. */
function bounce(
    world: World,
    flight: {
        x: number;
        z: number;
        dirX: number;
        dirZ: number;
        age: number;
        damage: number;
    },
    struck: Entity,
    x: number,
    z: number,
) {
    let best = ricochetReach;
    let toX = 0;
    let toZ = 0;
    for (const monster of world.query(monsters)) {
        if (monster === struck || monster.get(HealthTrait)!.current <= 0)
            continue;
        const position = monster.get(TransformTrait)!;
        const apart = distance(x, z, position.x, position.z);
        if (apart < best && apart > 1e-3) {
            best = apart;
            toX = (position.x - x) / apart;
            toZ = (position.z - z) / apart;
        }
    }
    if (best >= ricochetReach) return false;
    flight.x = x;
    flight.z = z;
    flight.dirX = toX;
    flight.dirZ = toZ;
    flight.age = 0;
    flight.damage *= ricochetKeeps;
    return true;
}

/** A red "!" over a monster turning on the hero, so the player sees what
 *  she has woken. */
function alertAt(world: World, x: number, y: number, z: number) {
    world.spawn(
        FloatTextTrait({ x, y: y + 1.5, z, text: "!", kind: FloatKind.Alert }),
    );
}

/** Turns a monster on the hero from where it stands. */
function startHunt(
    world: World,
    monster: Entity,
    x: number,
    y: number,
    z: number,
) {
    monster.set(MonsterStateTrait, {
        mode: MonsterMode.Hunt,
        chaseX: x,
        chaseZ: z,
    });
    alertAt(world, x, y, z);
}

/** After the engine's chase, which points every monster at the hero. A
 *  roaming monster wanders its area; an aggressive one turns on a hero who
 *  comes within its aggro range, and any monster turns on one who hits it.
 *  A hunting monster chases her and lunges beside her, until it is twice
 *  its aggro range from where the chase began: then it walks home to where
 *  it spawned, deaf to her on the way, and heals there. A hit knocks it
 *  back whatever it is doing. */
const huntHero: System = (world, { deltaSeconds }) => {
    const hero = findPlayerHero(world);
    const heroAt = hero?.get(TransformTrait);
    const defeated = useBattle.getState().defeated;
    world
        .query(steeredMonsters)
        .updateEach(([monster, state, position, velocity, health]) => {
            if (health.current <= 0) {
                velocity.set(0, 0, 0);
                return;
            }
            state.flash = Math.max(0, state.flash - deltaSeconds);
            state.attackCooldown = Math.max(
                0,
                state.attackCooldown - deltaSeconds,
            );
            const toHero = heroAt
                ? distance(heroAt.x, heroAt.z, position.x, position.z)
                : Infinity;
            if (
                state.mode === MonsterMode.Roam &&
                monster.aggressive &&
                !defeated &&
                toHero <= monster.aggroRange
            ) {
                //  In place, as the step writes this state back after.
                state.mode = MonsterMode.Hunt;
                state.chaseX = position.x;
                state.chaseZ = position.z;
                alertAt(world, position.x, position.y, position.z);
            }
            if (
                state.mode === MonsterMode.Hunt &&
                (defeated ||
                    !heroAt ||
                    distance(
                        position.x,
                        position.z,
                        state.chaseX,
                        state.chaseZ,
                    ) >
                        monster.aggroRange * leashTimes)
            ) {
                state.mode = MonsterMode.Return;
                state.attack = -1;
            }
            const sides = toHero - monster.radius - heroRadius;

            if (state.attack >= 0) {
                //  The lunge plays out in place, and lands once.
                const before = state.attack;
                state.attack += deltaSeconds;
                velocity.set(0, 0, 0);
                if (
                    before < attackLands &&
                    state.attack >= attackLands &&
                    hero &&
                    !defeated &&
                    sides <= lungeHits
                )
                    hurtHero(world, hero, monster.damage);
                if (state.attack >= attackLength) {
                    state.attack = -1;
                    state.attackCooldown = attackRest;
                }
            } else if (state.knockSeconds > 0) {
                state.knockSeconds -= deltaSeconds;
                velocity.set(state.knockX, 0, state.knockZ);
            } else if (state.mode === MonsterMode.Return) {
                const toX = monster.homeX - position.x;
                const toZ = monster.homeZ - position.z;
                const left = Math.hypot(toX, toZ);
                if (left <= homeReach) {
                    //  Home: calm, and whole again.
                    state.mode = MonsterMode.Roam;
                    state.wanderSeconds = 0;
                    health.current = health.maximum;
                    velocity.set(0, 0, 0);
                } else {
                    const pace = monster.speed * homeSpeed;
                    velocity.set((toX / left) * pace, 0, (toZ / left) * pace);
                }
            } else if (state.mode === MonsterMode.Hunt && heroAt) {
                if (sides <= lungeStart && state.attackCooldown <= 0) {
                    state.attack = 0;
                    state.lungeX = (heroAt.x - position.x) / (toHero || 1);
                    state.lungeZ = (heroAt.z - position.z) / (toHero || 1);
                    velocity.set(0, 0, 0);
                }
                //  Otherwise the chase's velocity carries it to her.
            } else {
                wander(monster, state, position.x, position.z, deltaSeconds);
                const toX = state.wanderX - position.x;
                const toZ = state.wanderZ - position.z;
                const left = Math.hypot(toX, toZ);
                const pace = monster.speed * 0.4;
                if (left > 0.3)
                    velocity.set((toX / left) * pace, 0, (toZ / left) * pace);
                else velocity.set(0, 0, 0);
            }
        });
};

/** Picks where to stroll every few seconds: a pause where it stands, or a
 *  point inside its area, so one that strayed walks home. */
function wander(
    area: { areaX: number; areaZ: number; areaRadius: number },
    state: { wanderX: number; wanderZ: number; wanderSeconds: number },
    x: number,
    z: number,
    deltaSeconds: number,
) {
    state.wanderSeconds -= deltaSeconds;
    if (state.wanderSeconds > 0) return;
    state.wanderSeconds = 1.5 + Math.random() * 2.5;
    const strayed =
        distance(x, z, area.areaX, area.areaZ) > area.areaRadius * 0.8;
    if (!strayed && Math.random() < 0.35) {
        state.wanderX = x;
        state.wanderZ = z;
        return;
    }
    const angle = Math.random() * Math.PI * 2;
    const reach = Math.sqrt(Math.random()) * area.areaRadius * 0.8;
    state.wanderX = area.areaX + Math.cos(angle) * reach;
    state.wanderZ = area.areaZ + Math.sin(angle) * reach;
}

const loot = createQuery(LootTrait);

/** Flies new loot out, then waits for the hero to walk over it: gold goes
 *  to her purse and an item to her bag, while it has a place. Loot left
 *  long enough fades away. */
const gatherLoot: System = (world, { deltaSeconds }) => {
    const hero = findPlayerHero(world);
    const heroAt = hero?.get(TransformTrait);
    for (const piece of world.query(loot)) {
        const drop = piece.get(LootTrait)!;
        drop.age += deltaSeconds;
        if (drop.age < lootPopSeconds) {
            drop.x += drop.popX * deltaSeconds;
            drop.z += drop.popZ * deltaSeconds;
        } else if (
            heroAt &&
            distance(heroAt.x, heroAt.z, drop.x, drop.z) <= lootReach
        ) {
            const id = itemIds[drop.item];
            //  A pile of items goes into the bag one by one, each rolling
            //  its own bonus stats; what the bag has no room for stays.
            let taken = 0;
            if (drop.item === goldLoot) {
                gainGold(drop.gold);
                taken = 1;
            } else
                while (
                    taken < drop.count &&
                    addItem(
                        id,
                        rolledMods(id, rarities[drop.rarity] ?? "common"),
                    )
                )
                    taken++;
            if (taken > 0) {
                const rare =
                    drop.item !== goldLoot &&
                    drop.rarity > rarities.indexOf(itemDef(id).rarity);
                world.spawn(
                    FloatTextTrait({
                        x: drop.x,
                        y: drop.y + 1.2,
                        z: drop.z,
                        text:
                            drop.item === goldLoot
                                ? `+${drop.gold} gold`
                                : `${rare ? `${rarityNames[rarities[drop.rarity]]} ` : ""}${itemDef(id).name}${taken > 1 ? ` ×${taken}` : ""}`,
                        kind: FloatKind.Loot,
                    }),
                );
                if (drop.item === goldLoot || taken >= drop.count) {
                    piece.destroy();
                    continue;
                }
                drop.count -= taken;
            }
        }
        if (drop.age >= lootSeconds) piece.destroy();
        else piece.set(LootTrait, drop);
    }
};

const slashes = createQuery(SlashTrait);
const floats = createQuery(FloatTextTrait);
const bursts = createQuery(BurstTrait);

/** Ages the effects and ends each at its length. */
const ageEffects: System = (world, { deltaSeconds }) => {
    for (const slash of world.query(slashes)) {
        const age = slash.get(SlashTrait)!.age + deltaSeconds;
        if (age >= slashSeconds) slash.destroy();
        else slash.set(SlashTrait, { age });
    }
    for (const float of world.query(floats)) {
        const age = float.get(FloatTextTrait)!.age + deltaSeconds;
        if (age >= floatSeconds) float.destroy();
        else float.set(FloatTextTrait, { age });
    }
    for (const burst of world.query(bursts)) {
        const age = burst.get(BurstTrait)!.age + deltaSeconds;
        if (age >= burstSeconds) burst.destroy();
        else burst.set(BurstTrait, { age });
    }
};

const respawnMonsters: System = (_world, { deltaSeconds }) =>
    countRespawns(deltaSeconds);

/** The Cyclone: stamina it spins through a second, the least it needs to
 *  start, seconds before it can be cast again, seconds between its rounds
 *  of hits, metres they reach round her, and the share of a swing's
 *  damage each deals. She spins as long as her stamina lasts. */
export const spinDrain = 45;
const spinLeast = 15;
export const spinCooldownSeconds = 15;
const spinEvery = 0.25;
const spinReach = 2.3;
const spinShare = 0.6;

/** Casts the Cyclone asked for, if her gear gives it, it is ready and she
 *  has the stamina; and while it spins, hits every monster round her four
 *  times a second, a slash drawn each time a quarter turn on, as her
 *  stamina runs down. She can walk as she spins, but not attack. */
const cyclone: System = (world, { deltaSeconds }) => {
    const hero = findPlayerHero(world);
    const combat = hero?.get(HeroCombatTrait);
    const at = hero?.get(TransformTrait);
    const asked = aim.skill === "cyclone" ? aim.skill : null;
    if (asked) aim.skill = null;
    if (!hero || !combat || !at) return;
    let { spin, spinCooldown, spinTick, stamina } = combat;
    spinCooldown = Math.max(0, spinCooldown - deltaSeconds);
    const derived = deriveHero(useProgress.getState());
    if (
        asked === "cyclone" &&
        derived.skills.includes("cyclone") &&
        spin <= 0 &&
        spinCooldown <= 0 &&
        combat.dodge <= 0 &&
        stamina >= spinLeast &&
        !useBattle.getState().defeated
    ) {
        spin = stamina / spinDrain;
        spinCooldown = spinCooldownSeconds;
        spinTick = 0;
    }
    if (spin > 0) {
        spin = Math.max(0, spin - deltaSeconds);
        stamina =
            spin > 0 ? Math.max(0, stamina - spinDrain * deltaSeconds) : 0;
        spinTick -= deltaSeconds;
        if (spinTick <= 0) {
            spinTick += spinEvery;
            const angle = (spin / spinEvery) * (Math.PI / 2);
            const y = at.y + heroMiddle;
            world.spawn(
                SlashTrait({
                    x: at.x,
                    y,
                    z: at.z,
                    dirX: Math.sin(angle),
                    dirZ: Math.cos(angle),
                }),
            );
            for (const monster of world.query(monsters)) {
                const position = monster.get(TransformTrait)!;
                const { radius } = monster.get(MonsterTrait)!;
                if (
                    Math.hypot(position.x - at.x, position.z - at.z) <=
                    spinReach + radius
                )
                    strike(
                        world,
                        monster,
                        derived.damage * spinShare,
                        at.x,
                        at.z,
                    );
            }
            shakeCamera(0.04);
        }
    }
    hero.set(HeroCombatTrait, { spin, spinCooldown, spinTick, stamina });
};

/** Seconds left before each tree's skill can be cast again, by its id. */
const skillCooldowns = new Map<string, number>();

/** The share of a skill's cooldown still to run, for the paw's shade:
 *  the Cyclone's from her spin's, a tree skill's from its own. */
export function skillCooldownLeft(id: ActiveSkillId, spinCooldown: number) {
    if (id === "cyclone") return spinCooldown / spinCooldownSeconds;
    const active = readClasses().skills.get(id)?.skill.active;
    const left = skillCooldowns.get(id) ?? 0;
    return active && active.cooldown > 0 ? left / active.cooldown : 0;
}

/** Casts the tree skill asked for, if she knows it, it works with a weapon
 *  she holds, it is ready and she has the stamina: its action, then its
 *  cue. The class editor's preview casts it whatever she knows. */
const castSkills: System = (world, { deltaSeconds }) => {
    for (const [id, left] of skillCooldowns)
        if (left <= deltaSeconds) skillCooldowns.delete(id);
        else skillCooldowns.set(id, left - deltaSeconds);
    const hero = findPlayerHero(world);
    const combat = hero?.get(HeroCombatTrait);
    const at = hero?.get(TransformTrait);
    if (!hero || !combat || !at) return;
    let { stamina, dirX, dirZ, castMove } = combat;
    let castAge = combat.castAge + deltaSeconds;
    const asked = aim.skill;
    const preview = aim.skillPreview;
    const found =
        asked && asked !== "cyclone"
            ? readClasses().skills.get(asked)
            : undefined;
    if (asked && asked !== "cyclone") {
        aim.skill = null;
        aim.skillPreview = false;
    }
    const active = found?.skill.active;
    const progress = useProgress.getState();
    const derived = deriveHero(progress);
    const ready =
        !!found &&
        !!active &&
        !useBattle.getState().defeated &&
        combat.dodge <= 0 &&
        combat.spin <= 0 &&
        (preview ||
            (derived.skills.includes(found.skill.id) &&
                !skillCooldowns.has(found.skill.id) &&
                stamina >= active.stamina));
    if (ready) {
        const { skill } = found;
        const rank = Math.max(preview ? 1 : 0, rankOf(progress, skill.id));
        //  Its weapon's strike: her off hand's with mixed arms, when the
        //  skill is that weapon's.
        const strikeNow =
            skill.weapon !== "any" && skill.weapon === derived.offWeapon
                ? derived.offStrike!
                : derived;
        const damage = strikeNow.damage * activeDamage(active, rank);
        const kind = skill.weapon === "any" ? derived.weapon : skill.weapon;
        const target = aim.auto
            ? autoAim(world, hero, at.x, at.z, kind)
            : aim.known
              ? { x: aim.x, z: aim.z }
              : null;
        if (target) {
            const length = Math.hypot(target.x - at.x, target.z - at.z);
            if (length > 1e-3) {
                dirX = (target.x - at.x) / length;
                dirZ = (target.z - at.z) / length;
            }
        }
        const y = at.y + heroMiddle;
        const fan = (active.fan * Math.PI) / 180;
        //  What it covers, for its hits and its cue's motes.
        const area =
            active.action === "volley"
                ? {
                      shape: HazardShape.Cone,
                      size: Math.min(4, boltRange * 0.35),
                      spread: (fan * (active.count - 1)) / 2 + 0.1,
                  }
                : {
                      shape:
                          active.shape === "cone"
                              ? HazardShape.Cone
                              : HazardShape.Circle,
                      size: active.reach,
                      spread: (active.spread * Math.PI) / 180,
                  };
        const covers = { ...area, x: at.x, z: at.z, dirX, dirZ, inner: 0 };
        if (active.action === "volley")
            looseBolts(world, {
                x: at.x,
                y,
                z: at.z,
                dirX,
                dirZ,
                side: 1,
                count: active.count,
                fan,
                damage,
                pierce: strikeNow.pierce,
                ricochet: strikeNow.ricochet,
            });
        else
            for (const monster of world.query(monsters)) {
                const position = monster.get(TransformTrait)!;
                if (
                    inside(
                        covers,
                        position.x,
                        position.z,
                        monster.get(MonsterTrait)!.radius,
                    )
                )
                    strike(world, monster, damage, at.x, at.z);
            }
        playCue(world, skill.cue, { ...covers, y: at.y });
        if (!preview) {
            stamina -= active.stamina;
            skillCooldowns.set(skill.id, active.cooldown);
        }
        castAge = 0;
        castMove = cueMoves.indexOf(skill.cue?.move ?? "none");
    }
    hero.set(HeroCombatTrait, { stamina, dirX, dirZ, castAge, castMove });
};

/** What a cast covers on the ground, for its cue. */
type Covered = {
    shape: HazardShape;
    x: number;
    y: number;
    z: number;
    dirX: number;
    dirZ: number;
    size: number;
    inner: number;
    spread: number;
};

/** A cast's look: its element's motes over what it covers, sword arcs
 *  round her, and the camera's shake. Her move plays from `castMove`. */
function playCue(world: World, cue: CueDef | null, covered: Covered) {
    if (!cue) return;
    if (cue.element !== "none")
        burstHazard({ ...covered, element: elements.indexOf(cue.element) });
    const y = covered.y + heroMiddle;
    for (let arc = 0; arc < cue.arcs; arc++) {
        const angle = (arc / cue.arcs) * Math.PI * 2;
        world.spawn(
            SlashTrait({
                x: covered.x,
                y,
                z: covered.z,
                dirX: Math.sin(angle),
                dirZ: Math.cos(angle),
            }),
        );
    }
    if (cue.shake > 0) shakeCamera(cue.shake);
}

/** Seconds a dodge takes, metres it carries her, and seconds from the
 *  start of one to the next, a breath past its end: stamina, not a wait,
 *  is what holds her to three. Nothing hurts her while she dodges. */
export const dodgeSeconds = 0.3;
const dodgeLength = 3.5;
const dodgeRest = 0.35;

/** Starts a dodge asked for, if she has the stamina for it, the way asked,
 *  else the way she walks, else the way she faces; and carries her along
 *  one, over whatever her walking asked, until it ends. Her stamina comes
 *  back between dodges. */
const dodge: System = (world, { deltaSeconds }) => {
    const hero = findPlayerHero(world);
    const combat = hero?.get(HeroCombatTrait);
    const velocity = hero?.get(VelocityTrait);
    const asked = aim.dodge;
    aim.dodge = false;
    if (!hero || !combat || !velocity) return;
    let { dodge: left, dodgeX, dodgeZ, dodgeRest: rest, stamina } = combat;
    rest = Math.max(0, rest - deltaSeconds);
    const { maxStamina, staminaRecovery } = deriveHero(useProgress.getState());
    if (left <= 0 && combat.spin <= 0)
        stamina = Math.min(
            maxStamina,
            stamina + staminaRecovery * deltaSeconds,
        );
    if (
        asked &&
        rest <= 0 &&
        left <= 0 &&
        stamina >= dodgeStamina &&
        !useBattle.getState().defeated
    ) {
        let x = aim.dodgeX;
        let z = aim.dodgeZ;
        if (Math.hypot(x, z) < 1e-3) {
            const walking = Math.hypot(velocity.x, velocity.z) > 0.3;
            x = walking ? velocity.x : combat.dirX;
            z = walking ? velocity.z : combat.dirZ;
        }
        const length = Math.hypot(x, z) || 1;
        dodgeX = x / length;
        dodgeZ = z / length;
        left = dodgeSeconds;
        rest = dodgeRest;
        stamina -= dodgeStamina;
    }
    if (left > 0) {
        left = Math.max(0, left - deltaSeconds);
        const speed = dodgeLength / dodgeSeconds;
        velocity.set(dodgeX * speed, velocity.y, dodgeZ * speed);
    }
    hero.set(HeroCombatTrait, {
        dodge: left,
        dodgeX,
        dodgeZ,
        dodgeRest: rest,
        stamina,
    });
};

/** Every effect and piece of loot, for a scene to clear as it leaves. */
export function clearEffects(world: World) {
    world.query(arrows).forEach((entity) => entity.destroy());
    world.query(slashes).forEach((entity) => entity.destroy());
    world.query(floats).forEach((entity) => entity.destroy());
    world.query(bursts).forEach((entity) => entity.destroy());
    world.query(loot).forEach((entity) => entity.destroy());
    clearHazards(world);
}

/** The fight: the hero's attacks, dodge and skills, the monsters' hunt, the
 *  boss's skills and hazards, the loot and the effects. Its systems run
 *  after the engine's rules, so the chase has set each monster's velocity
 *  before the hunt overrides it, and before the physics moves them all. */
export const combat = definePlugin({
    name: "combat",
    description:
        "The fight: attacks, dodges and skills, the monsters' hunt, the boss, the loot and the effects.",
    systems: {
        rules: {
            prepareMonsters,
            //  Each writes the hero's speed or velocity, which her page
            //  predicts.
            applyHeroStats: {
                system: applyHeroStats,
                runsOn: RunContext.Both,
            },
            attack,
            dodge: { system: dodge, runsOn: RunContext.Both },
            cyclone,
            castSkills,
            flyArrows,
            huntHero,
            castBossSkills,
            fireHazards,
            afflict,
            gatherLoot,
            ageEffects,
            respawnMonsters,
        },
    },
});
