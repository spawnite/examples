import { create } from "zustand";
import { Hud, Text } from "@spawnite/engine";

//  The crosshair's answer to a shot that lands, gone in the fifth of a
//  second shooters use (the fades are in styles.css): four white ticks for
//  a hit; for a kill, longer red ticks and a ring that opens out; on a weak
//  spot, the ticks gold, longer and punched in, and a kill there keeps its
//  red ring round them. The page's own shots mark it, as it draws them, a
//  shot the room refuses takes its mark back, as the engine's weapon takes
//  back its hit, and the room's word on the weak spot settles whether the
//  mark stays gold.

export enum HitMark {
    Hit = "hit",
    Kill = "kill",
}

/** Milliseconds a mark stays in the page: the kill's fade, the longer of
 *  the two in styles.css. It leaves on this clock, so it goes even where
 *  its fade does not run. */
const markMilliseconds = 240;

/** One mark drawn: its number, so the same kind twice restarts the fade,
 *  its kind, whether the page saw it strike a weak spot, the room's numbers
 *  for the shots that drew it, and the room's word so far on each one's
 *  weak spot. */
interface ShownMark {
    id: number;
    mark: HitMark;
    predicted: boolean;
    shots: readonly number[];
    verdicts: Readonly<Record<number, boolean>>;
}

/** Whether a mark shows gold: while any of its shots the room has judged
 *  struck a weak spot, or, for one it has not judged yet, while the page
 *  saw one; the page's word alone off a room. */
function isCritical({ predicted, shots, verdicts }: ShownMark) {
    if (shots.length === 0) return predicted;
    return shots.some((shot) => verdicts[shot] ?? predicted);
}

const useHitMarks = create<{ shown: ShownMark | null }>(() => ({
    shown: null,
}));
let nextId = 0;

/** Marks a hit or a kill, drawn by the shots `sendShot` numbered, gold
 *  where it struck a weak spot. */
export function markHit(
    mark: HitMark,
    shots: readonly number[] = [],
    critical = false,
) {
    const shown: ShownMark = {
        id: nextId++,
        mark,
        predicted: critical,
        shots,
        verdicts: {},
    };
    useHitMarks.setState({ shown });
    setTimeout(
        () =>
            useHitMarks.setState((state) =>
                state.shown?.id === shown.id ? { shown: null } : state,
            ),
        markMilliseconds,
    );
}

/** Takes the room's word on whether `shot` struck a weak spot, where the
 *  mark it drew still shows: the same mark, its fade running on. */
export function settleHitMark(shot: number, critical: boolean) {
    useHitMarks.setState((state) =>
        state.shown?.shots.includes(shot)
            ? {
                  shown: {
                      ...state.shown,
                      verdicts: { ...state.shown.verdicts, [shot]: critical },
                  },
              }
            : state,
    );
}

/** Takes the mark off where the room refused a shot that drew it. */
export function takeBackHitMark(shot: number) {
    useHitMarks.setState((state) =>
        state.shown?.shots.includes(shot) ? { shown: null } : state,
    );
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

/** Every tick's shape, and each tick's look: a hit's white, a kill's red,
 *  a weak spot's gold. */
export const tickShape = "absolute top-0 left-0 block origin-left rounded-full";
export const tickLooks = {
    hit: "h-0.5 w-2.5 bg-white shadow-[0_0_3px_rgb(0_0_0/0.9)]",
    kill: "h-[3px] w-4 -translate-y-px bg-red-500 shadow-[0_0_6px_rgb(255_40_40/0.9)]",
    critical:
        "h-[3px] w-[18px] -translate-y-px bg-amber-300 shadow-[0_0_8px_rgb(255_190_40/0.95),0_0_2px_rgb(0_0_0/0.9)]",
};

/** What a mark reads as to a screen reader. */
function describeMark(kill: boolean, critical: boolean) {
    if (critical) return kill ? "Critical kill" : "Critical hit";
    return kill ? "Kill" : "Hit";
}

/** The mark itself, at the middle of the screen, until its fade is over. */
export function LatestHitMark() {
    const shown = useHitMarks((state) => state.shown);
    if (!shown) return null;
    const kill = shown.mark === HitMark.Kill;
    const critical = isCritical(shown);
    const look = critical ? "critical" : kill ? "kill" : "hit";
    const animation = critical
        ? "animate-crit-mark"
        : kill
          ? "animate-kill-mark"
          : "animate-hit-mark";
    return (
        <Text
            //  A new element per mark restarts its fade.
            key={shown.id}
            as="div"
            aria-label={describeMark(kill, critical)}
            className={`pointer-events-none fixed top-1/2 left-1/2 z-20 size-0 ${animation}`}
        >
            {kill && (
                <Text className="absolute -top-3.5 -left-3.5 block size-7 animate-kill-ring rounded-full border-2 border-red-500/90">
                    {null}
                </Text>
            )}
            {(kill || critical ? killTicks : hitTicks).map((tick) => (
                <Text
                    key={tick}
                    className={`${tickShape} ${tick} ${tickLooks[look]}`}
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
