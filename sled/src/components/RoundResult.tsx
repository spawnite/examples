import type { ReactNode } from "react";
import { domAnimation, LazyMotion, m } from "motion/react";
import { Modal, ModalVariant } from "@spawnite/engine";
import { springs } from "@spawnite/ui";
import { CoinIcon } from "../icons/CoinIcon";
import { CrashIcon } from "../icons/CrashIcon";
import { FlagIcon } from "../icons/FlagIcon";
import { GaugeIcon } from "../icons/GaugeIcon";
import { HomeIcon } from "../icons/HomeIcon";
import type { RunStateName } from "../ride/course";
import { Numeral } from "./Numeral";
import { RoundButton } from "./RoundButton";

/** How a run ended, by its machine's state. */
export type RunEnding = Extract<RunStateName, "finished" | "wiped" | "crashed">;

/** Each ending's picture, and the name a screen reader gives the screen. */
const endings: Record<RunEnding, { title: string; icon: ReactNode }> = {
    finished: {
        title: "Finish",
        icon: <FlagIcon className="size-full" />,
    },
    wiped: {
        title: "Wiped out",
        icon: <CrashIcon className="size-full" />,
    },
    crashed: {
        title: "Out of steam",
        icon: <GaugeIcon reading={0} className="size-full" />,
    },
};

/** The seconds each part waits before it pops in, top to bottom. */
const entrances = { icon: 0, coins: 0.15, bank: 0.25, actions: 0.35 };

/** One turn of the finish's rays, slow and steady. */
const rays = { duration: 20, ease: "linear", repeat: Infinity } as const;

/** Pops a part in from nothing, after its wait. */
function PopIn({
    delay,
    className,
    children,
}: {
    delay: number;
    className?: string;
    children: ReactNode;
}) {
    return (
        <m.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...springs.bouncy, delay }}
            className={`flex items-center justify-center gap-2 ${className ?? ""}`}
        >
            {children}
        </m.div>
    );
}

export interface RoundResultProps {
    ending: RunEnding;
    /** The coins this run took. */
    coins: number;
    /** The bank after this run's coins went in. */
    bank: number;
    /** Goes back to the lobby. */
    onHome: () => void;
    onRetry: () => void;
    /** Plays the next track; offered only after a finish. */
    onNext?: () => void;
}

/** The run's end with no pane: a large picture of how it ended, the
 *  run's coins as "+24", the bank's total under them, and round buttons
 *  for a thumb: home to the lobby, retry, and the next track after a
 *  finish, in a bare Modal that frees the cursor and takes the
 *  keyboard's focus. The world runs on behind it, with no backdrop over
 *  it. The Modal's title names the screen for a screen reader. */
export function RoundResult({
    ending,
    coins,
    bank,
    onHome,
    onRetry,
    onNext,
}: RoundResultProps) {
    const { title, icon } = endings[ending];
    const next = ending === "finished" ? onNext : undefined;
    return (
        <Modal
            open
            title={title}
            variant={ModalVariant.Bare}
            //  The finish's rays spill past the pane, so neither the pane
            //  nor the dialog clips.
            className="select-none overflow-visible"
            dialogClassName="overflow-visible backdrop:bg-transparent"
        >
            <LazyMotion features={domAnimation}>
                <PopIn delay={entrances.icon} className="relative">
                    {/*  A finish turns slow gold rays behind the flag. */}
                    {ending === "finished" && (
                        <m.div
                            className="absolute -inset-24 bg-[repeating-conic-gradient(rgb(255_201_60/0.45)_0deg_10deg,transparent_10deg_20deg)] [mask-image:radial-gradient(closest-side,black_35%,transparent)]"
                            animate={{ rotate: 360 }}
                            transition={rays}
                        />
                    )}
                    <m.div
                        aria-hidden
                        initial={{ rotate: -25 }}
                        animate={{ rotate: 0 }}
                        transition={{
                            ...springs.bouncy,
                            delay: entrances.icon,
                        }}
                        className="relative size-36 p-4 drop-shadow-[0_6px_0_rgb(20_33_61/0.5)] sm:size-44"
                    >
                        {icon}
                    </m.div>
                </PopIn>
                <PopIn delay={entrances.coins}>
                    <CoinIcon className="size-14" />
                    <Numeral
                        as="output"
                        aria-label="Coins this run"
                        className="text-6xl text-[#ffc93c]"
                    >
                        {`+${coins}`}
                    </Numeral>
                </PopIn>
                <PopIn delay={entrances.bank}>
                    <CoinIcon className="size-9" />
                    <Numeral
                        as="output"
                        aria-label="Coins banked"
                        className="text-3xl"
                    >
                        {bank}
                    </Numeral>
                </PopIn>
                <PopIn delay={entrances.actions} className="mt-6 gap-6">
                    <RoundButton
                        icon={HomeIcon}
                        label="Lobby"
                        onPress={onHome}
                    />
                    <RoundButton
                        icon="rotate-ccw"
                        label="Retry"
                        onPress={onRetry}
                        lead={next === undefined}
                    />
                    {next && (
                        <RoundButton
                            icon="play"
                            label="Next track"
                            onPress={next}
                            lead
                        />
                    )}
                </PopIn>
            </LazyMotion>
        </Modal>
    );
}
