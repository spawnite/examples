import { EnemyKind, u } from "./data";
import type { Spot } from "./field";

//  The three stages a run is played on, each its own layout, palette,
//  floor hazard and mix of enemies. The Neon Grid is the source's arena as
//  it was; the Ember Foundry and the Prism Vault unlock one after another.
//  Distances are in the source's units, which `u` turns into metres.

export enum StageId {
    Grid = "grid",
    Foundry = "foundry",
    Vault = "vault",
}

/** A prop standing on the field: its centre, its radius for the bodies
 *  that walk into it, and its height. */
export interface Prop {
    x: number;
    z: number;
    radius: number;
    height: number;
}

/** A prop in the source's units: x, z, radius and height. */
type PropUnits = readonly [number, number, number, number];

function placeProps(list: readonly PropUnits[]): readonly Prop[] {
    return list.map(([x, z, radius, height]) => ({
        x: u(x),
        z: u(z),
        radius: u(radius),
        height: u(height),
    }));
}

/** Spots in the source's units, x and z, in metres. */
function placeSpots(list: readonly (readonly [number, number])[]): Spot[] {
    return list.map(([x, z]) => ({ x: u(x), z: u(z) }));
}

/** The grid's four sets of lines: along z, every other one brighter, and
 *  across it, the same. */
export interface GridPaint {
    alongMajor: string;
    alongMinor: string;
    acrossMajor: string;
    acrossMinor: string;
}

/** A wall's or a block's sides and its lit top. */
export interface BlockPaint {
    side: string;
    top: string;
}

/** A prop's paint: its sides and top, and the glowing line round its top. */
export interface PropPaint extends BlockPaint {
    rim: string;
}

/** Every colour a stage draws in. */
export interface StagePalette {
    floor: string;
    grid: GridPaint;
    /** The ring round the centre. */
    ring: string;
    /** The far wall, the near wall and the two side walls. */
    farWall: BlockPaint;
    nearWall: BlockPaint;
    sideWalls: BlockPaint;
    props: PropPaint;
    /** The faint shadow under each prop. */
    shadow: string;
    /** The void's sky, from the top of the screen down: written as sRGB. */
    skyTop: string;
    skyMiddle: string;
    skyBottom: string;
}

export enum HazardKind {
    None = "none",
    /** Vents in the floor that glow, then erupt, each on its own beat. */
    Vents = "vents",
    /** A beam wall to wall that sweeps the field. */
    Beam = "beam",
}

/** A hazard's beat: a telegraph, then its strike, once each cycle. */
export interface HazardTiming {
    cycleSeconds: number;
    tellSeconds: number;
    strikeSeconds: number;
}

/** What a hazard's strike deals: to the hero, before the threat grows it,
 *  and to each enemy it catches. */
export interface HazardHarm {
    heroDamage: number;
    enemyDamage: number;
    /** The telegraph's colour, and the strike's. */
    tellColor: string;
    strikeColor: string;
}

export interface NoHazard {
    kind: HazardKind.None;
}

export interface VentHazard extends HazardTiming, HazardHarm {
    kind: HazardKind.Vents;
    vents: readonly Spot[];
    /** Metres round each vent's centre an eruption reaches. */
    radius: number;
    /** Seconds between two burns of an eruption on what stands in it. */
    tickSeconds: number;
    /** The vents' beats are spread round the cycle in this stride, so
     *  neighbours do not erupt one after another. */
    stagger: number;
}

export interface BeamHazard extends HazardTiming, HazardHarm {
    kind: HazardKind.Beam;
    /** Metres before the hero the beam's line appears, on the side it
     *  sweeps from. */
    lead: number;
    /** Metres a second the beam sweeps. */
    speed: number;
    /** Metres across the beam is drawn. */
    width: number;
}

export type Hazard = NoHazard | VentHazard | BeamHazard;

/** The kinds that spawn on their own. */
export type SpawnKind =
    | EnemyKind.Grunt
    | EnemyKind.Runner
    | EnemyKind.Tank
    | EnemyKind.Shooter
    | EnemyKind.Summoner;

/** A kind joining a stage's waves: the second it joins, and its share of
 *  the picks beside the others, 1 for an even share. */
export interface KindJoin {
    kind: SpawnKind;
    at: number;
    weight: number;
}

/** What a run must do to open a stage. */
export enum UnlockMoment {
    /** A run on the stage before reaches the boss. */
    BossReached = "bossReached",
    /** The boss falls on the stage before. */
    BossBeaten = "bossBeaten",
}

export interface StageUnlock {
    after: StageId;
    moment: UnlockMoment;
    /** What the lobby shows on the stage while it is locked. */
    label: string;
}

export interface Stage {
    id: StageId;
    name: string;
    props: readonly Prop[];
    palette: StagePalette;
    hazard: Hazard;
    /** The kinds of the waves, in the order they join. */
    joins: readonly KindJoin[];
    /** The share of the Neon Grid's seconds between two wave spawns: above
     *  1 spawns slower, below it faster. */
    spawnIntervalShare: number;
    /** How a run opens it; none for the stage open from the start. */
    unlock?: StageUnlock;
}

/** The Neon Grid's fifteen props, as the source placed them. */
const gridProps = placeProps([
    [-270, -100, 33, 95],
    [-210, 90, 38, 40],
    [240, 60, 40, 115],
    [370, -210, 35, 50],
    [-420, -350, 42, 110],
    [65, -390, 45, 48],
    [0, 330, 39, 105],
    [430, 340, 46, 45],
    [-370, 430, 35, 60],
    [710, 0, 43, 110],
    [-710, 50, 40, 100],
    [0, -720, 36, 100],
    [80, 720, 40, 65],
    [650, 660, 35, 100],
    [-610, -680, 40, 45],
]);

/** The furnace ring round the Foundry's centre: units from the centre to
 *  each block, each block's radius and height, and the blocks in each of
 *  its four arcs, which leave a gap on each axis. */
const furnaceRingRadius = 300;
const furnaceBlockRadius = 40;
const furnaceBlockHeight = 75;
const furnaceBlocksPerArc = 4;

/** The furnace ring's blocks, side by side along each arc, the arcs
 *  centred on the diagonals. */
function buildFurnaceRing(): PropUnits[] {
    const spacing = (furnaceBlockRadius * 2) / furnaceRingRadius;
    const blocks: PropUnits[] = [];
    for (let arc = 0; arc < 4; arc++) {
        const centre = Math.PI / 4 + (arc * Math.PI) / 2;
        for (let block = 0; block < furnaceBlocksPerArc; block++) {
            const angle =
                centre + (block - (furnaceBlocksPerArc - 1) / 2) * spacing;
            blocks.push([
                Math.round(Math.cos(angle) * furnaceRingRadius),
                Math.round(Math.sin(angle) * furnaceRingRadius),
                furnaceBlockRadius,
                furnaceBlockHeight,
            ]);
        }
    }
    return blocks;
}

const foundryProps = placeProps([
    ...buildFurnaceRing(),
    //  Smaller blocks scattered further out.
    [640, 210, 28, 50],
    [-620, -240, 30, 45],
    [220, -650, 26, 55],
    [-240, 660, 28, 50],
    [820, -760, 32, 60],
    [-800, 780, 30, 55],
    [880, 520, 26, 45],
    [-860, -560, 28, 50],
]);

/** The Vault's pillars: four columns of them along z, close enough to
 *  read as lanes, with one gap across the middle, and each pillar's radius
 *  and height. */
const vaultColumns = [-560, -200, 200, 560];
const vaultRows = [
    -840, -700, -560, -420, -280, -140, 140, 280, 420, 560, 700, 840,
];
const vaultPillarRadius = 24;
const vaultPillarHeight = 150;

const vaultProps = placeProps(
    vaultColumns.flatMap((x) =>
        vaultRows.map((z): PropUnits => [
            x,
            z,
            vaultPillarRadius,
            vaultPillarHeight,
        ]),
    ),
);

export const stages: readonly Stage[] = [
    {
        id: StageId.Grid,
        name: "Neon Grid",
        props: gridProps,
        palette: {
            floor: "#0c1830",
            grid: {
                alongMajor: "#46fff6",
                alongMinor: "#39e7ff",
                acrossMajor: "#ff4ad8",
                acrossMinor: "#ff3ec8",
            },
            ring: "#7af7ff",
            farWall: { side: "#1a1030", top: "#ff4fd8" },
            nearWall: { side: "#1a1030", top: "#7af7ff" },
            sideWalls: { side: "#160e28", top: "#c86bff" },
            props: { side: "#24143a", top: "#3dffe6", rim: "#ff4fd8" },
            shadow: "#627675",
            skyTop: "#3a1460",
            skyMiddle: "#102038",
            skyBottom: "#071018",
        },
        hazard: { kind: HazardKind.None },
        joins: [
            { kind: EnemyKind.Grunt, at: 0, weight: 1 },
            { kind: EnemyKind.Runner, at: 30, weight: 1 },
            { kind: EnemyKind.Tank, at: 60, weight: 1 },
            { kind: EnemyKind.Shooter, at: 90, weight: 1 },
            { kind: EnemyKind.Summoner, at: 120, weight: 1 },
        ],
        spawnIntervalShare: 1,
    },
    {
        id: StageId.Foundry,
        name: "Ember Foundry",
        props: foundryProps,
        palette: {
            floor: "#1c0c07",
            grid: {
                alongMajor: "#ffb347",
                alongMinor: "#ff9a2e",
                acrossMajor: "#ff7a24",
                acrossMinor: "#ff5a14",
            },
            ring: "#ffb347",
            farWall: { side: "#2a1009", top: "#ff6a1f" },
            nearWall: { side: "#2a1009", top: "#ffa040" },
            sideWalls: { side: "#220d07", top: "#ff8030" },
            props: { side: "#2e130b", top: "#6a2610", rim: "#ff6a1f" },
            shadow: "#4a2414",
            skyTop: "#4a1608",
            skyMiddle: "#2a0c06",
            skyBottom: "#120604",
        },
        hazard: {
            kind: HazardKind.Vents,
            vents: placeSpots([
                //  Two inside the ring, one in each of its gaps, and four
                //  out on the diagonals.
                [130, -130],
                [-130, 130],
                [300, 0],
                [0, 300],
                [-300, 0],
                [0, -300],
                [560, 560],
                [-560, 560],
                [560, -560],
                [-560, -560],
            ]),
            radius: u(64),
            cycleSeconds: 7,
            tellSeconds: 1.2,
            strikeSeconds: 1.5,
            tickSeconds: 0.5,
            stagger: 3,
            heroDamage: 10,
            enemyDamage: 25,
            tellColor: "#ff7a2a",
            strikeColor: "#ffb347",
        },
        joins: [
            { kind: EnemyKind.Grunt, at: 0, weight: 1 },
            { kind: EnemyKind.Tank, at: 20, weight: 1 },
            //  Fewer runners: under half the others' share.
            { kind: EnemyKind.Runner, at: 30, weight: 0.4 },
            { kind: EnemyKind.Shooter, at: 45, weight: 1 },
            { kind: EnemyKind.Summoner, at: 120, weight: 1 },
        ],
        spawnIntervalShare: 1.15,
        unlock: {
            after: StageId.Grid,
            moment: UnlockMoment.BossReached,
            label: "reach the boss on Neon Grid",
        },
    },
    {
        id: StageId.Vault,
        name: "Prism Vault",
        props: vaultProps,
        palette: {
            floor: "#150a2c",
            grid: {
                alongMajor: "#ffd76a",
                alongMinor: "#ffe6a0",
                acrossMajor: "#fff6e0",
                acrossMinor: "#ffffff",
            },
            ring: "#ffd76a",
            farWall: { side: "#1e1038", top: "#ffd76a" },
            nearWall: { side: "#1e1038", top: "#fff3d0" },
            sideWalls: { side: "#190d30", top: "#ffcf4a" },
            props: { side: "#24133f", top: "#fff3d0", rim: "#ffd76a" },
            shadow: "#4a3a6a",
            skyTop: "#2c1056",
            skyMiddle: "#140a30",
            skyBottom: "#08041a",
        },
        hazard: {
            kind: HazardKind.Beam,
            cycleSeconds: 12,
            tellSeconds: 1.5,
            strikeSeconds: 5,
            lead: u(400),
            speed: u(420),
            width: u(26),
            heroDamage: 16,
            enemyDamage: 30,
            tellColor: "#ffd76a",
            strikeColor: "#fff6d8",
        },
        joins: [
            { kind: EnemyKind.Grunt, at: 0, weight: 1 },
            { kind: EnemyKind.Runner, at: 10, weight: 1 },
            { kind: EnemyKind.Summoner, at: 60, weight: 1 },
            { kind: EnemyKind.Tank, at: 75, weight: 1 },
            { kind: EnemyKind.Shooter, at: 100, weight: 1 },
        ],
        spawnIntervalShare: 0.85,
        unlock: {
            after: StageId.Foundry,
            moment: UnlockMoment.BossBeaten,
            label: "beat the boss on Ember Foundry",
        },
    },
];

export function findStage(id: StageId) {
    return stages.find((stage) => stage.id === id) ?? stages[0];
}
