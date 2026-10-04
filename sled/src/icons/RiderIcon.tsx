import { ink, readIconLabelProps, type SledIconProps } from "./svg";

const navy = "#2a3a6e";
const cream = "#f7edd6";
const beak = "#f7962a";

/** The penguin's head: navy, a cream face and an orange beak. */
export function RiderIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <ellipse
                cx="32"
                cy="33"
                rx="27"
                ry="26"
                fill={navy}
                stroke={ink}
                strokeWidth="4"
            />
            <path
                d="M32 57c-11.5 0-19-7-19-16.5C13 33.5 17 28 22.5 28c4 0 7 2.2 9.5 5.2 2.5-3 5.5-5.2 9.5-5.2C47 28 51 33.5 51 40.5 51 50 43.5 57 32 57z"
                fill={cream}
            />
            <path
                d="M17 20a17 17 0 0 1 11-8"
                fill="none"
                stroke="#5b6da8"
                strokeWidth="4"
                strokeLinecap="round"
            />
            <circle cx="24.5" cy="38" r="4.2" fill={ink} />
            <circle cx="39.5" cy="38" r="4.2" fill={ink} />
            <circle cx="26" cy="36.5" r="1.5" fill="white" />
            <circle cx="41" cy="36.5" r="1.5" fill="white" />
            <path
                d="M25.5 44.5h13L32 53z"
                fill={beak}
                stroke={ink}
                strokeWidth="2.5"
                strokeLinejoin="round"
            />
        </svg>
    );
}
