import { ink, readIconLabelProps, type SledIconProps } from "./svg";

const grey = "#6d717c";
const shine = "#959aa6";
const stripe = "#474a54";
const light = "#cdd0d7";
const pink = "#e9a7ae";

/** The cat's head: grey tabby stripes, pointed ears and whiskers. */
export function CatIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <path
                d="M10 31 13 7l15 11zM54 31 51 7 36 18z"
                fill={grey}
                stroke={ink}
                strokeWidth="4"
                strokeLinejoin="round"
            />
            <path d="M15 24 16 14l7 5zM49 24l-1-10-7 5z" fill={pink} />
            <ellipse
                cx="32"
                cy="37"
                rx="26"
                ry="22"
                fill={grey}
                stroke={ink}
                strokeWidth="4"
            />
            <path
                d="M32 18v7M25 19l2 6M39 19l-2 6"
                fill="none"
                stroke={stripe}
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M14 28a16 16 0 0 1 6-6"
                fill="none"
                stroke={shine}
                strokeWidth="4"
                strokeLinecap="round"
            />
            <circle cx="27.5" cy="47" r="6" fill={light} />
            <circle cx="36.5" cy="47" r="6" fill={light} />
            <circle cx="22.5" cy="35" r="4" fill={ink} />
            <circle cx="41.5" cy="35" r="4" fill={ink} />
            <circle cx="24" cy="33.5" r="1.5" fill="white" />
            <circle cx="43" cy="33.5" r="1.5" fill="white" />
            <path
                d="M29 42h6l-3 3.5z"
                fill={pink}
                stroke={ink}
                strokeWidth="2"
                strokeLinejoin="round"
            />
            <path
                d="M15 45H7M15 49l-7 2.5M49 45h8M49 49l7 2.5"
                fill="none"
                stroke={ink}
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}
