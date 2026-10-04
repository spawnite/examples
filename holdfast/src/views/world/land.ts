import type { GroundSurface } from "@spawnite/engine";
import { roadHalfWidthMetres } from "../layout";

//  The land past the map's square: the ground's edge carried on outward
//  and up into wooded hills, so no view from the circle finds the place
//  where the map stops, and each road running on past the rim as a track
//  that bends away among the trees. Pure functions of the ground's height,
//  shared by the land's mesh, the ground's paint and the wood.

/** A place on the ground, by its two flat coordinates. */
export interface GroundPoint {
    x: number;
    z: number;
}

/** What the land reads from the map's ground. */
export type GroundHeight = Pick<GroundSurface, "getHeightAt">;

/** Metres from the middle to each side of the map's square, where the
 *  engine's walls stand and the land begins. */
export const mapEdgeMetres = 50;
/** Metres from the middle the land reaches: well past the wood's 72 m,
 *  whose trees and the wall's thicket stand between its far end and
 *  anywhere a warden can stand, and inside the skyline's 120. */
export const landMetres = 100;
/** The land's climb past the rim: `metres` up over its first `over`
 *  metres out, before its own hills. */
const landRise = { metres: 4, over: 40 };
/** The land's own hills past the rim: how high, and how far apart. */
const landHills = { metres: 4, wavelength: 26 };

/** Metres from the middle where each road leaves the map's paths and runs
 *  on as a track. */
const trackStartMetres = 42;
/** How fast a track bends off its road's line: metres sideways per square
 *  metre along, so it is 0.8 m off at the rim and 19 m off 40 m past the
 *  start, well out of sight behind the trees. */
const trackCurve = 0.012;
/** Metres either side of a track's middle kept clear of trunks. */
const trackClearMetres = roadHalfWidthMetres + 3.4;

/** One road's track: the axis it leaves along, which way, and which way
 *  it bends. */
interface Track {
    /** Whether it runs along x, rather than along z. */
    alongX: boolean;
    /** 1 toward positive, -1 toward negative. */
    outward: 1 | -1;
    bend: 1 | -1;
}

/** North, east, south and west, each bending its own way. */
const tracks: Track[] = [
    { alongX: false, outward: -1, bend: 1 },
    { alongX: true, outward: 1, bend: -1 },
    { alongX: false, outward: 1, bend: -1 },
    { alongX: true, outward: -1, bend: 1 },
];

/** A fixed pseudo-random value from 0 to 1 for a number. */
export function hashLand(value: number) {
    const sine = Math.sin(value * 127.1) * 43758.5453;
    return sine - Math.floor(sine);
}

export function smoothLand(value: number) {
    return value * value * (3 - 2 * value);
}

export function clampUnit(value: number) {
    return Math.min(Math.max(value, 0), 1);
}

function smoothstep(from: number, to: number, value: number) {
    return smoothLand(clampUnit((value - from) / (to - from)));
}

/** A smooth value from 0 to 1 over the ground, one bump every
 *  `wavelength` metres or so. */
export interface NoiseSample {
    point: GroundPoint;
    wavelength: number;
    seed: number;
}

export function sampleNoise({ point, wavelength, seed }: NoiseSample) {
    const across = point.x / wavelength;
    const along = point.z / wavelength;
    const column = Math.floor(across);
    const row = Math.floor(along);
    const acrossBlend = smoothLand(across - column);
    const alongBlend = smoothLand(along - row);
    const corner = (columnStep: number, rowStep: number) =>
        hashLand((column + columnStep) * 57.3 + (row + rowStep) * 131.7 + seed);
    const near = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * acrossBlend;
    const far = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * acrossBlend;
    return near + (far - near) * alongBlend;
}

/** Metres a track's middle stands off its road's line, `along` metres
 *  from the circle's middle. */
export function measureTrackOffset(along: number, bend: number) {
    const past = Math.max(along - trackStartMetres, 0);
    return bend * trackCurve * past * past;
}

/** Metres from `point` to the nearest track's middle, past the start of
 *  the tracks, or Infinity where no track runs. */
export function measureTrackDistance({ x, z }: GroundPoint) {
    let nearest = Infinity;
    for (const { alongX, outward, bend } of tracks) {
        const along = (alongX ? x : z) * outward;
        if (along < trackStartMetres) continue;
        const across = alongX ? z : x;
        nearest = Math.min(
            nearest,
            Math.abs(across - measureTrackOffset(along, bend)),
        );
    }
    return nearest;
}

/** Whether `point` lies on a road or its track, with its verges: inside
 *  the track's start, the straight opening on each axis the map's roads
 *  run in; past it, the bending track. */
export function isOnRoad(point: GroundPoint) {
    const { x, z } = point;
    const alongZ = Math.abs(z) > Math.abs(x);
    const along = Math.abs(alongZ ? z : x);
    if (along < trackStartMetres)
        return Math.abs(alongZ ? x : z) < trackClearMetres;
    return measureTrackDistance(point) < trackClearMetres;
}

/** Metres from `point` out to the map's square, 0 inside it. */
export function measureOutside({ x, z }: GroundPoint) {
    const outX = Math.max(Math.abs(x) - mapEdgeMetres, 0);
    const outZ = Math.max(Math.abs(z) - mapEdgeMetres, 0);
    return Math.hypot(outX, outZ);
}

/** The ground's height at `point`: the map's inside its square, and past
 *  it the map's edge carried on and climbing into hills, lower along a
 *  track, so each track runs out through a valley. */
export function readLandHeight(ground: GroundHeight, point: GroundPoint) {
    const outside = measureOutside(point);
    const edge = ground.getHeightAt({
        x: Math.min(Math.max(point.x, -mapEdgeMetres), mapEdgeMetres),
        z: Math.min(Math.max(point.z, -mapEdgeMetres), mapEdgeMetres),
    });
    if (outside === 0) return edge;
    const climb = smoothstep(0, landRise.over, outside);
    const hills =
        landHills.metres *
        sampleNoise({ point, wavelength: landHills.wavelength, seed: 21.3 }) *
        smoothstep(0, 20, outside);
    const valley = 0.3 + 0.7 * smoothstep(4, 16, measureTrackDistance(point));
    return edge + (landRise.metres * climb + hills) * valley;
}

/** GLSL: the tracks' weight at a place on the map's ground, 1 on a
 *  track's middle and 0 past its verge, faded in where the map's road
 *  ends. Written from the same table, for the ground's paint. */
export const trackGround = /* glsl */ `
float trackWeightGround(float along, float across, float bend) {
    float past = max(along - ${trackStartMetres.toFixed(1)}, 0.0);
    float offset = bend * ${trackCurve} * past * past;
    float inside = 1.0 - smoothstep(${roadHalfWidthMetres.toFixed(2)}, ${(roadHalfWidthMetres + 1.5).toFixed(2)}, abs(across - offset));
    return inside * smoothstep(${(trackStartMetres - 3).toFixed(1)}, ${trackStartMetres.toFixed(1)}, along);
}

float trackGround(vec2 at) {
    // Nothing inside the tracks' start, where every grass blade roots.
    if (max(abs(at.x), abs(at.y)) < ${(trackStartMetres - 3).toFixed(1)}) return 0.0;
    float weight = 0.0;
${tracks
    .map(({ alongX, outward, bend }) => {
        const along = `${outward < 0 ? "-" : ""}at.${alongX ? "x" : "y"}`;
        const across = `at.${alongX ? "y" : "x"}`;
        return `    weight = max(weight, trackWeightGround(${along}, ${across}, ${bend.toFixed(1)}));`;
    })
    .join("\n")}
    return weight;
}
`;
