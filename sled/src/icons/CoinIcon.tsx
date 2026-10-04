import { gold, ink, readIconLabelProps, type SledIconProps } from "./svg";

const rim = "#d18b17";
const emboss = "#c27a10";
const shine = "#ffe68a";

/** The six arms of the snowflake struck into the coin, as on `coin.glb`. */
const arms = [0, 60, 120, 180, 240, 300];

/** Sled's coin: a gold disc, its darker rim, and a snowflake emboss. */
export function CoinIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <circle
                cx="32"
                cy="32"
                r="28"
                fill={rim}
                stroke={ink}
                strokeWidth="4"
            />
            <circle cx="32" cy="32" r="21" fill={gold} />
            <path
                d="M15.5 27a17 17 0 0 1 12-11.5"
                fill="none"
                stroke={shine}
                strokeWidth="4"
                strokeLinecap="round"
            />
            <g
                fill="none"
                stroke={emboss}
                strokeWidth="3.5"
                strokeLinecap="round"
            >
                {arms.map((angle) => (
                    <path
                        key={angle}
                        transform={`rotate(${angle} 32 32)`}
                        d="M32 32V19.5M32 24.5l-4.5-4.5M32 24.5l4.5-4.5"
                    />
                ))}
            </g>
        </svg>
    );
}
