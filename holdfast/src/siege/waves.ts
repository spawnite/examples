import type { Phase } from "./phase";
import { EliteModifier, MonsterKind, WaveName } from "./traits";
import { drawIndex, drawRandom, type Seeded } from "./random";

//  What each wave sends, and what each kind of monster is. Pure numbers, so
//  a test reads a wave's plan without a world.

/** Metres from the fire a warden stands to be ready: the outer edge of the
 *  lit ring on its flagstones, well inside the places the wardens stand at
 *  round the fire. */
export const readyRingMetres = 3.2;

/** Whether feet at `x`, `z` stand in the ready ring: the one test the room
 *  readies a warden by and a page lights the ring by. */
export function isInReadyRing({ x, z }: { x: number; z: number }) {
    return Math.hypot(x, z) <= readyRingMetres;
}

/** Whether the ring readies a warden in `phase`: while the wardens gather,
 *  at dawn, and between waves. The room reads it then, and a page draws it
 *  then and at no other time. */
export function isReadyRingOpen(phase: Phase | undefined) {
    return (
        phase === "waiting" ||
        phase === "over" ||
        phase === "dawn" ||
        phase === "breather"
    );
}
/** Seconds the run counts down once every warden is ready. */
export const countdownSeconds = 5;
/** Seconds the ready wardens wait on the rest before any of them may
 *  start without them. */
export const startWithoutSeconds = 30;
/** Seconds a warden who joins a running run is sheltered while she takes
 *  the cards she missed, at most. */
export const shelterSeconds = 20;
/** Seconds before the first wave, to find the others and the fire. */
export const firstBreatherSeconds = 8;
/** Seconds between waves, at most: long enough to heal, take a card and
 *  talk it over. */
export const breatherSeconds = 20;
/** Seconds between a held wave and its card deal, before the breather
 *  counts: the wave's last death, its call and its coins flying in land
 *  first, as a round's end holds a beat before its shop in most wave
 *  shooters. */
export const waveClearSeconds = 1.5;
/** Seconds a breather has left, at most, once every warden is ready: time
 *  to turn round before the wave. */
export const readyBreatherSeconds = 3;
/** Waves in a night: dawn breaks once the last is held. */
export const nightWaves = 15;
/** Metres from a warden a monster rises, so it is seen coming. */
export const spawnMetres = { least: 16, most: 22 };
/** Metres from the middle a monster may rise: on the circle's level
 *  ground, whose region reaches 32 m and fades out over 12. */
export const arenaMetres = 26;
/** The most monsters standing at once, so a late wave stays a stream the
 *  room can step rather than a single flood. */
export const standingCap = 40;
/** The most monsters standing at once in a Horde, one number for the room
 *  whoever is in it: a four-warden page draws a Horde of 60 in about
 *  12.5 ms a frame on a desktop, and one of 90 in about 20 ms, past a
 *  60 fps frame (PR #2292). */
export const hordeCap = 60;

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
    //  slam's, and its cooldown the wait between two. Its health holds a
    //  decent warden alone for about 35 s at the wave-5 colossus.
    [MonsterKind.Colossus]: {
        health: 2100,
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

/** How often each kind comes against the others of its wave. */
export type MonsterMix = Partial<Record<MonsterKind, number>>;

/** A wave: how many, how much tougher, faster and harder-hitting than the
 *  first, and what it sends. */
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
    /** Times its kind's size a colossus stands. */
    bossSize: number;
    /** The kinds a named wave sends, by weight; the kinds come by their
     *  first waves where it names none. */
    mix?: MonsterMix;
    /** The most of it standing at once. */
    cap: number;
    /** Whether its monsters may rise as elites. */
    elites: boolean;
}

/** Every this many waves a colossus comes. */
export const bossEvery = 5;
/** Share of a boss wave's count that rises beside the colossus; more
 *  beside the night's last. */
const escortShare = 0.6;
const lastEscortShare = 0.8;
/** Times the wave's boss health and size the night's last colossus has. */
const lastBossHealth = 1.5;
const lastBossSize = 1.3;
/** The last wave health climbs by a flat step; past it, by a share. */
const steadyWaves = 10;
/** Share of a wave's count a warden alone faces, and two together: a
 *  pair has no self-revive and one teammate to get her up, so the last
 *  one standing faces the whole wave. */
const soloShare = 0.8;
const pairShare = 1.4;

/** Times the first wave's health a monster of `wave` has: a small flat
 *  climb to wave 10, which the average picks keep at two to four hits,
 *  then a tenth more a wave, so late waves feel different. */
function measureHealth(wave: number) {
    const steady = 1 + 0.035 * (Math.min(wave, steadyWaves) - 1);
    return steady * 1.1 ** Math.max(0, wave - steadyWaves);
}

/** What a named wave changes from the plain one: its count, its
 *  monsters' health, its batches and their pace, and what it sends. */
interface NamedShape {
    count: number;
    health: number;
    batch: number;
    interval: number;
    mix: MonsterMix;
    cap: number;
    elites: boolean;
}

const namedShapes: Record<Exclude<WaveName, WaveName.Plain>, NamedShape> = {
    //  Skitters are half a husk's health: half as many again.
    [WaveName.Swarm]: {
        count: 1.5,
        health: 1,
        batch: 2,
        interval: 0.8,
        mix: { [MonsterKind.Skitter]: 1 },
        cap: standingCap,
        elites: true,
    },
    //  A brute takes five husks' shots: a third as many.
    [WaveName.Brutes]: {
        count: 0.3,
        health: 1,
        batch: 0.5,
        interval: 1.5,
        mix: { [MonsterKind.Brute]: 1 },
        cap: standingCap,
        elites: true,
    },
    [WaveName.SpitterRain]: {
        count: 1,
        health: 1,
        batch: 1,
        interval: 1,
        mix: { [MonsterKind.Spitter]: 7, [MonsterKind.Husk]: 3 },
        cap: standingCap,
        elites: true,
    },
    //  Over twice the husks at three fifths of their health, three times
    //  the batch at the fastest pace, and the room's highest cap.
    [WaveName.Horde]: {
        count: 2.2,
        health: 0.6,
        batch: 3,
        interval: 0,
        mix: { [MonsterKind.Husk]: 1 },
        cap: hordeCap,
        elites: false,
    },
};

/** Wave `wave` against `wardens` wardens: four more monsters a wave, six
 *  in ten more for each warden past the first, a fifth fewer for one
 *  alone and two fifths more for a pair, in batches that grow with the night and the crowd, a batch
 *  every 3.3 s at wave 1 and a tenth of a second sooner each wave, to
 *  1.8 s; a colossus and a smaller escort every fifth wave, and the
 *  night's last colossus larger with a larger escort. A named wave
 *  reshapes it. */
export function planWave(
    wave: number,
    wardens: number,
    name = WaveName.Plain,
): WavePlan {
    const crowd =
        wardens <= 1
            ? soloShare
            : wardens === 2
              ? pairShare
              : 1 + 0.6 * (wardens - 1);
    const bosses = wave > 0 && wave % bossEvery === 0 ? 1 : 0;
    const last = wave === nightWaves;
    const count = (8 + 4 * wave) * crowd;
    const health = measureHealth(wave);
    const plain: WavePlan = {
        count:
            bosses > 0
                ? bosses +
                  Math.round(count * (last ? lastEscortShare : escortShare))
                : Math.round(count),
        health,
        //  A slow climb that never flattens: by wave 20 a husk walks at
        //  4.4 m/s, still under a warden's run.
        speed: 1 + 0.025 * (wave - 1),
        //  Level with the health her Iron Heart and Second Wind add on
        //  average picks.
        damage: 1 + 0.04 * (wave - 1),
        interval: Math.max(1.8, 3.4 - 0.1 * wave),
        //  Two a batch to wave 3, one more each fourth wave, times the
        //  crowd, so a wave takes about as long for four wardens as one.
        batch: Math.round((2 + Math.floor(wave / 4)) * Math.max(1, crowd)),
        bosses,
        bossHealth:
            health *
            (1 + 0.75 * (Math.max(wardens, 1) - 1)) *
            (last ? lastBossHealth : 1),
        bossSize: last ? lastBossSize : 1,
        cap: standingCap,
        elites: true,
    };
    if (name === WaveName.Plain || bosses > 0) return plain;
    const shape = namedShapes[name];
    return {
        ...plain,
        count: Math.max(3, Math.round(count * shape.count)),
        health: health * shape.health,
        batch: Math.max(1, Math.round(plain.batch * shape.batch)),
        interval: Math.max(0.5, plain.interval * shape.interval),
        mix: shape.mix,
        cap: shape.cap,
        elites: shape.elites,
    };
}

/** The names a night's named waves draw from. */
const waveNames = Object.keys(namedShapes) as Exclude<
    WaveName,
    WaveName.Plain
>[];

/** Two waves of `first` to `first + 3` with one between them at least. */
function drawApart(seeded: Seeded, first: number) {
    const pairs = [
        [first, first + 2],
        [first, first + 3],
        [first + 1, first + 3],
    ];
    return pairs[drawIndex(seeded, pairs.length)];
}

/** The draws in a random order. */
function shuffle<T>(seeded: Seeded, items: T[]) {
    const left = [...items];
    const order: T[] = [];
    while (left.length > 0)
        order.push(...left.splice(drawIndex(seeded, left.length), 1));
    return order;
}

/** The night's named waves from its seed: one of the waves before the
 *  first colossus and two between each colossus after, none next to
 *  another, five of fifteen. The first is a Swarm or a Horde, since the
 *  brutes come with the first colossus, and a Swarm at wave 3; every name comes once, and a
 *  fifth that differs from the one before it. */
function planNight(seed: number) {
    const seeded = { seed };
    const waves = [
        3 + drawIndex(seeded, 2),
        ...drawApart(seeded, bossEvery + 1),
        ...drawApart(seeded, 2 * bossEvery + 1),
    ];
    const drawn = [WaveName.Swarm, WaveName.Horde][drawIndex(seeded, 2)];
    //  A Horde of 28 at wave 3 floods a player still learning to aim.
    const first = waves[0] < firstHordeWave ? WaveName.Swarm : drawn;
    const rest = shuffle(
        seeded,
        waveNames.filter((name) => name !== first),
    );
    const fifth = waveNames.filter((name) => name !== rest.at(-1));
    const names = [first, ...rest, fifth[drawIndex(seeded, fifth.length)]];
    return new Map(waves.map((wave, index) => [wave, names[index]]));
}

/** The first wave a Horde may come. */
export const firstHordeWave = 4;

/** Waves of each Endless cycle that carry a name: two of every five,
 *  apart, neither the colossus's. */
const endlessNamed = [2, 4];

/** A name for Endless wave `wave`, from a seed of its own, other than
 *  `before`. */
function drawName(seed: number, wave: number, before: WaveName) {
    const seeded = { seed: (seed + Math.imul(wave, 0x9e3779b9)) | 0 };
    const open = waveNames.filter((name) => name !== before);
    return open[drawIndex(seeded, open.length)];
}

/** An Endless wave's name: the waves `endlessNamed` picks of each cycle,
 *  each drawn from its own seed and never the name of the named wave
 *  before it. */
function nameEndlessWave(seed: number, wave: number): WaveName {
    if (!endlessNamed.includes(wave % bossEvery)) return WaveName.Plain;
    let before: WaveName = WaveName.Plain;
    for (let earlier = nightWaves + 1; earlier < wave; earlier++)
        if (endlessNamed.includes(earlier % bossEvery))
            before = drawName(seed, earlier, before);
    return drawName(seed, wave, before);
}

/** The name of wave `wave` of the night drawn from `seed`, or plain: a
 *  third of the night's waves carry one, and two in five of Endless's.
 *  A pure answer, so the room and a test read the same night. */
export function nameWave(seed: number, wave: number): WaveName {
    if (wave > nightWaves) return nameEndlessWave(seed, wave);
    return planNight(seed).get(wave) ?? WaveName.Plain;
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

/** A kind for the next monster of wave `wave`, weighted among the kinds a
 *  named wave's `mix` sends, or else among the kinds that have come by
 *  then. */
export function drawMonsterKind(siege: Seeded, wave: number, mix?: MonsterMix) {
    const weigh = (kind: MonsterKind) => {
        if (mix) return mix[kind] ?? 0;
        const { firstWave, weight } = monsterSettings[kind];
        return firstWave <= wave ? weight : 0;
    };
    let total = 0;
    for (const kind of monsterKinds) total += weigh(kind);
    let pick = drawRandom(siege) * total;
    for (const kind of monsterKinds) {
        const weight = weigh(kind);
        if (weight === 0) continue;
        pick -= weight;
        if (pick < 0) return kind;
    }
    return MonsterKind.Husk;
}
