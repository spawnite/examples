import { type RootState, useThree } from "@react-three/fiber";
import type { Entity } from "koota";
import { useTraitEffect, useWorld } from "koota/react";
import { useEffect, useRef } from "react";
import {
    HealthTrait,
    NetworkEntities,
    ShotResults,
    useRoom,
    useSettings,
    type ShotResult,
} from "@spawnite/engine";

//  Hit stop: when her own shot kills, this page holds its drawn world
//  still for a few hundredths of a second, as action games freeze a heavy
//  blow's frame so it lands with weight. Only the drawing stops: the room
//  runs on, and the next frame's delta carries the held time, so the page
//  steps and sends what the hold owed. The kill is the
//  room's word, from the streamed shots, not the page's guess. Off under
//  Reduced motion.

/** Milliseconds the drawn world holds still on her kill. */
export const hitStopMilliseconds = 50;

/** Her hero's key on the stream, and the streamed entities by key. */
export interface KillWitness {
    heroId: string | null;
    entities: Map<string, Entity> | undefined;
}

/** Whether any of `results` is her shot that killed: a target it hit has
 *  left the stream, or stands at no health. The room destroys a monster
 *  the step it dies, and a delta applies its removals before its shots. */
export function isOwnKill(
    results: ShotResult[],
    { heroId, entities }: KillWitness,
) {
    if (heroId === null) return false;
    for (const { shooter, hits } of results) {
        if (shooter !== heroId) continue;
        for (const { target } of hits) {
            const entity = entities?.get(target);
            if (!entity?.isAlive()) return true;
            if ((entity.get(HealthTrait)?.current ?? 1) <= 0) return true;
        }
    }
    return false;
}

/** The part of fiber's state a hold stops and starts. */
export type FrameLoop = Pick<RootState, "clock" | "frameloop" | "setFrameloop">;

/** Stops drawing and returns when, keeping the clock: fiber's switch
 *  zeroes it, and the page's effects count their ages on it, as the
 *  engine's frame loop keeps it across a pause. */
export function holdFrames(loop: FrameLoop) {
    const { elapsedTime } = loop.clock;
    loop.setFrameloop("never");
    loop.clock.elapsedTime = elapsedTime;
    return performance.now();
}

/** Draws again from `heldSince`: the clock keeps its time, and the next
 *  frame's delta carries the hold, so the steps and the moves the hold
 *  owed run on that frame. */
export function resumeFrames(loop: FrameLoop, heldSince: number) {
    const { elapsedTime } = loop.clock;
    loop.setFrameloop("always");
    loop.clock.elapsedTime = elapsedTime;
    loop.clock.oldTime = heldSince;
}

/** Whether the player asks for less motion: the Reduced motion row, or
 *  the device's own setting until they set it. */
function readReducedMotion(setting: boolean | null) {
    if (setting !== null) return setting;
    return (
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export function HitStop() {
    const world = useWorld();
    const readThree = useThree((state) => state.get);
    const reducedMotion = readReducedMotion(
        useSettings((state) => state.reducedMotion),
    );
    const heldSinceRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    //  Unmounted mid-hold, the page must not stay still; a loop it did not
    //  hold, as a test renderer's, is left as it is.
    useEffect(
        () => () => {
            if (timerRef.current === undefined) return;
            clearTimeout(timerRef.current);
            if (readThree().frameloop === "never")
                resumeFrames(readThree(), heldSinceRef.current);
        },
        [readThree],
    );

    useTraitEffect(world, ShotResults, (shots) => {
        if (reducedMotion || !shots) return;
        const witness: KillWitness = {
            heroId: useRoom.getState().heroId,
            entities: world.get(NetworkEntities),
        };
        if (!isOwnKill(shots.results, witness)) return;
        //  Only a running loop: a loop the devtools hold draws on demand,
        //  and the one already held is mid-stop.
        if (readThree().frameloop !== "always") return;
        heldSinceRef.current = holdFrames(readThree());
        timerRef.current = setTimeout(() => {
            timerRef.current = undefined;
            if (readThree().frameloop === "never")
                resumeFrames(readThree(), heldSinceRef.current);
        }, hitStopMilliseconds);
    });

    return null;
}
