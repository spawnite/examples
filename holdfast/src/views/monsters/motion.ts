import type { Entity } from "koota";
import { FromWelcomeTrait } from "@spawnite/engine";
import type { Knock } from "../../weapons/looks";
import { createWalkCycle, type WalkCycle } from "../walkCycle";

//  What a monster's view keeps between frames: its walk, and when it last
//  rose, struck and was hit, which its body's parts animate from.

export interface MonsterMotion {
    stride: WalkCycle;
    /** Seconds of the page's clock at each; -Infinity before the first. */
    bornAt: number;
    struckAt: number;
    hitAt: number;
    /** Seconds its strike clip still has to catch up to the room's blow,
     *  taken a little each frame so the swing never jumps. */
    strikeLag: number;
    /** How far its last hit pushes it back, by the gun that dealt it. */
    knock: Knock;
    /** Whether Storm dealt its last hit: its body keeps its colour then,
     *  so the arc that reached it reads over it. */
    stormHit: boolean;
}

/** The motion of `monster`'s view as it mounts: risen already where the
 *  page's welcome found it, and climbing out of its rift where it spawned
 *  while the page watched. */
export function createMonsterMotion(monster: Entity): MonsterMotion {
    return {
        stride: createWalkCycle(),
        bornAt: monster.has(FromWelcomeTrait) ? -riseSeconds : -Infinity,
        struckAt: -Infinity,
        hitAt: -Infinity,
        strikeLag: 0,
        knock: { metres: 0, seconds: flashSeconds },
        stormHit: false,
    };
}

/** Seconds a monster takes to climb out of its rift. */
export const riseSeconds = 0.6;
/** Seconds the colossus takes: slow enough to watch it arrive. */
export const colossusRiseSeconds = 1.6;
/** Seconds a hit's flash takes to fade. */
export const flashSeconds = 0.12;

/** How far through `seconds` a span `elapsed` seconds old is, 0 to 1, and
 *  1 once it is over. */
export function measureProgress(elapsed: number, seconds: number) {
    return Math.min(1, Math.max(0, elapsed / seconds));
}

/** A kind's colours. */
export interface MonsterLook {
    /** Its eyes, its wind-up's throb and its bursts. */
    eyes: string;
    /** The rim round its outline. */
    rim: string;
    /** What its body's colour is multiplied by: a darker grade. */
    body: string;
}
