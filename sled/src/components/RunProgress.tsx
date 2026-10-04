import type { ComponentType, CSSProperties } from "react";
import { domAnimation, LazyMotion, m } from "motion/react";
import {
    Bar,
    gameInsetLengths,
    Panel,
    PanelVariant,
    Slot,
} from "@spawnite/engine";
import { springs } from "@spawnite/ui";
import { BearIcon } from "../icons/BearIcon";
import { CatIcon } from "../icons/CatIcon";
import { FlagIcon } from "../icons/FlagIcon";
import { FoxIcon } from "../icons/FoxIcon";
import { RabbitIcon } from "../icons/RabbitIcon";
import { RiderIcon } from "../icons/RiderIcon";
import type { SledIconProps } from "../icons/svg";
import { RiderId } from "../ride/riders";
import { Numeral } from "./Numeral";

/** The safe-area insets at the screen's sides, which the strip's width
 *  leaves out. */
const sideInsets = `calc(${gameInsetLengths.left} + ${gameInsetLengths.right})`;

/** Before the engine's corner buttons in the same corner, the menu button
 *  on a phone among them, so the strip stays level with the coins and the
 *  buttons stand under its start. */
const stripOrder = -2;

/** Each animal's head, which slides along the strip. */
const heads: Record<RiderId, ComponentType<SledIconProps>> = {
    [RiderId.Penguin]: RiderIcon,
    [RiderId.Bear]: BearIcon,
    [RiderId.Fox]: FoxIcon,
    [RiderId.Cat]: CatIcon,
    [RiderId.Rabbit]: RabbitIcon,
};

/** The run from the sling to the finish flag, across the top from the left
 *  edge: the track's numeral at the start, a strip that fills white as the
 *  run goes, and the head of the animal riding sliding along it on the
 *  fill's spring. */
export function RunProgress({
    track,
    progress,
    rider,
}: {
    /** The track being run, counted from 1. */
    track: number;
    /** The animal riding, whose head the strip draws. */
    rider: RiderId;
    /** The distance run over the finish's, 0 at the sling and 1 at the
     *  flag. */
    progress: number;
}) {
    const done = Math.min(1, Math.max(0, progress));
    const Head = heads[rider];
    return (
        <Panel
            slot={Slot.TopLeft}
            order={stripOrder}
            variant={PanelVariant.Bare}
            //  From the left edge up to the coins at the top right: the
            //  screen less its 1rem paddings, the coins and a 1rem gap, which
            //  grow on a wider screen; at most 32rem on a desktop.
            className="relative h-12 w-[min(32rem,calc(100vw-9.5rem-var(--side-insets)))] flex-row gap-3 pr-5 sm:w-[min(32rem,calc(100vw-11rem-var(--side-insets)))]"
            style={{ "--side-insets": sideInsets } as CSSProperties}
        >
            <Numeral className="w-10 shrink-0 text-center text-3xl sm:text-4xl">
                {track}
            </Numeral>
            <Bar
                label={`Track ${track}`}
                value={done}
                maximum={1}
                className="h-4 w-auto flex-1 border-[3px] border-[#14213d] bg-[#14213d]/45 shadow-[0_3px_0_#14213d]"
                classNames={{ fill: "bg-white" }}
            />
            <FlagIcon
                label="Finish"
                className="absolute right-0 bottom-[calc(50%-0.5rem)] size-10"
            />
            {/*  A box over the strip, slid by the share run: its own width
                 is what a percentage translation measures. The strip starts
                 3.25rem in, past the numeral's two digits and the gap, and ends 1.25rem
                 short, at the padding, so it is the panel less 4.5rem. The
                 box keeps half a head inside each end, so at 0 the head
                 stands on the strip's start rather than over the numeral;
                 on a strip shorter than four heads, as on a 320 px phone,
                 a quarter of the strip instead, so the head still travels
                 half of it. */}
            <LazyMotion features={domAnimation}>
                <m.div
                    className="pointer-events-none absolute inset-y-0 right-[calc(1.25rem_+_min(1.25rem,(100%_-_4.5rem)/4))] left-[calc(3.25rem_+_min(1.25rem,(100%_-_4.5rem)/4))]"
                    initial={false}
                    animate={{ x: `${done * 100}%` }}
                    transition={springs.meter}
                >
                    <Head
                        label="You"
                        className="absolute top-1/2 left-0 size-10 -translate-1/2"
                    />
                </m.div>
            </LazyMotion>
        </Panel>
    );
}
