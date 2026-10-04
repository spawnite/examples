import { createQuery, type Entity, type World } from "koota";
import {
    DamagedTrait,
    dealDamage,
    requireAuthority,
    HealthTrait,
    readEach,
    TransformTrait,
} from "@spawnite/engine/core";
import {
    GunId,
    readGun,
    readRicochets,
    ricochetMetres,
    ricochetShare,
} from "./guns";
import { addStrike, pushPoint } from "./strikes";
import { MonsterTrait, StrikeKind, WardenTrait } from "./traits";

//  The scattergun's upgraded pellets bounce: a pellet that hits a monster
//  flies on to the nearest other within reach at half its damage, and on
//  again at the top tier, as Borderlands' ricochet guns do. A bounce lays
//  no element, so the scattergun's element stays a fifth of a dose a
//  pellet, as every gun's stays one dose a second.

/** The weapon a bounce's hit names, which no page fires and no bounce
 *  bounces from again. */
export const ricochetWeapon = "ricochet";

/** Metres above a monster's feet a bounce is drawn between. */
const chestMetres = 0.9;

/** A pellet that hit: the monster, the warden, its damage and the bounces
 *  it has left. */
interface Bounce {
    monster: Entity;
    warden: Entity;
    damage: number;
    bounces: number;
}

//  The step's bounces, gathered before any lands, so a bounce's own hit
//  never joins the list being read.
const bounces: Bounce[] = [];
//  The monsters one pellet has struck, refilled for each.
const struck: Entity[] = [];
const damagedMonsters = createQuery(MonsterTrait, DamagedTrait);
const placedMonsters = createQuery(MonsterTrait, HealthTrait, TransformTrait);

/** The monster with health left nearest `from` within reach that this
 *  pellet has not struck, or null. */
function findNextMonster(world: World, from: Entity): Entity | null {
    const feet = from.get(TransformTrait);
    if (!feet) return null;
    let nearest: Entity | null = null;
    let nearestMetres = ricochetMetres;
    readEach(world, placedMonsters, ([, health, at], monster) => {
        if (health.current <= 0 || struck.includes(monster)) return;
        const metres = Math.hypot(at.x - feet.x, at.z - feet.z);
        if (metres <= nearestMetres) {
            nearest = monster;
            nearestMetres = metres;
        }
    });
    return nearest;
}

/** Bounces every scattergun pellet that hit a monster since the last step
 *  on through the monsters nearest it, as many times as its warden's tier
 *  gives, each at half the damage before, and draws each path. */
export function ricochetPellets(world: World) {
    bounces.length = 0;
    readEach(world, damagedMonsters, ([, damaged], monster) => {
        for (const { amount, source, weapon } of damaged.hits) {
            if (weapon !== GunId.Scattergun || !source?.has(WardenTrait))
                continue;
            const { gun, tier } = readGun(source);
            if (gun !== GunId.Scattergun) continue;
            const count = readRicochets(gun, tier);
            if (count > 0)
                bounces.push({
                    monster,
                    warden: source,
                    damage: amount,
                    bounces: count,
                });
        }
    });
    for (const bounce of bounces) {
        struck.length = 0;
        struck.push(bounce.monster);
        const points: number[] = [];
        const start = bounce.monster.get(TransformTrait);
        if (!start) continue;
        pushPoint(points, start, chestMetres);
        let from = bounce.monster;
        let damage = bounce.damage;
        for (let hop = 0; hop < bounce.bounces; hop++) {
            const next = findNextMonster(world, from);
            const at = next?.get(TransformTrait);
            if (!next || !at) break;
            damage *= ricochetShare;
            dealDamage(requireAuthority(world), next, {
                amount: damage,
                source: bounce.warden,
                weapon: ricochetWeapon,
            });
            struck.push(next);
            pushPoint(points, at, chestMetres);
            from = next;
        }
        if (points.length > 3)
            addStrike(world, {
                kind: StrikeKind.Ricochet,
                by: bounce.warden,
                points,
            });
    }
}
