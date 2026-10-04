import { Color, type Matrix4, Object3D } from "three";
import {
    clampUnit,
    type GroundHeight,
    type GroundPoint,
    hashLand as hashTree,
    isOnRoad,
    mapEdgeMetres,
    measureOutside,
    measureTrackOffset,
    readLandHeight,
    sampleNoise,
    smoothLand,
} from "../land";

//  Where each tree of the wood round the arena stands, and how it stands:
//  a pure function of the ground's height, so every page grows the same
//  wood. The wood is clumps and clearings rather than a row: a slow noise
//  over the ground decides where trees gather, and it lets fewer through
//  near the circle than far out, so the arena's edge is scattered trees and
//  the wood thickens behind them. Along the map's edge, where the engine's
//  walls stop a warden, a thicket of young firs and deadfall stands on the
//  wall's line, so what stops her is something she can see.

/** The kinds of thing in the wood, each one file of the nature kit. */
export enum WoodKind {
    PineTall = "pineTall",
    PineRound = "pineRound",
    PineSpire = "pineSpire",
    OakRound = "oakRound",
    OakFat = "oakFat",
    Boulder = "boulder",
    Stump = "stump",
}

/** One thing's place, lean and size, and the colours its leaves and its
 *  bark, wood or stone are tinted. */
export interface WoodPlace {
    kind: WoodKind;
    matrix: Matrix4;
    leaves: Color;
    bark: Color;
}

/** Metres from the middle the nearest tree may stand, and the half size of
 *  the square the wood fills: past the map's edge onto the land, so the
 *  wood runs on behind the wall's thicket. */
const woodMetres = { inner: 35, edge: 72 };
/** Metres past the map's edge beyond which the wood keeps under half its
 *  trees: only its crowns and the tracks' openings show over the thicket
 *  there, and each tree costs the frame as much as one in view. */
const thinPastMetres = 6;
/** Metres between the candidate places, one per cell of a grid. */
const cellMetres = 3.1;
/** Metres inside the wall kept clear of the wood's trees. */
const wallClearMetres = 4.5;
/** The most a trunk leans off upright, in radians: about four degrees. */
const leanRadians = 0.07;

type TreeKind =
    | WoodKind.PineTall
    | WoodKind.PineRound
    | WoodKind.PineSpire
    | WoodKind.OakRound
    | WoodKind.OakFat;

/** Each kind's scale at a size of one: the files stand one to two units
 *  tall, and a tree here from about three metres, a small fat oak, to
 *  about twenty-five, the tallest pine at the map's edge. */
const kindScale: Record<TreeKind, number> = {
    [WoodKind.PineTall]: 6.8,
    [WoodKind.PineRound]: 6.4,
    [WoodKind.PineSpire]: 7,
    [WoodKind.OakRound]: 5.6,
    [WoodKind.OakFat]: 5.4,
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
    new Color("#546c32"),
];
const barkBrowns = [new Color("#2e211c"), new Color("#4d3526")];
/** The young firs along the wall, fresher than the old wood behind, so
 *  the boundary reads by moonlight. */
const youngGreens = [new Color("#28483a"), new Color("#3c5c3a")];
/** Fallen wood, weathered paler than a standing trunk, and the stones. */
const deadwoodBrowns = [new Color("#6b5642"), new Color("#8a7058")];
const stoneGreys = [new Color("#4a4842"), new Color("#6a665c")];

/** Flat ground, for a placement before the map's ground exists. */
const flatGround: GroundHeight = { getHeightAt: () => 0 };

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

function pickKind({ kindNoise, outward, roll }: KindPick): TreeKind {
    if (kindNoise < 0.3 + (1 - outward) * 0.12) {
        return roll < 0.55 ? WoodKind.OakRound : WoodKind.OakFat;
    }
    if (roll < 0.15 + outward * 0.2) return WoodKind.PineTall;
    if (roll < 0.64) return WoodKind.PineRound;
    if (roll < 0.92) return WoodKind.PineSpire;
    return WoodKind.OakRound;
}

function isOak(kind: WoodKind) {
    return kind === WoodKind.OakRound || kind === WoodKind.OakFat;
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

/** How tall the trees of a stand grow, from about 0.7 to 1.3 of a tree's
 *  own size: a slow noise, so the wood's line against the sky rises over
 *  tall stands and dips over young ones rather than running level. */
function measureStand(point: GroundPoint) {
    const stand = smoothLand(
        sampleNoise({ point, wavelength: 17, seed: 12.9 }),
    );
    const broad = sampleNoise({ point, wavelength: 41, seed: 4.4 });
    return 0.62 + stand * 0.5 + broad * 0.2;
}

/** Every tree of the wood, standing on the ground. */
export function placeTrees(ground: GroundHeight | undefined): WoodPlace[] {
    const land = ground ?? flatGround;
    const placer = new Object3D();
    const places: WoodPlace[] = [];
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
            //  Nothing tall in the last metres before the wall, so a warden
            //  there sees the thicket that stops her rather than one trunk.
            const toWall =
                mapEdgeMetres - Math.max(Math.abs(point.x), Math.abs(point.z));
            if (toWall > 0 && toWall < wallClearMetres) continue;
            if (
                measureOutside(point) > thinPastMetres &&
                hashTree(seed + 10) < 0.55
            )
                continue;
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
            //  Shorter on the land past the map, so the far ranges and
            //  the sky's glow still show over the wood from the circle.
            const beyond = clampUnit(measureOutside(point) / 20);
            const size =
                (0.7 + hashTree(seed + 3) * 0.55) *
                (0.95 + outward * 0.35) *
                (1 - beyond * 0.3) *
                measureStand(point);
            const metres = kindScale[kind] * size;
            placer.position.set(
                point.x,
                readLandHeight(land, point) - 0.25 * size,
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

/** One side of the map's square, walked along its length: where a place
 *  `along` it and `out` metres past the wall's line stands, and the turn
 *  that lays a thing along the wall. */
interface WallSide {
    place(along: number, out: number): GroundPoint;
    /** The yaw that lays a model's length, its z, along the wall. */
    alongYaw: number;
    /** Where the side's road crosses the wall, along it. */
    crossing: number;
    seed: number;
}

/** The four sides, each with its road's crossing: the track's offset at
 *  the rim, the way its bend takes it. */
const wallSides: WallSide[] = [
    {
        place: (along, out) => ({ x: along, z: -(mapEdgeMetres + out) }),
        alongYaw: Math.PI / 2,
        crossing: measureTrackOffset(mapEdgeMetres, 1),
        seed: 1,
    },
    {
        place: (along, out) => ({ x: mapEdgeMetres + out, z: along }),
        alongYaw: 0,
        crossing: measureTrackOffset(mapEdgeMetres, -1),
        seed: 2,
    },
    {
        place: (along, out) => ({ x: along, z: mapEdgeMetres + out }),
        alongYaw: Math.PI / 2,
        crossing: measureTrackOffset(mapEdgeMetres, -1),
        seed: 3,
    },
    {
        place: (along, out) => ({ x: -(mapEdgeMetres + out), z: along }),
        alongYaw: 0,
        crossing: measureTrackOffset(mapEdgeMetres, 1),
        seed: 4,
    },
];

/** Metres either side of a road's crossing the thicket leaves open, so
 *  the track shows running on beyond the fallen tree across it. */
const crossingHalfMetres = 3.6;
/** Metres between the young firs along the wall, in each of two rows. */
const saplingMetres = 1.6;

//  Each file's own extents, in the file's units.

/** The stump's radius and height: laid on its side and stretched, it is a
 *  log. */
const stumpModel = { radius: 0.17, height: 0.2065 };
/** Half the boulder's height: its middle is its origin. */
const boulderModel = { halfHeight: 0.3 };
/** A fir file's height and its boughs' widest reach from its axis. */
const firModel = {
    [WoodKind.PineTall]: { height: 2.075, reach: 0.26 },
    [WoodKind.PineRound]: { height: 1.366, reach: 0.33 },
    [WoodKind.PineSpire]: { height: 1.253, reach: 0.26 },
} as const;

/** A fallen fir's needles, gone dull, and a root plate's earth. */
const deadNeedles = [new Color("#1f3a30"), new Color("#2e4a34")];
const rootEarth = new Color("#4a3a2c");

/** One young fir or one piece of deadfall on the wall's line, before it
 *  stands on the land. */
interface ThicketPiece {
    kind: WoodKind;
    point: GroundPoint;
    /** Metres above the ground its origin stands. */
    lift: number;
    /** Radians about up, then about the thing's own x, which tips a fir
     *  over onto the ground, and about its own z. */
    yaw: number;
    pitch?: number;
    roll?: number;
    scale: [number, number, number];
    leaves: Color;
    bark: Color;
}

/** A fir lying on the ground with its foot at `base` and its crown
 *  `length` metres off along `yaw`, resting on its boughs down the
 *  ground's slope. */
interface FallenFir {
    land: GroundHeight;
    kind: WoodKind.PineTall | WoodKind.PineSpire | WoodKind.PineRound;
    base: GroundPoint;
    yaw: number;
    length: number;
    /** 0 to 1 along the dead needles' range. */
    shade: number;
}

/** The tip from upright that lays a thing from `base` along `yaw` over
 *  the ground's slope `reach` metres on, so it neither floats over a dip
 *  nor stands in a rise. */
function measureLie(
    land: GroundHeight,
    base: GroundPoint,
    yaw: number,
    reach: number,
) {
    const along = {
        x: base.x + Math.sin(yaw) * reach,
        z: base.z + Math.cos(yaw) * reach,
    };
    const rise = readLandHeight(land, along) - readLandHeight(land, base);
    return Math.PI / 2 - Math.atan2(rise, reach);
}

function layFir({
    land,
    kind,
    base,
    yaw,
    length,
    shade,
}: FallenFir): ThicketPiece {
    const scale = length / firModel[kind].height;
    return {
        kind,
        point: base,
        //  Its axis a little under the boughs' reach, so they sink in.
        lift: firModel[kind].reach * scale * 0.75,
        yaw,
        //  Along the ground to the thick of its boughs.
        pitch: measureLie(land, base, yaw, length * 0.6),
        scale: [scale, scale, scale],
        leaves: pickShade(deadNeedles, shade),
        bark: pickShade(deadwoodBrowns, shade),
    };
}

/** A bare log lying on the ground from `base` along `yaw`. */
interface Log {
    land: GroundHeight;
    base: GroundPoint;
    yaw: number;
    length: number;
    radius: number;
    color: Color;
}

/** A log lies level on the lowest ground under it, its ends sunk into
 *  any bank, so it never bridges a dip with a gap under it. */
function layLog({ land, base, yaw, length, radius, color }: Log): ThicketPiece {
    const across = radius / stumpModel.radius;
    const baseHeight = readLandHeight(land, base);
    let lowest = baseHeight;
    for (let step = 1; step <= 6; step++) {
        const along = (length * step) / 6;
        lowest = Math.min(
            lowest,
            readLandHeight(land, {
                x: base.x + Math.sin(yaw) * along,
                z: base.z + Math.cos(yaw) * along,
            }),
        );
    }
    return {
        kind: WoodKind.Stump,
        point: base,
        lift: lowest - baseHeight + radius * 0.8,
        yaw,
        pitch: Math.PI / 2,
        scale: [across, length / stumpModel.height, across],
        leaves: color,
        bark: color,
    };
}

//  Turned about up first, then tipped along its own x. Written in place
//  for each piece.
const piecePlacer = new Object3D();
piecePlacer.rotation.order = "YXZ";

/** A piece's place, turn and size on the land. */
function placeThicketPiece(land: GroundHeight, piece: ThicketPiece): WoodPlace {
    const { kind, point, lift, yaw, pitch, roll, scale, leaves, bark } = piece;
    piecePlacer.position.set(
        point.x,
        readLandHeight(land, point) + lift,
        point.z,
    );
    piecePlacer.rotation.set(pitch ?? 0, yaw, roll ?? 0);
    piecePlacer.scale.set(...scale);
    piecePlacer.updateMatrix();
    return { kind, matrix: piecePlacer.matrix.clone(), leaves, bark };
}

/** The young firs and the deadfall along the map's edge: two rows of firs
 *  on the wall's line with their boughs to the ground, logs and boulders
 *  lying along it, and at each road a fallen tree across the way with its
 *  root plate, so the track shows running on past something no one walks
 *  through. */
export function placeThicket(ground: GroundHeight | undefined): WoodPlace[] {
    const land = ground ?? flatGround;
    const pieces: ThicketPiece[] = [];
    for (const side of wallSides) {
        const { place, alongYaw, crossing, seed } = side;
        const isOpen = (along: number) =>
            Math.abs(along - crossing) < crossingHalfMetres;
        //  A broken row of short young firs on the wall's line, and a full
        //  row of taller ones behind it, off the first's gaps.
        const count = Math.ceil((mapEdgeMetres * 2) / saplingMetres);
        for (const [rowIndex, row] of [
            { out: 0.45, height: [1.6, 3.2], gaps: 0.25 },
            { out: 1.9, height: [4.4, 6.8], gaps: 0 },
        ].entries()) {
            for (let index = 0; index <= count; index++) {
                const draw = seed * 1000 + rowIndex * 500 + index;
                const along =
                    -mapEdgeMetres +
                    (index + rowIndex * 0.5 + (hashTree(draw) - 0.5) * 0.4) *
                        saplingMetres;
                if (
                    isOpen(along) ||
                    Math.abs(along) > mapEdgeMetres + 1 ||
                    hashTree(draw + 7) < row.gaps
                )
                    continue;
                const kind =
                    hashTree(draw + 1) < 0.62
                        ? WoodKind.PineRound
                        : WoodKind.PineSpire;
                const [low, high] = row.height;
                const metres =
                    (low + hashTree(draw + 2) * (high - low)) /
                    firModel[kind].height;
                pieces.push({
                    kind,
                    point: place(along, row.out + hashTree(draw + 3) * 0.3),
                    lift: -0.1,
                    yaw: hashTree(draw + 4) * Math.PI * 2,
                    scale: [metres * 1.15, metres, metres * 1.15],
                    leaves: pickShade(youngGreens, hashTree(draw + 5)),
                    bark: pickShade(barkBrowns, hashTree(draw + 6)),
                });
            }
        }
        //  Deadfall along the wall, its inner side on the wall's line: a
        //  bare log or a windthrown fir, and a boulder or a stump between.
        for (let along = -mapEdgeMetres + 2; along < mapEdgeMetres;) {
            const draw = seed * 2000 + Math.round(along * 10);
            const length = 4 + hashTree(draw) * 3;
            const middle = along + length / 2;
            along += length + 0.6 + hashTree(draw + 1) * 2.2;
            if (isOpen(middle) || Math.abs(middle - crossing) < length / 2 + 2)
                continue;
            const yaw = alongYaw + (hashTree(draw + 3) - 0.5) * 0.35;
            if (hashTree(draw + 9) < 0.5) {
                pieces.push(
                    layLog({
                        land,
                        base: place(middle - length / 2, 0.5),
                        yaw,
                        length,
                        radius: 0.32 + hashTree(draw + 2) * 0.18,
                        color: pickShade(deadwoodBrowns, hashTree(draw + 4)),
                    }),
                );
            } else {
                pieces.push(
                    layFir({
                        land,
                        kind: WoodKind.PineSpire,
                        base: place(middle - length / 2, 0.9),
                        yaw,
                        length: length + 1,
                        shade: hashTree(draw + 4),
                    }),
                );
            }
            const between = along - 0.3;
            if (isOpen(between) || Math.abs(between) > mapEdgeMetres) continue;
            if (hashTree(draw + 5) < 0.55) {
                const size = 1.5 + hashTree(draw + 6) * 1.3;
                pieces.push({
                    kind: WoodKind.Boulder,
                    point: place(between, 0.35),
                    lift: boulderModel.halfHeight * size * 0.35,
                    yaw: hashTree(draw + 7) * Math.PI * 2,
                    scale: [size, size, size],
                    leaves: pickShade(stoneGreys, hashTree(draw + 8)),
                    bark: pickShade(stoneGreys, hashTree(draw + 8)),
                });
            } else if (hashTree(draw + 5) < 0.75) {
                const size = 3 + hashTree(draw + 6) * 2;
                pieces.push({
                    kind: WoodKind.Stump,
                    point: place(between, 0.4),
                    lift: -0.05,
                    yaw: hashTree(draw + 7) * Math.PI * 2,
                    scale: [size, size, size],
                    leaves: pickShade(barkBrowns, hashTree(draw + 8)),
                    bark: pickShade(barkBrowns, hashTree(draw + 8)),
                });
            }
        }
        //  A windthrown fir across the road, its crown over the way and its
        //  root plate torn up on edge beside it with a boulder, a bare log
        //  lying on the road in front of it, and a second fir fallen askew
        //  across the track behind.
        const rootAlong = crossing - 6.5;
        pieces.push(
            layFir({
                land,
                kind: WoodKind.PineTall,
                base: place(rootAlong, 1.4),
                yaw: alongYaw + 0.06,
                length: 13,
                shade: 0.2,
            }),
        );
        pieces.push(
            layLog({
                land,
                base: place(crossing - 3.5, 0.3),
                yaw: alongYaw - 0.08,
                length: 7,
                radius: 0.45,
                color: pickShade(deadwoodBrowns, 0.4),
            }),
        );
        pieces.push({
            kind: WoodKind.Stump,
            point: place(rootAlong - 0.2, 1.4),
            lift: 1.7,
            yaw: alongYaw + 0.08 + Math.PI,
            pitch: Math.PI / 2 - 0.15,
            scale: [11, 3, 11],
            leaves: rootEarth,
            bark: rootEarth,
        });
        pieces.push({
            kind: WoodKind.Boulder,
            point: place(rootAlong - 3.4, 0.6),
            lift: 0.35,
            yaw: seed * 1.7,
            scale: [3, 2.6, 3.2],
            leaves: stoneGreys[0],
            bark: stoneGreys[0],
        });
        pieces.push(
            layFir({
                land,
                kind: WoodKind.PineRound,
                base: place(crossing + 5, 7),
                yaw: alongYaw + Math.PI - 0.5,
                length: 10,
                shade: 0.5,
            }),
        );
    }
    return pieces.map((piece) => placeThicketPiece(land, piece));
}
