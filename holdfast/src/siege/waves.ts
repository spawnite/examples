import { EliteModifier, MonsterKind } from "./traits";
import { drawIndex, drawRandom, type Seeded } from "./random";

//  What each wave sends, and what each kind of monster is. Pure numbers, so
//  a test reads a wave's plan without a world.

/** Seconds the first warden to take her place waits for the others before
 *  the run starts without them. */
export const lobbySeconds = 15;
/** Seconds before the first wave, to find the others and the fire. */
export const firstBreatherSeconds = 8;
/** Seconds between waves. */
export const breatherSeconds = 12;
/** Metres from a warden a monster rises, so it is seen coming. */
export const spawnMetres = { least: 16, most: 22 };
/** Metres from the middle a monster may rise: on the circle's level
 *  ground, whose region reaches 32 m and fades out over 5. */
export const arenaMetres = 26;
/** The most monsters standing at once, so a late wave stays a stream the
 *  room can step rather than a single flood. */
export const standingCap = 40;

/** What one kind of monster is at wave 1. */
export interface MonsterSettings {
    health: number;
    /** Metres a second. A warden runs at 5. */
    speed: number;
    /** Health one hit takes from a warden. */
    damage: number;
    /** Seconds between its hits. */
    cooldown: number;
    radius: number;
    height: number;
    /** Coins it drops. */
    coins: number;
    /** The first wave it comes in. */
    firstWave: number;
    /** How often it comes, against the other kinds of its wave. */
    weight: number;
}

export const monsterSettings: Record<MonsterKind, MonsterSettings> = {
    [MonsterKind.Husk]: {
        health: 30,
        speed: 3,
        damage: 5,
        cooldown: 1,
        radius: 0.4,
        height: 1.5,
        coins: 1,
        firstWave: 1,
        weight: 10,
    },
    [MonsterKind.Skitter]: {
        health: 14,
        speed: 5.4,
        damage: 5,
        cooldown: 0.6,
        radius: 0.3,
        height: 0.8,
        coins: 1,
        firstWave: 3,
        weight: 5,
    },
    [MonsterKind.Brute]: {
        health: 160,
        speed: 2.1,
        damage: 25,
        cooldown: 1.6,
        radius: 0.75,
        height: 2.3,
        coins: 6,
        firstWave: 5,
        weight: 1.2,
    },
    //  Its damage is a bolt's, and its cooldown the wait between two.
    [MonsterKind.Spitter]: {
        health: 24,
        speed: 2.6,
        damage: 12,
        cooldown: 2.6,
        radius: 0.4,
        height: 1.5,
        coins: 2,
        firstWave: 4,
        weight: 2.5,
    },
    //  Never drawn at random: every fifth wave sends one. Its damage is a
    //  slam's, and its cooldown the wait between two.
    [MonsterKind.Colossus]: {
        health: 700,
        speed: 2.3,
        damage: 30,
        cooldown: 4,
        radius: 1.3,
        height: 4.2,
        coins: 30,
        firstWave: Infinity,
        weight: 0,
    },
};

const monsterKinds = Object.values(MonsterKind);

/** A wave: how many, and how much tougher, faster and harder-hitting
 *  than the first. */
export interface WavePlan {
    count: number;
    /** Times each monster's health. */
    health: number;
    /** Times each monster's speed. */
    speed: number;
    /** Times each monster's damage. */
    damage: number;
    /** Seconds between two batches. */
    interval: number;
    /** Monsters a batch holds. */
    batch: number;
    /** Colossi of the count, which rise before the rest. */
    bosses: number;
    /** Times a colossus's health: the wave's, and more for each warden,
     *  since every warden shoots the one boss. */
    bossHealth: number;
}

/** Every this many waves a colossus comes. */
export const bossEvery = 5;
/** Share of a boss wave's count that rises beside the colossus. */
const escortShare = 0.6;
/** The last wave health climbs by a flat step; past it, by a share. */
const steadyWaves = 10;

/** Times the first wave's health a monster of `wave` has: a small flat
 *  climb to wave 10, which the average picks keep at two to four hits,
 *  then a tenth more a wave, so late waves feel different. */
function measureHealth(wave: number) {
    const steady = 1 + 0.035 * (Math.min(wave, steadyWaves) - 1);
    return steady * 1.1 ** Math.max(0, wave - steadyWaves);
}

/** Wave `wave` against `wardens` wardens: three more monsters a wave, and
 *  six in ten more for each warden past the first; a colossus and a
 *  smaller escort every fifth wave. */
export function planWave(wave: number, wardens: number): WavePlan {
    const crowd = 1 + 0.6 * (Math.max(wardens, 1) - 1);
    const bosses = wave > 0 && wave % bossEvery === 0 ? 1 : 0;
    const count = Math.round((5 + 3 * wave) * crowd);
    const health = measureHealth(wave);
    return {
        count: bosses > 0 ? bosses + Math.round(count * escortShare) : count,
        health,
        //  A slow climb that never flattens: by wave 20 a husk walks at
        //  4.4 m/s, still under a warden's run.
        speed: 1 + 0.025 * (wave - 1),
        //  Level with the health her Iron Heart and Second Wind add on
        //  average picks.
        damage: 1 + 0.04 * (wave - 1),
        interval: Math.max(0.5, 2.2 - 0.1 * wave),
        batch: 1 + Math.floor(wave / 3),
        bosses,
        bossHealth: health * (1 + 0.75 * (Math.max(wardens, 1) - 1)),
    };
}

/** The first wave elites come in. */
export const firstEliteWave = 6;
const eliteModifiers = [
    EliteModifier.Swift,
    EliteModifier.Armoured,
    EliteModifier.Splitting,
];

/** A modifier for the next monster of wave `wave`: none before the sixth,
 *  then one in eight, and three in a hundred more each wave to two in
 *  five. */
export function drawElite(siege: Seeded, wave: number) {
    if (wave < firstEliteWave) return EliteModifier.None;
    const chance = Math.min(0.4, 0.12 + 0.03 * (wave - firstEliteWave));
    if (drawRandom(siege) >= chance) return EliteModifier.None;
    return eliteModifiers[drawIndex(siege, eliteModifiers.length)];
}

/** A kind for the next monster of wave `wave`, weighted among the kinds
 *  that have come by then. */
export function drawMonsterKind(siege: Seeded, wave: number) {
    let total = 0;
    for (const kind of monsterKinds)
        if (monsterSettings[kind].firstWave <= wave)
            total += monsterSettings[kind].weight;
    let pick = drawRandom(siege) * total;
    for (const kind of monsterKinds) {
        const { firstWave, weight } = monsterSettings[kind];
        if (firstWave > wave) continue;
        pick -= weight;
        if (pick < 0) return kind;
    }
    return MonsterKind.Husk;
}
