//  Depthfield's tuning, as the source game wrote it. Distances and speeds
//  are in the source's units, which `u` turns into metres where a rule
//  meets the engine: 42 units a metre, so the soldier's 210 units a second
//  is the engine's own walking speed of 5 metres a second.

/** Source units a metre. */
export const unitsPerMetre = 42;

/** Metres in `units` of the source game. */
export function u(units: number) {
    return units / unitsPerMetre;
}

/** Seconds a run lasts before the boss lands. */
export const bossAtSeconds = 180;
/** Metres from the centre to each wall, on both axes. */
export const boundary = u(1050);
/** Most enemies alive at once. */
export const enemyCap = 170;
/** Metres the hero's body is round, for the enemies' touch. */
export const heroRadius = u(16);

export enum WeaponId {
    Pulse = "pulse",
    Laser = "laser",
    Boomerang = "boomerang",
    Shard = "shard",
    Nova = "nova",
    Mine = "mine",
    Zap = "zap",
}

export const weaponIds = [
    WeaponId.Pulse,
    WeaponId.Laser,
    WeaponId.Boomerang,
    WeaponId.Shard,
    WeaponId.Nova,
    WeaponId.Mine,
    WeaponId.Zap,
] as const;

/** One weapon's state in a run: what it deals, how often, and its level. */
export interface WeaponState {
    owned: boolean;
    name: string;
    damage: number;
    /** Damage a power upgrade adds at Normal rarity. */
    gain: number;
    /** Seconds between shots. */
    interval: number;
    count: number;
    /** Shards: metres the pellets fly. */
    range: number;
    /** Nova: metres the ring grows to. */
    radius: number;
    /** Zap: enemies a bolt jumps on to. */
    bounces: number;
    /** Seconds to the next shot. */
    clock: number;
    level: number;
}

type WeaponRecord = Record<WeaponId, WeaponState>;

function weapon(
    name: string,
    fields: Partial<WeaponState> &
        Pick<WeaponState, "damage" | "gain" | "interval" | "clock">,
): WeaponState {
    return {
        owned: false,
        name,
        count: 1,
        range: 0,
        radius: 0,
        bounces: 0,
        level: 1,
        ...fields,
    };
}

/** Every weapon at the start of a run, none owned. */
export function createWeapons(): WeaponRecord {
    return {
        pulse: weapon("Bullet", {
            damage: 28,
            gain: 7,
            interval: 0.7,
            clock: 0,
        }),
        laser: weapon("Laser", {
            damage: 42,
            gain: 10,
            interval: 1.8,
            clock: 0.4,
        }),
        boomerang: weapon("Boomerang", {
            damage: 25,
            gain: 6,
            interval: 2.2,
            clock: 0.8,
        }),
        shard: weapon("Shards", {
            damage: 9,
            gain: 3,
            interval: 0.95,
            range: 160,
            clock: 0.1,
        }),
        nova: weapon("Nova", {
            damage: 34,
            gain: 9,
            interval: 2.4,
            radius: 150,
            clock: 0.6,
        }),
        mine: weapon("Mine", {
            damage: 52,
            gain: 13,
            interval: 2.7,
            clock: 1,
        }),
        zap: weapon("Zap", {
            damage: 20,
            gain: 5,
            interval: 0.8,
            bounces: 1,
            clock: 0.2,
        }),
    };
}

export const weaponBlurbs: Record<WeaponId, string> = {
    pulse: "Fires at the nearest enemy.",
    laser: "A beam that pierces enemies.",
    boomerang: "Hits on the way out and back.",
    shard: "Fires five close-range pellets.",
    nova: "A ring that hits nearby enemies.",
    mine: "Drops explosive proximity mines.",
    zap: "A bolt that jumps to a nearby enemy.",
};

/** What each weapon does, for the field notes' loadout. */
export const weaponSummaries: Record<WeaponId, string> = {
    pulse: "Nearest-target projectiles",
    laser: "Pierces enemies in a line",
    boomerang: "Hits outward and on return",
    shard: "Shotgun · range upgrades",
    nova: "Expanding ring · radius upgrades",
    mine: "Detonates when stepped on",
    zap: "Jumps to a nearby enemy",
};

export const weaponIcons: Record<WeaponId, string> = {
    pulse: "↗",
    laser: "ϟ",
    boomerang: "⌁",
    shard: "✶",
    nova: "◎",
    mine: "✸",
    zap: "⚡",
};

export enum ClassId {
    Soldier = "soldier",
    Prophet = "prophet",
    Vanguard = "vanguard",
    Skirmisher = "skirmisher",
    Sentinel = "sentinel",
    Artillerist = "artillerist",
}

/** A class a run rolls: times the base health, move speed, fire rate and
 *  range it gives, and its share of the rolls. */
export interface RunClass {
    id: ClassId;
    name: string;
    chance: number;
    hp: number;
    move: number;
    rate: number;
    range: number;
}

export const classes: readonly RunClass[] = [
    {
        id: ClassId.Soldier,
        name: "Soldier",
        chance: 0.15,
        hp: 1,
        move: 1,
        rate: 1,
        range: 1,
    },
    {
        id: ClassId.Prophet,
        name: "Prophet",
        chance: 0.05,
        hp: 1.5,
        move: 1.5,
        rate: 1.5,
        range: 1.5,
    },
    {
        id: ClassId.Vanguard,
        name: "Vanguard",
        chance: 0.2,
        hp: 1.3,
        move: 1.25,
        rate: 0.8,
        range: 0.75,
    },
    {
        id: ClassId.Skirmisher,
        name: "Skirmisher",
        chance: 0.2,
        hp: 0.75,
        move: 1.4,
        rate: 1.35,
        range: 0.75,
    },
    {
        id: ClassId.Sentinel,
        name: "Sentinel",
        chance: 0.2,
        hp: 1.4,
        move: 0.75,
        rate: 0.85,
        range: 1.15,
    },
    {
        id: ClassId.Artillerist,
        name: "Artillerist",
        chance: 0.2,
        hp: 0.85,
        move: 0.8,
        rate: 0.8,
        range: 1.65,
    },
];

/** The class `roll`, a draw from 0 to 1, lands on. */
export function rollClass(roll: number): RunClass {
    for (const each of classes) {
        roll -= each.chance;
        if (roll <= 0) return each;
    }
    return classes[0];
}

export function findClass(id: ClassId) {
    return classes.find((each) => each.id === id) ?? classes[0];
}

export enum LookId {
    Grove = "grove",
    Ember = "ember",
    Tide = "tide",
    Violet = "violet",
    Gilt = "gilt",
    Prismatic = "prismatic",
}

/** A look the hero wears: the name's colour, its shade, and the degrees the
 *  soldier's sprite turns round the colour wheel. */
export interface Look {
    id: LookId;
    name: string;
    color: string;
    shade: string;
    hue: number;
}

export const looks: readonly Look[] = [
    {
        id: LookId.Grove,
        name: "Grove",
        color: "#b4ee94",
        shade: "#3f6b4e",
        hue: 25,
    },
    {
        id: LookId.Ember,
        name: "Ember",
        color: "#ffb085",
        shade: "#8a4630",
        hue: -55,
    },
    {
        id: LookId.Tide,
        name: "Tide",
        color: "#8fd4ff",
        shade: "#2f5f78",
        hue: 125,
    },
    {
        id: LookId.Violet,
        name: "Violet",
        color: "#d2b4ff",
        shade: "#5a4580",
        hue: 210,
    },
    {
        id: LookId.Gilt,
        name: "Gilt",
        color: "#ffe08a",
        shade: "#8a6828",
        hue: -15,
    },
    {
        id: LookId.Prismatic,
        name: "Prismatic",
        color: "#e7fbff",
        shade: "#5a3d86",
        hue: 0,
    },
];

export function findLook(id: LookId) {
    return looks.find((each) => each.id === id) ?? looks[0];
}

/** Career kills that unlock the Prismatic look. */
export const prismaticKills = 100;
/** Finished runs that unlock Zap as a starting weapon. */
export const zapRuns = 1;

export enum EnemyKind {
    Grunt = "grunt",
    Runner = "runner",
    Tank = "tank",
    Shooter = "shooter",
    Summoner = "summoner",
    Elite = "elite",
    Boss = "boss",
    CrimsonElite = "crimsonElite",
    LootRunner = "lootRunner",
}

/** Each kind's body: metres round, health and metres a second, plus the
 *  experience its orb carries and the orb's colour. */
export interface EnemyStats {
    radius: number;
    health: number;
    speed: number;
    xp: number;
    orb: string;
    color: string;
    name: string;
}

export const enemyStats: Record<EnemyKind, EnemyStats> = {
    grunt: {
        radius: u(16),
        health: 17,
        speed: u(70),
        xp: 1,
        orb: "#68d9b7",
        color: "#df8d7e",
        name: "Grunt",
    },
    runner: {
        radius: u(11),
        health: 18,
        speed: u(116),
        xp: 1,
        orb: "#91deb8",
        color: "#f0b884",
        name: "Runner",
    },
    tank: {
        radius: u(22),
        health: 85,
        speed: u(49),
        xp: 2,
        orb: "#f1cf88",
        color: "#be8297",
        name: "Tank",
    },
    shooter: {
        radius: u(16),
        health: 45,
        speed: u(55),
        xp: 1.15,
        orb: "#8dcdf1",
        color: "#b49be9",
        name: "Shooter",
    },
    summoner: {
        radius: u(21),
        health: 100,
        speed: u(65),
        xp: 1.5,
        orb: "#c4acef",
        color: "#63d7c1",
        name: "Summoner",
    },
    elite: {
        radius: u(28),
        health: 420,
        speed: u(46),
        xp: 8,
        orb: "#ffe27a",
        color: "#f4d56a",
        name: "Elite",
    },
    boss: {
        radius: u(44),
        health: 6000,
        speed: u(74),
        xp: 40,
        orb: "#ff6a58",
        color: "#ff5a4a",
        name: "Boss",
    },
    crimsonElite: {
        radius: u(30),
        health: 640,
        speed: u(58),
        xp: 12,
        orb: "#ff8a78",
        color: "#ff8a78",
        name: "Crimson elite",
    },
    lootRunner: {
        radius: u(18),
        health: 380,
        speed: u(150),
        xp: 1,
        orb: "#ffe27a",
        color: "#ffe9a0",
        name: "Loot runner",
    },
};

/** Whether `kind` is one of the elites or the boss, which telegraph. */
export function isBig(kind: EnemyKind) {
    return (
        kind === EnemyKind.Elite ||
        kind === EnemyKind.CrimsonElite ||
        kind === EnemyKind.Boss
    );
}

export enum RarityId {
    Normal = "normal",
    Rare = "rare",
    Epic = "epic",
    Legendary = "legendary",
    Prismatic = "prismatic",
}

/** A card's rarity: its share of the rolls, the times its gain, the share
 *  of cooldown it takes off, the projectiles it adds, and its XP bonus. */
export interface Rarity {
    id: RarityId;
    name: string;
    weight: number;
    mult: number;
    rate: number;
    count: number;
    xp: number;
    supply: number;
    /** Its share of the rolls at full upgrade luck. */
    lucky: number;
}

export const rarities: readonly Rarity[] = [
    {
        id: RarityId.Normal,
        name: "Normal",
        weight: 0.749,
        mult: 1,
        rate: 0.15,
        count: 1,
        xp: 0.025,
        supply: 0.25,
        lucky: 0.05,
    },
    {
        id: RarityId.Rare,
        name: "Rare",
        weight: 0.2,
        mult: 1.5,
        rate: 0.2,
        count: 2,
        xp: 0.05,
        supply: 0.4,
        lucky: 0.15,
    },
    {
        id: RarityId.Epic,
        name: "Epic",
        weight: 0.04,
        mult: 2,
        rate: 0.25,
        count: 3,
        xp: 0.075,
        supply: 0.6,
        lucky: 0.25,
    },
    {
        id: RarityId.Legendary,
        name: "Legendary",
        weight: 0.01,
        mult: 3,
        rate: 0.35,
        count: 4,
        xp: 0.1,
        supply: 1,
        lucky: 0.35,
    },
    {
        id: RarityId.Prismatic,
        name: "Prismatic",
        weight: 0.001,
        mult: 1,
        rate: 0.15,
        count: 1,
        xp: 0.025,
        supply: 0.25,
        lucky: 0.2,
    },
];

export function findRarity(id: RarityId) {
    return rarities.find((each) => each.id === id) ?? rarities[0];
}

/** Rounds `value` to two places, as the source prints a share. */
export function round2(value: number) {
    return Number(value.toFixed(2));
}
