import { type Entity } from "koota";
import { defineEventTrait, defineTrait } from "@spawnite/engine/core";
import {
    ClassId,
    createWeapons,
    EnemyKind,
    LookId,
    RarityId,
    WeaponId,
} from "./data";
import { StageId } from "./stages";

//  The run's state and every thing on the field, each on its own entity.
//  Each is defined under its name in the dump, the devtools' inspector and
//  a simulate's condition, such as count('enemy').
//  Positions are the engine's Transform, in metres, on the ground plane:
//  the source's x is x and its y is z, so down the screen is toward the
//  camera.

export enum RunPhase {
    /** The field has mounted and no run has started yet. */
    Title = "title",
    Playing = "playing",
    /** A level-up's cards are on the screen, and the world holds still. */
    Upgrade = "upgrade",
    /** The hero fell: the field fades to black before the death screen. */
    Dying = "dying",
    /** The boss fell: it bursts apart before the victory screen. */
    BossDeath = "bossDeath",
    /** The hero fell: the run is lost. */
    Defeated = "defeated",
    /** The boss fell, or the hero fell in an endless run: the run is won. */
    Complete = "complete",
}

export enum OfferKind {
    Loadout = "loadout",
    Weapon = "weapon",
    Utility = "utility",
}

/** One card of a level-up: the upgrade it applies, at its rarity; a new
 *  weapon's card has none. */
export interface Card {
    id: string;
    rarity: RarityId | null;
}

export interface Offer {
    kind: OfferKind;
    cards: Card[];
}

/** What a run was started with, off the lobby. */
export interface RunChoice {
    nickname: string;
    look: LookId;
    starter: WeaponId;
    classId: ClassId;
    stage: StageId;
}

/** Everything a run keeps beside what stands on the field. One record,
 *  written in place by the rules; a view reads it each frame. */
export function createRun() {
    return {
        phase: RunPhase.Title,
        nickname: "",
        look: LookId.Grove,
        classId: ClassId.Soldier,
        starter: WeaponId.Pulse,
        /** The stage the run is played on. */
        stage: StageId.Grid,
        /** The Prism Vault's beam: the cycle its line was placed for, and
         *  where on its axis the sweep starts, in metres. */
        beamCycle: -1,
        beamFrom: 0,
        /** Seconds since the run started. */
        time: 0,
        kills: 0,
        level: 1,
        xp: 0,
        nextXp: 5,
        /** The hero's move speed, in source units a second. */
        speed: 210,
        spawnClock: 0.8,
        /** Seconds the hero takes no damage for. */
        invul: 0,
        dashCooldown: 0,
        dashTime: 0,
        /** Seconds the hero keeps aiming at its last shot. */
        aimTime: 0,
        /** The way the hero last moved, on the ground: x and z. */
        faceX: 1,
        faceZ: 0,
        /** The most health the hero holds: the class's, plus each +5. */
        maxHealth: 100,
        /** Whether the hero's health was filled to the class's at the start. */
        healthFilled: false,
        permanentHealth: 0,
        dropChance: 0.05,
        /** Seconds of double experience left. */
        xpBoost: 0,
        xpMult: 1,
        consumableBonus: 0,
        regen: 0,
        regenRanks: 0,
        seenIntro: 0,
        lootSpawned: 0,
        damageDealt: 0,
        weaponDamage: {} as Partial<Record<WeaponId, number>>,
        bossDeathTimer: 0,
        deathTimer: 0,
        rerolls: 3,
        rerollPlus: 1,
        eliteAt60: false,
        eliteAt120: false,
        magnetAt60: false,
        magnetAt120: false,
        bossPhase: false,
        /** Seconds until the boss lands; below zero before its phase. */
        bossLand: -1,
        /** The player kept going after the boss: the waves, elites and
         *  bosses come on with no end. */
        endless: false,
        /** The run's second the next endless elite comes, and the boss. */
        nextEliteAt: 0,
        nextBossAt: 0,
        /** Endless elites called so far: even ones gold, odd ones crimson. */
        endlessElites: 0,
        hasTwin: false,
        forcePrismatic: false,
        loadout: [] as WeaponId[],
        weapons: createWeapons(),
        offer: null as Offer | null,
        /** Playtest controls, which the devtools panel sets. */
        spawning: true,
        /** Upgrade luck, 0 to 1: how far the rarity odds lean to the rare. */
        luck: 0,
        /** Whether Zap may be offered as a new weapon: a run was finished
         *  before this one. */
        zapUnlocked: false,
    };
}

export type RunState = ReturnType<typeof createRun>;

export const RunTrait = defineTrait("run", createRun);

/** A step in an enemy's attack: its walk, a telegraph, then the strike. */
export enum EnemyPhase {
    Walk = "walk",
    /** Tank: the lane shows before the dash. */
    Charge = "charge",
    Dash = "dash",
    StompCharge = "stompCharge",
    Recover = "recover",
    JavelinTell = "javelinTell",
    JavelinDash = "javelinDash",
    RiftTell = "riftTell",
    ShearTell = "shearTell",
    ShearFire = "shearFire",
    Land = "land",
    RingTell = "ringTell",
    RingFire = "ringFire",
    RushTell = "rushTell",
    RushDash = "rushDash",
    Slash = "slash",
    Triad = "triad",
}

/** A mark on the ground an attack will land on. */
export interface Mark {
    x: number;
    z: number;
    done: boolean;
}

export function createEnemy() {
    return {
        kind: EnemyKind.Grunt,
        radius: 0,
        speed: 0,
        phase: EnemyPhase.Walk,
        phaseTimer: 0,
        /** The whole of the telegraph now showing, for its charge bar. */
        tellSeconds: 0,
        shotTimer: 0,
        summonTimer: 5,
        summonsMade: 0,
        /** Seconds the hit flash still shows. */
        hit: 0,
        dashCooldown: 1.5,
        dashX: 0,
        dashZ: 0,
        /** Metres the lane of a dash reaches. */
        reach: 0,
        javelinCooldown: 1.4,
        riftCooldown: 3.2,
        shearCooldown: 99,
        ringCooldown: 2.2,
        rushCooldown: 3.4,
        triadCooldown: 4.2,
        landRadius: 0,
        ringRadius: 0,
        struck: false,
        /** The angle a shear or slash sweeps from, and its tip now. */
        sweepFrom: 0,
        sweepAngle: 0,
        tipX: 0,
        tipZ: 0,
        marks: [] as Mark[],
        wander: 0,
        wanderTimer: 0,
        /** Running from the field as the boss lands. */
        flee: false,
        /** The run's second until which its health bar shows. */
        healthBarUntil: -1,
        /** The boss, fallen, bursting apart; seconds since it fell. */
        dying: false,
        deathSeconds: 0,
    };
}

export type EnemyState = ReturnType<typeof createEnemy>;

export const EnemyTrait = defineTrait("enemy", createEnemy);

export enum BoltKind {
    Pulse = "pulse",
    Shard = "shard",
    Zap = "zap",
}

/** Who fired a shot: the hero, or the Prismatic echo beside the hero. */
export enum Shooter {
    Hero = "hero",
    Echo = "echo",
}

/** A bullet, a shard pellet or a zap: flies straight, hits the first enemy
 *  its path crosses. A zap jumps on, skipping the enemies it hit. */
export function createBolt() {
    return {
        kind: BoltKind.Pulse,
        vx: 0,
        vz: 0,
        life: 0,
        damage: 0,
        bounces: 0,
        /** The enemies a zap has struck, which it never jumps back to. */
        hit: [] as Entity[],
    };
}

export type BoltState = ReturnType<typeof createBolt>;

export const BoltTrait = defineTrait("bolt", createBolt);

/** A laser's beam, which struck everything on it the step it fired. */
export const LaserTrait = defineTrait("laser", () => ({
    fromX: 0,
    fromZ: 0,
    toX: 0,
    toZ: 0,
    life: 0,
}));

export const BoomerangTrait = defineTrait("boomerang", () => ({
    vx: 0,
    vz: 0,
    age: 0,
    returning: false,
    life: 4,
    damage: 0,
    owner: Shooter.Hero,
    hits: [] as Entity[],
}));

export const NovaTrait = defineTrait("nova", () => ({
    radius: 0,
    max: 0,
    life: 0,
    damage: 0,
    hits: [] as Entity[],
}));

export const MineTrait = defineTrait("mine", () => ({
    life: 7,
    arm: 0.3,
    radius: 0,
    damage: 0,
    spent: false,
}));

/** A shooter's orb, flying at the hero. */
export const EnemyShotTrait = defineTrait("enemyShot", () => ({
    vx: 0,
    vz: 0,
    life: 6,
}));

/** A ring an elite or the boss marked, which hurts on its last moment. */
export const BlastTrait = defineTrait("blast", () => ({
    radius: 0,
    life: 0,
    maxLife: 0,
    fired: false,
}));

/** A tank's stomp ring, fading. */
export const StompTrait = defineTrait("stomp", () => ({ life: 0.35 }));

/** An experience orb: the experience it carries and the kind it fell from. */
export const GemTrait = defineTrait("gem", () => ({
    value: 1,
    kind: EnemyKind.Grunt,
    magnetized: false,
}));

export enum DropKind {
    /** +5 maximum health for the run. */
    Health = "health",
    /** Pulls every orb in. */
    Magnet = "magnet",
    /** Double experience for ten seconds. */
    DoubleXp = "doubleXp",
    /** Heals 35. */
    Food = "food",
}

export const DropTrait = defineTrait("drop", () => ({ kind: DropKind.Health }));

/** A burst of sparks at a spot on the ground. */
export interface Spark {
    x: number;
    z: number;
    color: string;
    count: number;
}

/** The sparks the step threw, for the view to draw. */
export const SparksTrait = defineEventTrait("sparks", () => ({
    list: [] as Spark[],
}));

/** An enemy the step killed, where it stood, for the view to play its
 *  fall: the enemy itself is gone by the next step. */
export interface Fall {
    x: number;
    z: number;
    kind: EnemyKind;
}

/** The enemies the step killed. */
export const FelledTrait = defineEventTrait("felled", () => ({
    list: [] as Fall[],
}));

/** A weapon the step fired, who fired it and where at, for the view to
 *  turn the soldier, raise that weapon's gun and flash its muzzle. */
export interface Shot {
    weapon: WeaponId;
    owner: Shooter;
    toX: number;
    toZ: number;
}

/** The weapons the step fired. */
export const ShotsTrait = defineEventTrait("shots", () => ({
    list: [] as Shot[],
}));

export enum Cue {
    Pulse = "pulse",
    Laser = "laser",
    Boomerang = "boomerang",
    Shard = "shard",
    Nova = "nova",
    Mine = "mine",
    Zap = "zap",
    Death = "death",
    Orb = "orb",
    Food = "food",
    Health = "health",
    Magnet = "magnet",
    DoubleXp = "doubleXp",
    Legendary = "legendary",
    BossMusic = "bossMusic",
    Fanfare = "fanfare",
    Fallen = "fallen",
}

/** The sounds the step made, for the page to play. */
export const CuesTrait = defineEventTrait("cues", () => ({
    list: [] as Cue[],
}));

/** A line for the toast under the field. */
export const ToastTrait = defineEventTrait("toast", { text: "" });
