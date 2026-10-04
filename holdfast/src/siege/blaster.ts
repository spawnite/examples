import { createQuery, type Entity, type World } from "koota";
import {
    DamageSourceTrait,
    findEntity,
    HealthTrait,
    readEach,
    readField,
    TransformTrait,
    WeaponKind,
    type WeaponSettings,
} from "@spawnite/engine/core";
import { shatterMonster } from "./afflictions";
import { shareCoins } from "./coins";
import { spawnBurst } from "./effects";
import { rackGunStats } from "./stats";
import { tallyKill } from "./tally";
import { splitMonster } from "./monsters";
import {
    BurstKind,
    EliteModifier,
    MonsterTrait,
    SiegeStateTrait,
    WardenTrait,
} from "./traits";
import { queryWardens } from "./wardens";
import { monsterSettings } from "./waves";

//  The wardens' blaster: an engine instant weapon with each warden's gun
//  stats laid on its own numbers, which the room's judge reads off her for
//  every pull. The siege takes out each monster a shot left with no health
//  and credits the kill to the warden whose damage it took last.

export const blasterWeapon = "blaster";

/** Metres a shot reaches. */
const blasterRange = 45;
/** Radians between two pellets of one pull. */
const pelletSpread = 0.06;

/** The blaster as the room judges it: every number but its range and
 *  spread takes the shooter's gun stats, as every gun of the rack does. */
export const blasterSettings: WeaponSettings = {
    kind: WeaponKind.Instant,
    damage: 10,
    range: blasterRange,
    shotsPerSecond: 6,
    pellets: 1,
    spread: pelletSpread,
    pierce: 0,
    stats: rackGunStats,
    //  Six pulls a second apply one whole dose of her elements a second.
    data: { dose: 1 / 6 },
};

/** A monster taken out, and the warden whose shot did it, where one did. */
interface Kill {
    monster: Entity;
    killer: Entity | null;
}

/** Times its coins an elite drops. */
const eliteCoins = 3;
const sieges = createQuery(SiegeStateTrait);

/** Takes `monster` out: its coins to every warden, its burst where it
 *  stood, a splitting elite's two skitters, the kill to `killer`. */
function killMonster(world: World, { monster, killer }: Kill) {
    const feet = monster.get(TransformTrait);
    const settings = monster.get(MonsterTrait);
    if (feet && settings) {
        const { coins, radius } = monsterSettings[settings.kind];
        const elite = settings.elite !== EliteModifier.None;
        shareCoins(world, {
            position: feet,
            value: elite ? coins * eliteCoins : coins,
        });
        if (settings.elite === EliteModifier.Splitting) {
            const siege = findEntity(world, sieges);
            splitMonster(world, {
                position: feet,
                wave: siege
                    ? (readField(siege, SiegeStateTrait, "wave") ?? 1)
                    : 1,
                wardens: queryWardens(world).length,
            });
        }
        tallyKill(world, {
            kind: settings.kind,
            health: monster.get(HealthTrait)?.maximum ?? 0,
        });
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

const monsters = createQuery(MonsterTrait, HealthTrait, TransformTrait);

//  The monsters found with no health, refilled for each pass.
const fallen: Entity[] = [];

/** Takes out every monster a shot or an element left with no health, the
 *  kill to the warden its damage names; a frozen one's burst may bring
 *  down more, which the next pass takes, until none is left fallen. Each
 *  pass takes at least one out, so the passes end. Runs before the
 *  behaviours, whose reap would remove it with no coins and no credit. */
export function takeFallenMonsters(world: World) {
    for (;;) {
        fallen.length = 0;
        readEach(world, monsters, ([, health], monster) => {
            if (health.current <= 0) fallen.push(monster);
        });
        if (fallen.length === 0) return;
        for (const monster of fallen) {
            if (!monster.isAlive()) continue;
            shatterMonster(world, monster);
            killMonster(world, {
                monster,
                killer: monster.get(DamageSourceTrait)?.source ?? null,
            });
        }
    }
}
