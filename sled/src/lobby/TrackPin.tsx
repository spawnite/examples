import { domAnimation, LazyMotion, m } from "motion/react";
import { springs } from "@spawnite/ui";
import { Numeral } from "../components/Numeral";
import { FlagIcon } from "../icons/FlagIcon";
import { LockIcon } from "../icons/LockIcon";
import { gold, ink } from "../icons/svg";
import { BareButton } from "./BareButton";
import { useShake } from "./shake";

/** Where the player stands with a track. */
export enum PinState {
    /** The track before it is not finished yet. */
    Locked = "locked",
    /** Unlocked and not finished: the one to play next. */
    Next = "next",
    Finished = "finished",
}

//  Written whole, because Tailwind emits only the classes it reads.
const fills: Record<PinState, string> = {
    [PinState.Locked]: "bg-[#b9c2d3]",
    [PinState.Next]: "bg-white",
    [PinState.Finished]: "bg-[#ffc93c]",
};

/** The next track's pin hops on the spot, over and over. */
const hop = {
    y: [0, -9, 0],
    transition: { duration: 0.7, repeat: Infinity, repeatDelay: 0.5 },
};

/** The coin ring's radius and its length round, in the ring's units. */
const ringRadius = 27;
const ringLength = 2 * Math.PI * ringRadius;

export interface TrackPinProps {
    /** The track's number, counted from 1. */
    number: number;
    state: PinState;
    /** The best run's coins and the track's; drawn once it is finished. */
    coins?: { best: number; total: number };
    selected?: boolean;
    /** The side the coin count stands on: the one with no neighbour
     *  close, as the trail zigzags. */
    countSide: "left" | "right";
    onSelect: () => void;
}

/** A track's pin on the map: its number in a round badge. Locked is grey
 *  with a lock, and a tap on it only shakes it; the next one hops; a finished one is
 *  gold with a small flag, and a ring round it fills by the best run's
 *  share of the track's coins, with the count beside it, such as 5/7. The
 *  selected pin stands larger, and bounces as it is picked. */
export function TrackPin({
    number,
    state,
    coins,
    selected = false,
    countSide,
    onSelect,
}: TrackPinProps) {
    const { scope, shake } = useShake<HTMLDivElement>();
    const finished = state === PinState.Finished && coins !== undefined;
    const label =
        state === PinState.Locked
            ? `Track ${number}, locked`
            : finished
              ? `Track ${number}, ${coins.best} of ${coins.total} coins`
              : `Track ${number}`;
    return (
        <LazyMotion features={domAnimation}>
            <m.div
                //  A new element on each pick, so each pick bounces it.
                key={String(selected)}
                className="relative flex"
                initial={selected ? { scale: 0.8 } : false}
                animate={{ scale: selected ? 1.25 : 1 }}
                transition={springs.bouncy}
            >
                <m.div
                    ref={scope}
                    className="flex"
                    animate={state === PinState.Next ? hop : { y: 0 }}
                >
                    <BareButton
                        label={label}
                        //  A locked pin is there to be seen, not picked.
                        onPress={state === PinState.Locked ? shake : onSelect}
                        className={`size-10 min-w-10 rounded-full border-[3px] border-[#14213d] shadow-[0_4px_0_#14213d] ${fills[state]} ${selected ? "ring-4 ring-white" : ""}`}
                    >
                        <Numeral
                            className={`text-xl ${state === PinState.Locked ? "text-[#e3e8f1]" : ""}`}
                        >
                            {number}
                        </Numeral>
                    </BareButton>
                </m.div>
                {state === PinState.Locked && (
                    <LockIcon className="pointer-events-none absolute -right-2 -bottom-1 size-5" />
                )}
                {finished && (
                    <>
                        <svg
                            viewBox="0 0 64 64"
                            aria-hidden
                            className="pointer-events-none absolute -inset-2 -rotate-90"
                        >
                            <circle
                                cx="32"
                                cy="32"
                                r={ringRadius}
                                fill="none"
                                stroke={ink}
                                strokeWidth="7"
                                strokeOpacity="0.55"
                            />
                            <circle
                                cx="32"
                                cy="32"
                                r={ringRadius}
                                fill="none"
                                stroke={gold}
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={`${(ringLength * coins.best) / Math.max(1, coins.total)} ${ringLength}`}
                            />
                        </svg>
                        {/*  The flag stands with the count, on the side
                             away from the trail, since the next clearing up
                             is too close for a flag above the badge. */}
                        <m.div
                            className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-end gap-0.5 ${countSide === "left" ? "right-full mr-2.5 flex-row-reverse" : "left-full ml-2.5"}`}
                        >
                            <FlagIcon className="size-6 shrink-0" />
                            <Numeral className="text-base whitespace-nowrap">
                                {`${coins.best}/${coins.total}`}
                            </Numeral>
                        </m.div>
                    </>
                )}
            </m.div>
        </LazyMotion>
    );
}
