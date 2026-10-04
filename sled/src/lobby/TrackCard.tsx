import { domAnimation, LazyMotion, m } from "motion/react";
import { springs } from "@spawnite/ui";
import { Numeral } from "../components/Numeral";
import { CoinIcon } from "../icons/CoinIcon";
import { FlagIcon } from "../icons/FlagIcon";
import { GaugeIcon } from "../icons/GaugeIcon";
import { ink } from "../icons/svg";
import { speedSteps } from "../ride/speed";

/** A point of a track seen from above: metres across and along, as the
 *  level's points give them. */
export interface ShapePoint {
    x: number;
    z: number;
}

/** The drawing's size, and the margin kept clear round the track, in its
 *  own units. */
const size = 100;
const margin = 12;

/** The track fitted into the drawing, its start at the top and its finish
 *  at the bottom, as the sled runs down the card: each point as fractions
 *  of the drawing. */
function fitShape(shape: ShapePoint[]) {
    const xs = shape.map((point) => point.x);
    const ys = shape.map((point) => -point.z);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    const scale = (size - 2 * margin) / Math.max(width, height, 1);
    //  Centred on the axis it is short on.
    const offset = {
        x: (size - width * scale) / 2,
        y: (size - height * scale) / 2,
    };
    return shape.map((point, index) => ({
        x: (offset.x + (xs[index] - left) * scale) / size,
        y: (offset.y + (ys[index] - top) * scale) / size,
    }));
}

export interface TrackCardProps {
    /** The track's number, counted from 1. */
    number: number;
    /** The track's centreline from above, start to finish. */
    shape: ShapePoint[];
    /** Coins on the track. */
    coins: number;
    /** The Speed step the track is tuned to finish at. */
    needed: number;
    /** The player's Speed step: below `needed`, the step reads red. */
    step: number;
}

/** A small card beside a selected track's pin: the track's real shape from
 *  above, a dot at its start and the flag at its finish, its coins, and
 *  the Speed step it needs, red while the player's is lower. */
export function TrackCard({
    number,
    shape,
    coins,
    needed,
    step,
}: TrackCardProps) {
    const fitted = fitShape(shape);
    const d = fitted
        .map(
            (point, index) =>
                `${index === 0 ? "M" : "L"}${(point.x * size).toFixed(1)} ${(point.y * size).toFixed(1)}`,
        )
        .join("");
    const start = fitted[0];
    const finish = fitted[fitted.length - 1];
    const short = step < needed;
    return (
        <LazyMotion features={domAnimation}>
            <m.div
                initial={{ scale: 0, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                transition={springs.bouncy}
                className="pointer-events-none flex w-26 flex-col items-center gap-1 rounded-2xl border-4 border-[#14213d] bg-white p-1.5 shadow-[0_5px_0_#14213d]"
            >
                <m.div className="relative aspect-square w-full rounded-xl bg-[#e3eefb]">
                    <svg
                        viewBox={`0 0 ${size} ${size}`}
                        role="img"
                        aria-label={`Track ${number} from above`}
                        className="block size-full"
                    >
                        <path
                            d={d}
                            fill="none"
                            stroke={ink}
                            strokeWidth="9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d={d}
                            fill="none"
                            stroke="white"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle
                            cx={start.x * size}
                            cy={start.y * size}
                            r="6"
                            fill="#5fd3a8"
                            stroke={ink}
                            strokeWidth="3"
                        />
                    </svg>
                    {/*  The flag's pole stands on the finish. */}
                    <m.div
                        className="absolute size-7 -translate-x-[22%] -translate-y-[92%]"
                        style={{
                            left: `${finish.x * 100}%`,
                            top: `${finish.y * 100}%`,
                        }}
                    >
                        <FlagIcon className="size-full" />
                    </m.div>
                </m.div>
                <m.div className="flex items-center gap-1">
                    <CoinIcon className="size-5" />
                    <Numeral
                        as="output"
                        aria-label="Coins on the track"
                        className="text-base"
                    >
                        {coins}
                    </Numeral>
                    <GaugeIcon
                        label="Speed the track needs"
                        reading={needed / speedSteps}
                        className="ml-0.5 size-5"
                    />
                    <Numeral
                        className={`text-base ${short ? "text-[#ff4a3d]" : ""}`}
                    >
                        {needed}
                    </Numeral>
                </m.div>
            </m.div>
        </LazyMotion>
    );
}
