import { create } from "zustand";
import { Hud, Text } from "@spawnite/engine";

//  The crosshair's answer to a shot that lands, gone in the fifth of a
//  second shooters use (the fades are in styles.css): four white ticks for
//  a hit; for a kill, longer red ticks and a ring that opens out. The
//  page's own shots mark it, as it draws them.

export enum HitMark {
    Hit = "hit",
    Kill = "kill",
}

interface HitMarkState {
    /** Counts up at each mark, so the same kind twice restarts the fade. */
    count: number;
    mark: HitMark;
}

const useHitMarks = create<HitMarkState>(() => ({
    count: 0,
    mark: HitMark.Hit,
}));

export function markHit(mark: HitMark) {
    useHitMarks.setState(({ count }) => ({ count: count + 1, mark }));
}

/** Each tick, turned about the crosshair and pushed out from it: written
 *  whole, because Tailwind emits only the classes it reads. */
const hitTicks = [
    "[transform:rotate(45deg)_translateX(7px)]",
    "[transform:rotate(135deg)_translateX(7px)]",
    "[transform:rotate(225deg)_translateX(7px)]",
    "[transform:rotate(315deg)_translateX(7px)]",
];
const killTicks = [
    "[transform:rotate(45deg)_translateX(8px)]",
    "[transform:rotate(135deg)_translateX(8px)]",
    "[transform:rotate(225deg)_translateX(8px)]",
    "[transform:rotate(315deg)_translateX(8px)]",
];

/** The mark itself, at the middle of the screen. Its fade holds its last
 *  frame, so a mark stays in the page, unseen, until the next replaces it. */
export function LatestHitMark() {
    const { count, mark } = useHitMarks();
    if (count === 0) return null;
    const kill = mark === HitMark.Kill;
    return (
        <Text
            //  A new element per mark restarts its fade.
            key={count}
            as="div"
            aria-label={kill ? "Kill" : "Hit"}
            className={`pointer-events-none fixed top-1/2 left-1/2 z-20 size-0 ${kill ? "animate-kill-mark" : "animate-hit-mark"}`}
        >
            {kill && (
                <Text className="absolute -top-3.5 -left-3.5 block size-7 animate-kill-ring rounded-full border-2 border-red-500/90">
                    {null}
                </Text>
            )}
            {(kill ? killTicks : hitTicks).map((tick) => (
                <Text
                    key={tick}
                    className={`absolute top-0 left-0 block origin-left rounded-full ${tick} ${kill ? "h-[3px] w-4 -translate-y-px bg-red-500 shadow-[0_0_6px_rgb(255_40_40/0.9)]" : "h-0.5 w-2.5 bg-white shadow-[0_0_3px_rgb(0_0_0/0.9)]"}`}
                >
                    {null}
                </Text>
            ))}
        </Text>
    );
}

export function HitMarker() {
    return (
        <Hud>
            <LatestHitMark />
        </Hud>
    );
}
