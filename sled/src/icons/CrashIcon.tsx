import { ink, readIconLabelProps, type SledIconProps } from "./svg";

/** A star's outline around the icon's centre: `points` tips at `outer`,
 *  with the notches between them at `inner`. */
function star(points: number, outer: number, inner: number) {
    return Array.from({ length: points * 2 }, (_, index) => {
        const radius = index % 2 === 0 ? outer : inner;
        const angle = (Math.PI * index) / points;
        return `${(32 + radius * Math.sin(angle)).toFixed(2)},${(32 - radius * Math.cos(angle)).toFixed(2)}`;
    }).join(" ");
}

const burst = star(11, 30, 18);
const core = star(11, 17, 10);

/** A crash: a starburst, red round a yellow core. */
export function CrashIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <polygon
                points={burst}
                fill="#ff5a3c"
                stroke={ink}
                strokeWidth="3.5"
                strokeLinejoin="round"
            />
            <polygon points={core} fill="#ffd23f" />
        </svg>
    );
}
