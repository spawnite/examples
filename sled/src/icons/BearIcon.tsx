import { ink, readIconLabelProps, type SledIconProps } from "./svg";

const brown = "#7b4a2c";
const shine = "#a5704a";
const cream = "#ecd2a6";
const innerEar = "#c48a5c";

/** The bear's head: brown, round ears and a cream muzzle. */
export function BearIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            {[13, 51].map((x) => (
                <g key={x}>
                    <circle
                        cx={x}
                        cy="15"
                        r="9"
                        fill={brown}
                        stroke={ink}
                        strokeWidth="4"
                    />
                    <circle cx={x} cy="15" r="4.5" fill={innerEar} />
                </g>
            ))}
            <ellipse
                cx="32"
                cy="36"
                rx="26"
                ry="23"
                fill={brown}
                stroke={ink}
                strokeWidth="4"
            />
            <path
                d="M16 25a17 17 0 0 1 11-8"
                fill="none"
                stroke={shine}
                strokeWidth="4"
                strokeLinecap="round"
            />
            <ellipse cx="32" cy="46" rx="11" ry="8.5" fill={cream} />
            <circle cx="22.5" cy="34" r="4" fill={ink} />
            <circle cx="41.5" cy="34" r="4" fill={ink} />
            <circle cx="24" cy="32.5" r="1.5" fill="white" />
            <circle cx="43" cy="32.5" r="1.5" fill="white" />
            <ellipse cx="32" cy="42.5" rx="4.5" ry="3.2" fill={ink} />
            <path
                d="M32 45v3.5M27.5 49q4.5 3.5 9 0"
                fill="none"
                stroke={ink}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
