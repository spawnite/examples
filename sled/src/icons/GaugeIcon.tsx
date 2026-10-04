import { ink, readIconLabelProps, type SledIconProps } from "./svg";

//  The dial sweeps 270 degrees, from bottom left to bottom right, measured
//  clockwise from straight up.
const sweepStart = -135;
const sweep = 270;
/** Where the red stall zone at the bottom of the dial ends, as a reading. */
const stallEnd = 0.2;

function point(degrees: number, radius: number) {
    const radians = (degrees * Math.PI) / 180;
    return `${(32 + radius * Math.sin(radians)).toFixed(2)} ${(35 - radius * Math.cos(radians)).toFixed(2)}`;
}

/** An arc of the dial between two readings. */
function band(from: number, to: number, radius: number) {
    const start = sweepStart + sweep * from;
    const end = sweepStart + sweep * to;
    const large = end - start > 180 ? 1 : 0;
    return `M${point(start, radius)}A${radius} ${radius} 0 ${large} 1 ${point(end, radius)}`;
}

const stallBand = band(0, stallEnd, 19);
const rideBand = band(stallEnd + 0.04, 1, 19);

interface GaugeIconProps extends SledIconProps {
    /** Where the needle points, from 0, the stall, to 1, flat out.
     *  @defaultValue `0.65` */
    reading?: number;
}

/** A speed gauge: a dial with a red stall zone at its low end and a
 *  needle at the reading. */
export function GaugeIcon({
    reading = 0.65,
    label,
    className,
}: GaugeIconProps) {
    const needle = sweepStart + sweep * Math.min(1, Math.max(0, reading));
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <circle
                cx="32"
                cy="35"
                r="27"
                fill="white"
                stroke={ink}
                strokeWidth="4"
            />
            <g fill="none" strokeWidth="6.5">
                <path d={stallBand} stroke="#ff4a3d" />
                <path d={rideBand} stroke="#8ccfff" />
            </g>
            <path
                d={`M32 35L${point(needle, 19)}`}
                stroke={ink}
                strokeWidth="5"
                strokeLinecap="round"
            />
            <circle cx="32" cy="35" r="5" fill={ink} />
        </svg>
    );
}
