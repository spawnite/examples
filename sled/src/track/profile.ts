import { MathUtils } from "three";

//  The numbers of the cross-section the surface lays at every ring: the
//  lane the level authors, a snow shoulder each side of it, a fence rising
//  at the outer edge, and the hillside apron beyond. The engine's track is as wide as the lane and its
//  two shoulders, so the ride stops at the fence.

/** Metres of snow shoulder beyond the lane on each side. */
export const shoulderWidth = 3;
/** Metres the fence rises at the outer edge.
 *  ponytail: a fence only; the levels past the first author a `wall` up to
 *  a 2.5 m U-wall, lerped between points as the ice is. */
const fenceHeight = 1.5;
/** Metres of loose snow at the shoulder's outer edge. */
export const shoulderSnow = 0.35;
/** Metres of loose snow on a snow lane; an ice lane is swept bare. It
 *  raises the mesh and, once the sled rides, costs it speed. */
export const laneSnow = 0.035;
/** 1/s the sled loses per metre of snow under it: about 0.04 on a snow
 *  lane and 0.4 at a shoulder's outer edge, so drifting off the fast line
 *  costs speed as it happens, with no edge to pop at. */
export const snowDragPerMetre = 1.14;
/** Metres of run across the fence's slant. */
export const wallLip = 1.5;
/** Metres of hillside beyond the fence, where the scenery stands. */
export const apronWidth = 60;
/** Metres of surface one repeat of the ground tile covers: the uvs are
 *  world metres, so a tile stays square whatever the lane's width. */
export const tileMetres = 6;

/** A lane: its half-width, and how icy it is from 0 to 1, blended between
 *  the level's points so the depth and the paint never step. */
export interface Lane {
    halfWidth: number;
    ice: number;
}

/** Where the shoulder ends and the fence top stands, unsigned, for a lane
 *  of this half-width. */
export function edges(halfWidth: number) {
    const shoulder = halfWidth + shoulderWidth;
    return { shoulder, wall: shoulder + wallLip };
}

/** The fence top, and the apron that runs out level from it, above the
 *  ride surface: on top of the shoulder's snow, so the snow never buries
 *  the fence. */
export const apronHeight = fenceHeight + shoulderSnow;

/** Metres of loose snow at a lateral offset: flat across the lane, then
 *  deepening out to the shoulder's edge. */
export function snowDepthAt(lateral: number, lane: Lane) {
    const depth = MathUtils.lerp(laneSnow, 0, lane.ice);
    const off = Math.abs(lateral) - lane.halfWidth;
    if (off <= 0) return depth;
    return MathUtils.lerp(
        depth,
        shoulderSnow,
        Math.min(1, off / shoulderWidth),
    );
}
