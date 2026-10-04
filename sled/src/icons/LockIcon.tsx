import { ink, readIconLabelProps, type SledIconProps } from "./svg";

/** A padlock: a grey shackle over a gold body with a keyhole. */
export function LockIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <path
                d="M19 30V21a13 13 0 0 1 26 0v9"
                fill="none"
                stroke={ink}
                strokeWidth="13"
                strokeLinecap="round"
            />
            <path
                d="M19 30V21a13 13 0 0 1 26 0v9"
                fill="none"
                stroke="#c9d1e0"
                strokeWidth="5"
                strokeLinecap="round"
            />
            <rect
                x="10"
                y="27"
                width="44"
                height="32"
                rx="7"
                fill="#ffc93c"
                stroke={ink}
                strokeWidth="4"
            />
            <path
                d="M32 37.5a4.5 4.5 0 0 0-2.4 8.3V50h4.8v-4.2a4.5 4.5 0 0 0-2.4-8.3z"
                fill={ink}
            />
        </svg>
    );
}
