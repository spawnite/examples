import { domAnimation, LazyMotion, m } from "motion/react";
import { Panel, PanelVariant, Slot } from "@spawnite/engine";
import { GaugeIcon } from "../icons/GaugeIcon";
import { Numeral } from "./Numeral";

/** The shake while stalling: a quick side to side, looped. */
const shake = {
    x: [0, -4, 4, -3, 3, 0],
    transition: { duration: 0.4, repeat: Infinity },
};

/** Where the gauge's needle rests: in its red zone while stalling. */
const readings = { riding: 0.65, stalling: 0.08 };

/** The speed's size and its cell. */
const digits = "[grid-area:1/1] text-2xl sm:text-3xl";

/** The rider's speed under the coins, a small number beside a gauge with
 *  no unit word.
 *  Below the stall speed it turns red and shakes, and the needle drops
 *  into the red, so the danger reads without the number. */
export function SpeedReadout({
    speed,
    stalling,
}: {
    /** Kilometres an hour, whole. */
    speed: number;
    stalling: boolean;
}) {
    return (
        <Panel slot={Slot.TopRight} order={2} variant={PanelVariant.Bare}>
            <LazyMotion features={domAnimation}>
                <m.span
                    className="flex items-center gap-1"
                    animate={stalling ? shake : { x: 0 }}
                >
                    <GaugeIcon
                        label={stalling ? "Stalling" : "Speed"}
                        reading={stalling ? readings.stalling : readings.riding}
                        className="size-7 sm:size-8"
                    />
                    {/*  An unseen "888" in the same cell holds three
                         digits' width in the font as drawn, so the gauge
                         stays put as the speed passes 9 and 99. The size
                         is the Numeral's own, which outranks one
                         inherited. */}
                    <m.span className="grid">
                        <Numeral className={`invisible ${digits}`}>888</Numeral>
                        <Numeral
                            className={`${digits} ${stalling ? "text-[#ff4a3d]" : ""}`}
                        >
                            {speed}
                        </Numeral>
                    </m.span>
                </m.span>
            </LazyMotion>
        </Panel>
    );
}
