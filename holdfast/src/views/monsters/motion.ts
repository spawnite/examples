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
}

export function createMonsterMotion(): MonsterMotion {
    return {
        stride: createWalkCycle(),
        bornAt: -Infinity,
        struckAt: -Infinity,
        hitAt: -Infinity,
        strikeLag: 0,
    };
}

/** Seconds a monster takes to climb out of its rift. */
export const riseSeconds = 0.6;
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
