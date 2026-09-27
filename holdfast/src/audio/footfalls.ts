import { type GroundSurface, heroMovementSettings } from "@spawnite/engine";
import { hearthMetres, ringMetres } from "../views/layout";

//  Where her footfalls land and what they land on, as numbers: the
//  Footsteps view plays them. The circle's middle is the world's origin.

/** What her foot strikes, as the ground's paint shows it. */
export enum FootSurface {
    Grass = "grass",
    Path = "path",
    Paving = "paving",
}

/** The ground's roads, as the map's paths paint them. */
export type FootGround = Pick<GroundSurface, "getPathSurfaceAt">;

/** A point on the ground. */
type GroundPoint = Parameters<GroundSurface["getPathSurfaceAt"]>[0];

/** Metres past the ring's stones that its verge shows packed earth: the
 *  paint's verge is half earth at 0.7 m and gone at 1.4 m. */
const vergeMetres = 1;
/** Metres past the hearth's flagstones that its rim shows packed earth:
 *  the paint's rim is half earth at 0.55 m. */
const rimMetres = 0.5;
/** A road's weight above which the paint shows it as earth. */
const roadWeight = 0.5;

/** The surface under `point`: the circle's stones by their layout, then
 *  packed earth on a road, the ring's verge or the hearth's rim, and grass
 *  elsewhere. */
export function readFootSurface(
    point: GroundPoint,
    ground: FootGround | undefined,
) {
    const radius = Math.hypot(point.x, point.z);
    const fromRing = Math.abs(radius - ringMetres.radius);
    if (fromRing <= ringMetres.halfWidth || radius <= hearthMetres)
        return FootSurface.Paving;
    if (
        fromRing <= ringMetres.halfWidth + vergeMetres ||
        radius <= hearthMetres + rimMetres
    )
        return FootSurface.Path;
    const road = ground?.getPathSurfaceAt(point);
    if (road?.surface === "dirt" && road.weight > roadWeight)
        return FootSurface.Path;
    return FootSurface.Grass;
}

//  Her run clip loops in two thirds of a second, two footfalls, so her
//  feet strike three times a second; at her base speed she covers a third
//  of it with each. The clip plays at one pace whatever her speed.
//  ponytail: a Speed card makes her steps come faster than her feet; the
//  stride from her own speed would lift it.
export const strideMetres = heroMovementSettings.speed / 3;

/** Metres a frame can carry her and still be a walk: past it she was put
 *  somewhere, by a respawn or a correction. */
const jumpMetres = 3;

/** Her walk between frames. */
export interface FootWalk {
    /** Where she stood last frame. */
    x: number;
    z: number;
    /** Metres covered since her last footfall. */
    walked: number;
    /** Whether `x` and `z` hold a place yet. */
    placed: boolean;
}

export function createFootWalk(): FootWalk {
    return { x: 0, z: 0, walked: 0, placed: false };
}

/** Moves `walk` on to where she stands this frame, and says whether a
 *  foot strikes the ground on it. */
export function advanceFootWalk(walk: FootWalk, point: GroundPoint) {
    const travelled = Math.hypot(point.x - walk.x, point.z - walk.z);
    const placed = walk.placed;
    walk.x = point.x;
    walk.z = point.z;
    walk.placed = true;
    if (!placed || travelled > jumpMetres) return false;
    walk.walked += travelled;
    if (walk.walked < strideMetres) return false;
    walk.walked %= strideMetres;
    return true;
}
