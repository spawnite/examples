import type { Vector3Like } from "three";
import type { HitZone } from "@spawnite/engine/core";
import { EliteModifier, MonsterKind } from "./traits";

//  Each monster's weak spot: a husk's, a spitter's, a skitter's and a
//  brute's head, and the colossus's glowing core. A hit there deals twice
//  the gun's damage, the number most shooters use, times the gun's zone
//  damage, which the rail's top tier and the Marksman card raise; the
//  element's dose rides on the hit's data, so a weak spot lays no more of
//  it. The room
//  runs no animation, so each spot is fixed in the monster's own frame,
//  its front along -z, and sized to hold the head or the core through the
//  clips a living monster plays: its walk, its strike and its flinch.

/** Times a gun's damage a hit on a weak spot deals, before the gun's own
 *  zone damage. */
export const weakSpotMultiplier = 2;

/** What a hit on a weak spot names as its zone. */
export enum WeakSpot {
    Head = "head",
    Core = "core",
}

/** How much larger an elite stands than its kind, its weak spot with it. */
export const eliteSize = 1.15;

/** Each kind's weak spot at its kind's size, in metres from its feet: a
 *  capsule along the line its head sways on as it walks and strikes, or a
 *  sphere. Measured from the vertices each model's head bone moves, posed
 *  through the clips it plays and scaled as it is drawn. */
const kindWeakSpots: Record<MonsterKind, HitZone> = {
    //  Its head is most of its upper body: a box 0.55 m across whose middle
    //  runs 1.34 m to 1.48 m up and 0.3 m ahead of its feet, and swings
    //  back over its feet and down to 1.21 m as it strikes.
    [MonsterKind.Husk]: {
        name: WeakSpot.Head,
        multiplier: weakSpotMultiplier,
        at: { x: 0, y: 1.41, z: -0.3 },
        to: { x: 0, y: 1.3, z: -0.05 },
        radius: 0.26,
    },
    //  The husk's model, drawn at 0.92 of its size.
    [MonsterKind.Spitter]: {
        name: WeakSpot.Head,
        multiplier: weakSpotMultiplier,
        at: { x: 0, y: 1.29, z: -0.28 },
        to: { x: 0, y: 1.19, z: -0.05 },
        radius: 0.24,
    },
    //  Its head, 0.5 m across and a third of a metre tall, rides level at
    //  the front of its body as it walks, and lunges on as it bites.
    [MonsterKind.Skitter]: {
        name: WeakSpot.Head,
        multiplier: weakSpotMultiplier,
        at: { x: 0, y: 0.31, z: -0.38 },
        to: { x: 0, y: 0.3, z: -0.2 },
        radius: 0.17,
    },
    //  Its head is half its height: a round skull whose middle stands 2 m
    //  up and a quarter metre ahead of its feet as it walks, and swings on
    //  and back as it strikes.
    [MonsterKind.Brute]: {
        name: WeakSpot.Head,
        multiplier: weakSpotMultiplier,
        at: { x: 0, y: 2.02, z: -0.35 },
        to: { x: 0, y: 1.95, z: -0.1 },
        radius: 0.42,
    },
    //  On its chest, under the head that hangs over it: the chest's front
    //  stands 0.38 m ahead of its feet from 1.3 m to 2.2 m up as it walks.
    [MonsterKind.Colossus]: {
        name: WeakSpot.Core,
        multiplier: weakSpotMultiplier,
        at: { x: 0, y: 1.85, z: -0.45 },
        radius: 0.42,
    },
};

/** A point `size` times as far from the feet. */
function scalePoint({ x, y, z }: Vector3Like, size: number): Vector3Like {
    return { x: x * size, y: y * size, z: z * size };
}

/** How much larger than its kind a monster is drawn: an elite's size
 *  times the size the room gave it. */
export function measureDrawnSize(elite: EliteModifier, size: number) {
    return (elite === EliteModifier.None ? 1 : eliteSize) * size;
}

/** The weak spot of a monster of `kind` drawn `size` times its kind's
 *  size. */
export function readWeakSpot(kind: MonsterKind, size = 1): HitZone {
    const { to, ...spot } = kindWeakSpots[kind];
    return {
        ...spot,
        at: scalePoint(spot.at, size),
        ...(to && { to: scalePoint(to, size) }),
        radius: spot.radius * size,
    };
}
