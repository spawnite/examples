import {
    domAnimation,
    LazyMotion,
    m,
    type TargetAndTransition,
} from "motion/react";
import { springs } from "@spawnite/ui";
import { Numeral } from "../components/Numeral";
import { CoinIcon } from "../icons/CoinIcon";
import { PlusIcon } from "../icons/PlusIcon";
import { ink } from "../icons/svg";
import { speedSteps, speedTierSteps } from "../ride/speed";
import { BareButton } from "./BareButton";
import { useShake } from "./shake";

/** The dial's hub, and the radii its pips run between and its needle
 *  reaches, in the drawing's units. */
const hub = { x: 64, y: 63 };
const pipRadii = [40, 52];
const needleLength = 36;

/** The gap between two tiers, in pips. */
const tierGap = 0.8;
const tiers = speedSteps / speedTierSteps;
/** The arc's length in pips, the gaps between tiers counted. */
const arcLength = speedSteps + tierGap * (tiers - 1);

/** Each tier's colour, cool to hot. */
const tierColours = ["#8ccfff", "#5fd3a8", "#ffd23f", "#ff9f3c", "#ff5a3c"];
const emptyPip = "#d5dae5";

/** How far along the arc, 0 at the left to 1 at the right, `pips` pips
 *  from its start lie, the tier gaps they cross counted. */
function along(pips: number) {
    const gaps = Math.floor(Math.max(0, Math.ceil(pips) - 1) / speedTierSteps);
    return (pips + tierGap * gaps) / arcLength;
}

/** The point `radius` from the hub, `share` of the way over the top from
 *  the left. */
function point(share: number, radius: number) {
    const angle = Math.PI * share;
    return {
        x: hub.x - radius * Math.cos(angle),
        y: hub.y - radius * Math.sin(angle),
    };
}

const pips = Array.from({ length: speedSteps }, (_, index) => {
    const share = along(index + 0.5);
    const inner = point(share, pipRadii[0]);
    const outer = point(share, pipRadii[1]);
    return {
        d: `M${inner.x.toFixed(2)} ${inner.y.toFixed(2)}L${outer.x.toFixed(2)} ${outer.y.toFixed(2)}`,
        colour: tierColours[Math.floor(index / speedTierSteps)],
    };
});

/** The glow round the `+` while a step is affordable: a soft gold halo
 *  breathing in and out. */
const glow: TargetAndTransition = {
    boxShadow: [
        "0 0 0 0 rgb(255 201 60 / 0.9)",
        "0 0 0 14px rgb(255 201 60 / 0)",
    ],
    transition: { duration: 1.2, repeat: Infinity, ease: "easeOut" },
};

export interface SpeedDialProps {
    /** The Speed step bought, 0 to `speedSteps`. */
    step: number;
    /** Coins the next step costs; left out at the top step. */
    price?: number;
    /** The bank holds `price`. */
    affordable: boolean;
    onBuy: () => void;
}

/** The Speed upgrade as a speedometer: a half circle of 25 pips in five
 *  tiers, cool to hot, filled up to the step bought, a needle on the step
 *  and its number in the hub. Under it a round `+` with the next step's
 *  price, glowing while the bank holds it; a tap while it does not shakes
 *  it. At the top step the `+` is a gold tick. */
export function SpeedDial({ step, price, affordable, onBuy }: SpeedDialProps) {
    const { scope, shake } = useShake<HTMLSpanElement>();
    const needle = point(along(step), needleLength);
    const top = price === undefined;
    return (
        <LazyMotion features={domAnimation}>
            <m.div className="flex flex-col items-center gap-2">
                <m.div
                    role="meter"
                    aria-label="Speed"
                    aria-valuenow={step}
                    aria-valuemin={0}
                    aria-valuemax={speedSteps}
                    className="relative w-40 drop-shadow-[0_5px_0_rgb(20_33_61/0.5)]"
                >
                    <svg viewBox="0 0 128 82" className="block w-full">
                        <path
                            d="M4 63a60 60 0 0 1 120 0v11a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z"
                            fill="white"
                            stroke={ink}
                            strokeWidth="4"
                        />
                        <g strokeWidth="3.6" strokeLinecap="round">
                            {pips.map((pip, index) => (
                                <path
                                    key={pip.d}
                                    d={pip.d}
                                    stroke={
                                        index < step ? pip.colour : emptyPip
                                    }
                                />
                            ))}
                        </g>
                        <m.path
                            initial={false}
                            animate={{
                                d: `M${hub.x} ${hub.y}L${needle.x.toFixed(2)} ${needle.y.toFixed(2)}`,
                            }}
                            transition={springs.bouncy}
                            stroke={ink}
                            strokeWidth="5"
                            strokeLinecap="round"
                        />
                        <circle cx={hub.x} cy={hub.y} r="16" fill={ink} />
                    </svg>
                    <Numeral className="absolute top-[76.8%] left-1/2 -translate-1/2 text-xl">
                        {step}
                    </Numeral>
                </m.div>
                <m.div className="flex items-center gap-2">
                    {top ? (
                        <m.div
                            role="img"
                            aria-label="Speed full"
                            className="flex size-14 items-center justify-center rounded-full border-4 border-[#14213d] bg-[#ffc93c] shadow-[0_5px_0_#14213d]"
                        >
                            <svg viewBox="0 0 64 64" className="size-9">
                                <path
                                    d="M15 33l11 11 23-25"
                                    fill="none"
                                    stroke={ink}
                                    strokeWidth="9"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </m.div>
                    ) : (
                        <>
                            <m.span
                                ref={scope}
                                className="flex rounded-full"
                                animate={
                                    affordable ? glow : { boxShadow: "none" }
                                }
                            >
                                <BareButton
                                    label={`Buy Speed step ${step + 1}`}
                                    onPress={() => {
                                        if (affordable) onBuy();
                                        else shake();
                                    }}
                                    className={`size-14 rounded-full border-4 border-[#14213d] shadow-[0_5px_0_#14213d] ${affordable ? "bg-[#ffc93c]" : "bg-[#b9c2d3]"}`}
                                >
                                    <PlusIcon className="size-9" />
                                </BareButton>
                            </m.span>
                            <CoinIcon className="size-8" />
                            <Numeral
                                className={`text-3xl ${affordable ? "" : "text-[#e3e8f1]"}`}
                            >
                                {price}
                            </Numeral>
                        </>
                    )}
                </m.div>
            </m.div>
        </LazyMotion>
    );
}
