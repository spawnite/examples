import type { World } from "koota";
import {
    findRarity,
    rarities,
    RarityId,
    round2,
    WeaponId,
    weaponBlurbs,
    weaponIds,
    type Rarity,
} from "./data";
import { random } from "@spawnite/engine/core";
import { playCue, readRun } from "./field";
import { healHero } from "./hero";
import { Cue, OfferKind, RunPhase, type Card, type RunState } from "./traits";

//  The level-up cards: at levels 3, 5 and 7 a new weapon, and between them
//  weapon upgrades and, every third level, passive ones. A card rolls a
//  rarity that scales its gain; a Prismatic roll is the echo instead.

/** What a card gives at a rarity: the amount in big type, such as "+40",
 *  over what it adds to, such as "blast radius". */
export interface UpgradeGain {
    amount: string;
    label: string;
}

/** One card's effect, shown as a name and a gain, applied at a rarity. */
export interface Upgrade {
    id: string;
    /** The weapon the card belongs to, or none for a passive or an
     *  arsenal-wide card. */
    weapon: WeaponId | null;
    /** The card's name, beside the weapon's. */
    name: string;
    describe: (run: RunState, rarity: Rarity) => UpgradeGain;
    available: (run: RunState) => boolean;
    apply: (world: World, rarity: Rarity) => void;
}

/** The fastest a weapon fires, in seconds between shots. */
const fastestInterval = 0.16;

/** Metres of nova radius and shard range upgrades stop at, in units. */
const novaRadiusCap = 380;
const shardRangeCap = 300;
const countCap = 6;

function weaponUpgrades(id: WeaponId): Upgrade[] {
    const power: Upgrade = {
        id: `${id}-damage`,
        weapon: id,
        name: "Power",
        describe: (run, rarity) => ({
            amount: `+${Math.round(run.weapons[id].gain * rarity.mult)}`,
            label: "damage",
        }),
        available: (run) => run.weapons[id].owned,
        apply: (world, rarity) => {
            const weapon = readRun(world).weapons[id];
            weapon.damage += Math.round(weapon.gain * rarity.mult);
            weapon.level++;
        },
    };
    const rapid: Upgrade = {
        id: `${id}-speed`,
        weapon: id,
        name: "Rapid fire",
        describe: (_run, rarity) => ({
            amount: `-${Math.round(rarity.rate * 100)}%`,
            label: "attack cooldown",
        }),
        available: (run) =>
            run.weapons[id].owned && run.weapons[id].interval > fastestInterval,
        apply: (world, rarity) => {
            const weapon = readRun(world).weapons[id];
            weapon.interval = Math.max(
                fastestInterval,
                weapon.interval * (1 - rarity.rate),
            );
            weapon.level++;
        },
    };
    return [power, rapid, countUpgrade(id)];
}

/** A weapon's third card: the nova's radius, the shards' range, the zap's
 *  bounces, or more projectiles for the rest. */
function countUpgrade(id: WeaponId): Upgrade {
    const base = { id: `${id}-count`, weapon: id };
    if (id === WeaponId.Nova)
        return {
            ...base,
            name: "Radius",
            describe: (run, rarity) => ({
                amount: `+${Math.min(novaRadiusCap - run.weapons.nova.radius, Math.round(40 * rarity.mult))}`,
                label: "blast radius",
            }),
            available: (run) =>
                run.weapons.nova.owned &&
                run.weapons.nova.radius < novaRadiusCap,
            apply: (world, rarity) => {
                const nova = readRun(world).weapons.nova;
                nova.radius = Math.min(
                    novaRadiusCap,
                    nova.radius + Math.round(40 * rarity.mult),
                );
                nova.level++;
            },
        };
    if (id === WeaponId.Shard)
        return {
            ...base,
            name: "Range",
            describe: (run, rarity) => ({
                amount: `+${Math.min(shardRangeCap - run.weapons.shard.range, Math.round(32 * rarity.mult))}`,
                label: "range",
            }),
            available: (run) =>
                run.weapons.shard.owned &&
                run.weapons.shard.range < shardRangeCap,
            apply: (world, rarity) => {
                const shard = readRun(world).weapons.shard;
                shard.range = Math.min(
                    shardRangeCap,
                    shard.range + Math.round(32 * rarity.mult),
                );
                shard.level++;
            },
        };
    if (id === WeaponId.Zap)
        return {
            ...base,
            name: "Bounces",
            describe: (run, rarity) => ({
                amount: `+${Math.min(rarity.count, countCap - run.weapons.zap.bounces)}`,
                label: "bounces",
            }),
            available: (run) =>
                run.weapons.zap.owned && run.weapons.zap.bounces < countCap,
            apply: (world, rarity) => {
                const zap = readRun(world).weapons.zap;
                zap.bounces = Math.min(countCap, zap.bounces + rarity.count);
                zap.level++;
            },
        };
    return {
        ...base,
        name: "Multishot",
        describe: (run, rarity) => ({
            amount: `+${Math.min(rarity.count, countCap - run.weapons[id].count)}`,
            label: "projectiles",
        }),
        available: (run) =>
            run.weapons[id].owned && run.weapons[id].count < countCap,
        apply: (world, rarity) => {
            const weapon = readRun(world).weapons[id];
            weapon.count = Math.min(countCap, weapon.count + rarity.count);
            weapon.level++;
        },
    };
}

/** Each weapon's share of its power card an arsenal card gives. */
function arsenalGain(gain: number, rarity: Rarity) {
    return Math.max(1, Math.floor(Math.round(gain * rarity.mult) * 0.65));
}

const arsenalUpgrades: Upgrade[] = [
    {
        id: "all-damage",
        weapon: null,
        name: "Damage boost",
        describe: (run, rarity) => {
            const gains = weaponIds.map((id) =>
                arsenalGain(run.weapons[id].gain, rarity),
            );
            return {
                amount: `+${Math.min(...gains)}–${Math.max(...gains)}`,
                label: "damage, all weapons",
            };
        },
        available: () => true,
        apply: (world, rarity) => {
            for (const weapon of Object.values(readRun(world).weapons))
                weapon.damage += arsenalGain(weapon.gain, rarity);
        },
    },
    {
        id: "all-speed",
        weapon: null,
        name: "Attack speed",
        describe: (_run, rarity) => ({
            amount: `-${round2(rarity.rate * 0.75 * 100)}%`,
            label: "cooldown, all weapons",
        }),
        available: (run) =>
            Object.values(run.weapons).some(
                (weapon) => weapon.interval > fastestInterval,
            ),
        apply: (world, rarity) => {
            for (const weapon of Object.values(readRun(world).weapons))
                weapon.interval = Math.max(
                    fastestInterval,
                    weapon.interval * (1 - rarity.rate * 0.75),
                );
        },
    },
];

/** The most extra share of food, magnets and double-XP drops. */
const supplyCap = 2;

const passiveUpgrades: Upgrade[] = [
    {
        id: "consumables",
        weapon: null,
        name: "Supply boost",
        describe: (run, rarity) => ({
            amount: `+${Math.round(Math.min(supplyCap - run.consumableBonus, rarity.supply) * 100)}%`,
            label: "food, magnet & double-XP drops",
        }),
        available: (run) => run.consumableBonus < supplyCap,
        apply: (world, rarity) => {
            const run = readRun(world);
            run.consumableBonus = Math.min(
                supplyCap,
                Math.round((run.consumableBonus + rarity.supply) * 100) / 100,
            );
        },
    },
    {
        id: "drops",
        weapon: null,
        name: "Lucky find",
        describe: (run, rarity) => ({
            amount: `${round2(Math.min(1, run.dropChance + 0.005 * rarity.mult) * 100)}%`,
            label: `health drops, up from ${round2(run.dropChance * 100)}%`,
        }),
        available: (run) => run.dropChance < 1,
        apply: (world, rarity) => {
            const run = readRun(world);
            run.dropChance = Math.min(
                1,
                Math.round((run.dropChance + 0.005 * rarity.mult) * 10000) /
                    10000,
            );
        },
    },
    {
        id: "xpmult",
        weapon: null,
        name: "Experience multiplier",
        describe: (_run, rarity) => ({
            amount: `+${round2(rarity.xp * 100)}%`,
            label: "XP gained",
        }),
        available: () => true,
        apply: (world, rarity) => {
            const run = readRun(world);
            run.xpMult = Math.round((run.xpMult + rarity.xp) * 1000) / 1000;
        },
    },
    {
        id: "movement",
        weapon: null,
        name: "Second wind",
        describe: (_run, rarity) => ({
            amount: `+${Math.round(20 * rarity.mult)}`,
            label: `movement speed, and heal ${Math.round(30 * rarity.mult)}`,
        }),
        available: () => true,
        apply: (world, rarity) => {
            readRun(world).speed += Math.round(20 * rarity.mult);
            healHero(world, Math.round(30 * rarity.mult));
        },
    },
    {
        id: "regen",
        weapon: null,
        name: "Vital current",
        describe: () => ({
            amount: "+0.4",
            label: "health a second, up to 2",
        }),
        available: (run) => run.regenRanks < 5,
        apply: (world) => {
            const run = readRun(world);
            run.regen = Math.round((run.regen + 0.4) * 10) / 10;
            run.regenRanks++;
        },
    },
];

const passiveIds = new Set(passiveUpgrades.map((upgrade) => upgrade.id));

/** Every stat card, the weapons' first. */
const statUpgrades: Upgrade[] = [
    ...weaponIds.flatMap(weaponUpgrades),
    ...arsenalUpgrades,
    ...passiveUpgrades,
];

export const echoUpgradeId = "prismatic-twin";

const echoUpgrade: Upgrade = {
    id: echoUpgradeId,
    weapon: null,
    name: "Prismatic echo",
    describe: () => ({
        amount: "×2",
        label: "a companion copies your weapons, once a run",
    }),
    available: (run) => !run.hasTwin,
    apply: (world) => {
        const run = readRun(world);
        run.hasTwin = true;
        run.forcePrismatic = false;
    },
};

function unlockUpgrade(id: WeaponId): Upgrade {
    return {
        id: `unlock-${id}`,
        weapon: id,
        name: "Add to loadout",
        describe: () => ({ amount: "New", label: weaponBlurbs[id] }),
        available: (run) => !run.weapons[id].owned,
        apply: (world) => {
            const run = readRun(world);
            const weapon = run.weapons[id];
            weapon.owned = true;
            weapon.clock = 0;
            if (!run.loadout.includes(id)) run.loadout.push(id);
        },
    };
}

const unlockUpgrades = new Map(
    weaponIds.map((id) => [`unlock-${id}`, unlockUpgrade(id)]),
);

/** The card's upgrade, by its id. */
export function findUpgrade(id: string): Upgrade {
    const found =
        id === echoUpgradeId
            ? echoUpgrade
            : (unlockUpgrades.get(id) ??
              statUpgrades.find((upgrade) => upgrade.id === id));
    if (!found)
        throw new Error(
            `No upgrade is named ${id}: a card names one of the ids in upgrades.ts.`,
        );
    return found;
}

/** Draws a rarity, leaning to the rare cards by the run's upgrade luck. */
function rollRarity(world: World, allowPrismatic: boolean): Rarity {
    const run = readRun(world);
    const eligible = allowPrismatic ? rarities : rarities.slice(0, 4);
    const luck = Math.max(0, Math.min(1, run.luck));
    const weights = eligible.map(
        (rarity) => rarity.weight * (1 - luck) + rarity.lucky * luck,
    );
    let draw = random(world) * weights.reduce((sum, weight) => sum + weight, 0);
    for (let index = 0; index < eligible.length; index++) {
        draw -= weights[index];
        if (draw < 0) return eligible[index];
    }
    return eligible[eligible.length - 1];
}

/** Shuffles `list` in place with the world's random, and returns it. */
function shuffle<Item>(world: World, list: Item[]) {
    for (let index = list.length - 1; index > 0; index--) {
        const other = Math.floor(random(world) * (index + 1));
        [list[index], list[other]] = [list[other], list[index]];
    }
    return list;
}

/** Four cards from `list`: one weapon power card where there is one, the
 *  rest weighted, an arsenal card at three quarters, then more power cards
 *  to fill. */
function pickFour(world: World, list: Upgrade[]) {
    const isPower = (upgrade: Upgrade) =>
        upgrade.weapon !== null && upgrade.id.endsWith("-damage");
    const powers = shuffle(world, list.filter(isPower));
    const rest = list.filter((upgrade) => !isPower(upgrade));
    const picked: Upgrade[] = [];
    if (powers.length) picked.push(powers[0]);
    const bag = rest.map((upgrade) => ({
        upgrade,
        weight: upgrade.id.startsWith("all-") ? 0.75 : 1,
    }));
    while (picked.length < 4 && bag.length) {
        let draw =
            random(world) * bag.reduce((sum, entry) => sum + entry.weight, 0);
        let index = 0;
        for (; index < bag.length; index++) {
            draw -= bag[index].weight;
            if (draw <= 0) break;
        }
        if (index >= bag.length) index = bag.length - 1;
        picked.push(bag[index].upgrade);
        bag.splice(index, 1);
    }
    for (const upgrade of powers.slice(1)) {
        if (picked.length >= 4) break;
        picked.push(upgrade);
    }
    return shuffle(world, picked);
}

/** Which stat cards a level offers: passive ones every third level that
 *  adds no weapon, weapon ones otherwise. */
function readOfferKind(level: number) {
    let count = 0;
    for (let each = 2; each <= level; each++)
        if (![3, 5, 7].includes(each)) count++;
    return count % 3 === 0 ? OfferKind.Utility : OfferKind.Weapon;
}

function pickStatCards(world: World, kind: OfferKind) {
    const run = readRun(world);
    const open = statUpgrades.filter((upgrade) => upgrade.available(run));
    const utility = kind === OfferKind.Utility;
    const wanted = open.filter(
        (upgrade) => passiveIds.has(upgrade.id) === utility,
    );
    const other = open.filter(
        (upgrade) => passiveIds.has(upgrade.id) !== utility,
    );
    return pickFour(world, wanted.length ? wanted : other);
}

/** Draws `count` of `ids` at random, each once. */
function sampleIds(world: World, ids: WeaponId[], count: number) {
    return shuffle(world, ids.slice()).slice(0, count);
}

/** Deals the level's cards onto the run and holds the world for the pick.
 *  A Reroll+ lifts each card's rarity a step. */
export function offerUpgrades(world: World, tierBoost = false) {
    const run = readRun(world);
    const unowned = weaponIds.filter(
        (id) =>
            (id !== WeaponId.Zap || run.zapUnlocked) && !run.weapons[id].owned,
    );
    const slots = 1 + [3, 5, 7].filter((level) => run.level >= level).length;
    const addsWeapon = run.loadout.length < slots && unowned.length > 0;
    const kind = addsWeapon ? OfferKind.Loadout : readOfferKind(run.level);
    const pool = addsWeapon
        ? sampleIds(world, unowned, 2).map((id) => findUpgrade(`unlock-${id}`))
        : pickStatCards(world, kind);
    const ladder = rarities.filter(
        (rarity) => rarity.id !== RarityId.Prismatic,
    );
    let echoOffered = false;
    const cards: Card[] = pool.slice(0, 4).map((upgrade) => {
        if (addsWeapon) return { id: upgrade.id, rarity: null };
        let rarity = rollRarity(world, !run.hasTwin && !echoOffered);
        if (tierBoost && rarity.id !== RarityId.Prismatic) {
            const step = ladder.findIndex((each) => each.id === rarity.id);
            rarity = ladder[Math.min(ladder.length - 1, Math.max(0, step) + 1)];
        }
        if (rarity.id === RarityId.Prismatic) {
            echoOffered = true;
            return { id: echoUpgradeId, rarity: RarityId.Prismatic };
        }
        return { id: upgrade.id, rarity: rarity.id };
    });
    if (run.forcePrismatic && !run.hasTwin) {
        const echoCard = { id: echoUpgradeId, rarity: RarityId.Prismatic };
        if (!echoOffered) {
            if (addsWeapon) cards.push(echoCard);
            else cards[cards.length - 1] = echoCard;
        }
        run.forcePrismatic = false;
    }
    run.offer = { kind, cards };
    run.phase = RunPhase.Upgrade;
    if (
        cards.some(
            (card) =>
                card.rarity === RarityId.Legendary ||
                card.rarity === RarityId.Prismatic,
        )
    )
        playCue(world, Cue.Legendary);
}

/** Applies card `index` of the offer and plays on. */
export function pickCard(world: World, index: number) {
    const run = readRun(world);
    const card = run.offer?.cards[index];
    if (run.phase !== RunPhase.Upgrade || !card) return;
    findUpgrade(card.id).apply(
        world,
        findRarity(card.rarity ?? RarityId.Normal),
    );
    run.offer = null;
    run.phase = RunPhase.Playing;
}

/** Spends a reroll, or a Reroll+ that lifts each card a tier, on a new
 *  deal. A Reroll+ never rerolls a new weapon's cards. */
export function rerollCards(world: World, plus: boolean) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Upgrade) return;
    if (plus) {
        if (run.rerollPlus <= 0 || run.offer?.kind === OfferKind.Loadout)
            return;
        run.rerollPlus--;
    } else {
        if (run.rerolls <= 0) return;
        run.rerolls--;
    }
    offerUpgrades(world, plus);
}
