import { useId } from "react";
import { ink, readIconLabelProps, type SledIconProps } from "./svg";

/** The cloth, waving: the checks are clipped to it and its edge drawn
 *  over them. */
const cloth = "M17 9c7-4 14 3 21 0s13-3 20 0v26c-7-3-13-3-20 0s-14-4-21 0z";
const cell = 7;
//  The squares that are dark, over the cloth's box from (17, 5).
const checks = Array.from({ length: 6 * 6 }, (_, index) => ({
    x: 17 + (index % 6) * cell,
    y: 5 + Math.floor(index / 6) * cell,
    dark: (index % 6) % 2 === Math.floor(index / 6) % 2,
})).filter((square) => square.dark);

/** The finish: a chequered flag on its pole. */
export function FlagIcon({ label, className }: SledIconProps) {
    //  One clip per drawn flag, since two on a page may not share an id.
    const clipId = useId();
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <clipPath id={clipId}>
                <path d={cloth} />
            </clipPath>
            <rect
                x="9"
                y="5"
                width="7"
                height="56"
                rx="3.5"
                fill="#e9edf5"
                stroke={ink}
                strokeWidth="3"
            />
            <path d={cloth} fill="white" />
            <g clipPath={`url(#${clipId})`} fill={ink}>
                {checks.map((square) => (
                    <rect
                        key={`${square.x},${square.y}`}
                        x={square.x}
                        y={square.y}
                        width={cell}
                        height={cell}
                    />
                ))}
            </g>
            <path
                d={cloth}
                fill="none"
                stroke={ink}
                strokeWidth="3.5"
                strokeLinejoin="round"
            />
        </svg>
    );
}
