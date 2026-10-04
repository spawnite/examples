import { ink, readIconLabelProps, type SledIconProps } from "./svg";

const blue = "#4b56b0";
const shine = "#727cd0";
const light = "#c8ccef";
const pink = "#f2a7c0";

/** The rabbit's head: blue, long ears and buck teeth. */
export function RabbitIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            {[
                [21, -12],
                [43, 12],
            ].map(([x, tilt]) => (
                <g key={x} transform={`rotate(${tilt} ${x} 30)`}>
                    <ellipse
                        cx={x}
                        cy="17"
                        rx="7"
                        ry="14"
                        fill={blue}
                        stroke={ink}
                        strokeWidth="4"
                    />
                    <ellipse cx={x} cy="18" rx="3" ry="9" fill={pink} />
                </g>
            ))}
            <ellipse
                cx="32"
                cy="41"
                rx="25"
                ry="20"
                fill={blue}
                stroke={ink}
                strokeWidth="4"
            />
            <path
                d="M15 34a16 16 0 0 1 9-9"
                fill="none"
                stroke={shine}
                strokeWidth="4"
                strokeLinecap="round"
            />
            <circle cx="27.5" cy="49" r="6" fill={light} />
            <circle cx="36.5" cy="49" r="6" fill={light} />
            <circle cx="22.5" cy="39" r="4" fill={ink} />
            <circle cx="41.5" cy="39" r="4" fill={ink} />
            <circle cx="24" cy="37.5" r="1.5" fill="white" />
            <circle cx="43" cy="37.5" r="1.5" fill="white" />
            <ellipse
                cx="32"
                cy="45"
                rx="3.5"
                ry="2.5"
                fill={pink}
                stroke={ink}
                strokeWidth="2"
            />
            <rect
                x="29.5"
                y="53"
                width="5"
                height="5"
                rx="1"
                fill="white"
                stroke={ink}
                strokeWidth="2"
            />
        </svg>
    );
}
