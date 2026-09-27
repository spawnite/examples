import { createQuery, type Entity, type World } from "koota";
import {
    DamageSource,
    findEntity,
    HealthTrait,
    readEach,
    readField,
    Transform,
    WeaponKind,
    type WeaponSettings,
} from "@spawnite/engine/core";
import { dropCoins } from "./coins";
import { spawnBurst } from "./effects";
import { WardenStat, wardenStats } from "./stats";
import { splitMonster } from "./monsters";
import {
    BurstKind,
    EliteModifier,
    MonsterTrait,
    SiegeState,
    WardenTrait,
} from "./traits";
import { queryWardens } from "./wardens";
import { monsterSettings } from "./waves";

//  The wardens' blaster: an engine instant weapon whose numbers are each
//  warden's own stats, which the room's judge reads off her for every
//  pull. The siege takes out each monster a shot left with no health and
//  credits the kill to the warden whose damage it took last.

export const blasterWeapon = "blaster";

/** Metres a shot reaches. */
const blasterRange = 45;
/** Radians between two pellets of one pull. */
const pelletSpread = 0.06;

/** The blaster as the room judges it: every number but its range is the
 *  shooter's stat of that name, its base where she has none. */
export const blasterSettings: WeaponSettings = {
    kind: WeaponKind.Instant,
    damage: wardenStats[WardenStat.Damage].base,
    range: blasterRange,
    shotsPerSecond: wardenStats[WardenStat.FireRate].base,
    pellets: wardenStats[WardenStat.Pellets].base,
    spread: pelletSpread,
    pierce: wardenStats[WardenStat.Pierce].base,
    stats: {
        damage: WardenStat.Damage,
        shotsPerSecond: WardenStat.FireRate,
        pellets: WardenStat.Pellets,
        pierce: WardenStat.Pierce,
    },
};

/** A monster taken out, and the warden whose shot did it, where one did. */
interface Kill {
    monster: Entity;
    killer: Entity | null;
}

/** Times its coins an elite drops. */
const eliteCoins = 3;
const sieges = createQuery(SiegeState);

/** Takes `monster` out: its coins and its burst where it stood, a
 *  splitting elite's two skitters, the kill to `killer`. */
function killMonster(world: World, { monster, killer }: Kill) {
    const feet = monster.get(Transform);
    const settings = monster.get(MonsterTrait);
    if (feet && settings) {
        const { coins, radius } = monsterSettings[settings.kind];
        const elite = settings.elite !== EliteModifier.None;
        dropCoins(world, {
            position: feet,
            value: elite ? coins * eliteCoins : coins,
        });
        if (settings.elite === EliteModifier.Splitting) {
            const siege = findEntity(world, sieges);
            splitMonster(world, {
                position: feet,
                wave: siege ? (readField(siege, SiegeState, "wave") ?? 1) : 1,
                wardens: queryWardens(world).length,
            });
        }
        spawnBurst(world, {
            kind: BurstKind.Death,
            position: feet,
            monster: settings.kind,
            size: radius * 3,
        });
    }
    const survivor = killer?.isAlive() ? killer.get(WardenTrait) : undefined;
    if (killer && survivor)
        killer.set(WardenTrait, { kills: survivor.kills + 1 });
    monster.destroy();
}

const monsters = createQuery(MonsterTrait, HealthTrait, Transform);

/** Takes out every monster a shot left with no health, the kill to the
 *  warden its damage names. Runs before the behaviours, whose reap would
 *  remove it with no coins and no credit. */
export function takeFallenMonsters(world: World) {
    readEach(world, monsters, ([, health], monster) => {
        if (health.current > 0) return;
        killMonster(world, {
            monster,
            killer: monster.get(DamageSource)?.source ?? null,
        });
    });
}
