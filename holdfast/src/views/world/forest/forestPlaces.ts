import { Color, type Matrix4, Object3D } from "three";
import { roadHalfWidthMetres } from "../../layout";

//  Where each tree of the wood round the arena stands, and how it stands:
//  a pure function of the ground's height, so every page grows the same
//  wood. The wood is clumps and clearings rather than a row: a slow noise
//  over the ground decides where trees gather, and it lets fewer through
//  near the circle than far out, so the arena's edge is scattered trees and
//  the wood thickens behind them.

/** The kinds of tree in the wood, each one file of the nature kit. */
export enum TreeKind {
    PineTall = "pineTall",
    PineRound = "pineRound",
    PineSpire = "pineSpire",
    OakRound = "oakRound",
    OakFat = "oakFat",
}

/** One tree's place, lean and size, and the colours its leaves and bark
 *  are tinted. */
export interface TreePlace {
    kind: TreeKind;
    matrix: Matrix4;
    leaves: Color;
    bark: Color;
}

/** A place on the ground, by its two flat coordinates. */
interface GroundPoint {
    x: number;
    z: number;
}

/** What the placement reads from the ground. */
export interface GroundHeight {
    getHeightAt(position: GroundPoint): number;
}

/** Metres from the middle the nearest tree may stand, and the half size of
 *  the square the wood fills: the map's 50 m edge and a little past it. */
const woodMetres = { inner: 35, edge: 53 };
/** Metres between the candidate places, one per cell of a grid. */
const cellMetres = 3.1;
/** Metres either side of a road's middle kept clear of trunks. */
const roadClearMetres = roadHalfWidthMetres + 3.4;
/** The most a trunk leans off upright, in radians: about four degrees. */
const leanRadians = 0.07;

/** Each kind's scale at a size of one: the files stand one to two units
 *  tall, and a tree here from about three metres, a small fat oak, to
 *  about twenty-five, the tallest pine at the map's edge. */
const kindScale: Record<TreeKind, number> = {
    [TreeKind.PineTall]: 6.8,
    [TreeKind.PineRound]: 6.4,
    [TreeKind.PineSpire]: 7,
    [TreeKind.OakRound]: 5.6,
    [TreeKind.OakFat]: 5.4,
};

/** Leaf greens, darkest and coolest to warmest; a tree takes one along
 *  its kind's range. */
const pineGreens = [
    new Color("#15302f"),
    new Color("#21443a"),
    new Color("#34522f"),
];
const oakGreens = [
    new Color("#2a4a2c"),
    new Color("#446630"),
    new Color("#66702c"),
];
const barkBrowns = [new Color("#2e211c"), new Color("#4d3526")];

/** A fixed pseudo-random value from 0 to 1 for a number. */
function hashTree(value: number) {
    const sine = Math.sin(value * 127.1) * 43758.5453;
    return sine - Math.floor(sine);
}

function smooth(value: number) {
    return value * value * (3 - 2 * value);
}

function clampUnit(value: number) {
    return Math.min(Math.max(value, 0), 1);
}

/** A smooth value from 0 to 1 over the ground, one bump every
 *  `wavelength` metres or so. */
interface NoiseSample {
    point: GroundPoint;
    wavelength: number;
    seed: number;
}

function sampleNoise({ point, wavelength, seed }: NoiseSample) {
    const across = point.x / wavelength;
    const along = point.z / wavelength;
    const column = Math.floor(across);
    const row = Math.floor(along);
    const acrossBlend = smooth(across - column);
    const alongBlend = smooth(along - row);
    const corner = (columnStep: number, rowStep: number) =>
        hashTree((column + columnStep) * 57.3 + (row + rowStep) * 131.7 + seed);
    const near = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * acrossBlend;
    const far = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * acrossBlend;
    return near + (far - near) * alongBlend;
}

/** Whether a place lies in one of the four roads' openings, north, south,
 *  east or west of the circle. */
function isOnRoad({ x, z }: GroundPoint) {
    const alongZ = Math.abs(z) > Math.abs(x);
    return Math.abs(alongZ ? x : z) < roadClearMetres;
}

/** Picks a kind: broadleaf where the slow kind noise is low, pines of
 *  three shapes elsewhere; more broadleaf near the circle and the tallest
 *  pines further out. */
interface KindPick {
    /** The slow noise that sets broadleaf against pine, 0 to 1. */
    kindNoise: number;
    /** 0 at the wood's inner edge, 1 at the map's edge. */
    outward: number;
    /** This tree's own draw, 0 to 1. */
    roll: number;
}

function pickKind({ kindNoise, outward, roll }: KindPick) {
    if (kindNoise < 0.3 + (1 - outward) * 0.12) {
        return roll < 0.55 ? TreeKind.OakRound : TreeKind.OakFat;
    }
    if (roll < 0.15 + outward * 0.2) return TreeKind.PineTall;
    if (roll < 0.64) return TreeKind.PineRound;
    if (roll < 0.92) return TreeKind.PineSpire;
    return TreeKind.OakRound;
}

function isOak(kind: TreeKind) {
    return kind === TreeKind.OakRound || kind === TreeKind.OakFat;
}

/** The colour `at` of the way along a range of shades, from 0 to 1. */
function pickShade(shades: Color[], at: number) {
    const scaled = clampUnit(at) * (shades.length - 1);
    const index = Math.min(Math.floor(scaled), shades.length - 2);
    return new Color().lerpColors(
        shades[index],
        shades[index + 1],
        scaled - index,
    );
}

/** Every tree of the wood, standing on the ground. */
export function placeTrees(ground: GroundHeight | undefined): TreePlace[] {
    const placer = new Object3D();
    const places: TreePlace[] = [];
    const cells = Math.ceil((woodMetres.edge * 2) / cellMetres);
    for (let column = 0; column < cells; column++) {
        for (let row = 0; row < cells; row++) {
            const seed = column * 409 + row * 7;
            const point = {
                x:
                    -woodMetres.edge +
                    (column + 0.15 + hashTree(seed) * 0.7) * cellMetres,
                z:
                    -woodMetres.edge +
                    (row + 0.15 + hashTree(seed + 1) * 0.7) * cellMetres,
            };
            const distance = Math.hypot(point.x, point.z);
            if (distance < woodMetres.inner || isOnRoad(point)) continue;
            //  0 at the circle's edge, 1 at the map's edge and past it.
            const outward = clampUnit((distance - woodMetres.inner) / 14);
            if (
                sampleNoise({ point, wavelength: 11, seed: 3.7 }) <
                0.62 - outward * 0.4
            )
                continue;

            const kind = pickKind({
                kindNoise: sampleNoise({ point, wavelength: 19, seed: 8.1 }),
                outward,
                roll: hashTree(seed + 2),
            });
            const size =
                (0.7 + hashTree(seed + 3) * 0.55) * (0.95 + outward * 0.35);
            const metres = kindScale[kind] * size;
            placer.position.set(
                point.x,
                (ground?.getHeightAt(point) ?? 0) - 0.25 * size,
                point.z,
            );
            placer.rotation.set(
                (hashTree(seed + 5) - 0.5) * leanRadians * 2,
                hashTree(seed + 6) * Math.PI * 2,
                (hashTree(seed + 7) - 0.5) * leanRadians * 2,
            );
            placer.scale.set(
                metres,
                metres * (0.85 + hashTree(seed + 4) * 0.35),
                metres,
            );
            placer.updateMatrix();

            //  Warmer greens toward the circle, where the fire lights
            //  them; cooler and darker ones deep in the wood.
            const warmth = hashTree(seed + 8) * 0.6 + (1 - outward) * 0.4;
            places.push({
                kind,
                matrix: placer.matrix.clone(),
                leaves: pickShade(isOak(kind) ? oakGreens : pineGreens, warmth),
                bark: pickShade(barkBrowns, hashTree(seed + 9)),
            });
        }
    }
    return places;
}
