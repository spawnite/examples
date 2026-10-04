import { ink, readIconLabelProps, type SledIconProps } from "./svg";

const orange = "#e8742a";
const shine = "#f39a5a";
const white = "#fff3e3";
const innerEar = "#3b2014";

/** The fox's head: orange, pointed ears and white cheeks. */
export function FoxIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <path
                d="M9 32 12 5l17 12zM55 32 52 5 35 17z"
                fill={orange}
                stroke={ink}
                strokeWidth="4"
                strokeLinejoin="round"
            />
            <path d="M14 24 15 12l9 6zM50 24 49 12l-9 6z" fill={innerEar} />
            <ellipse
                cx="32"
                cy="36"
                rx="26"
                ry="23"
                fill={orange}
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
            <path
                d="M32 57c-10.5 0-18.5-5.5-22-14.5 6.5.5 13.5 3 18 7.5l4 3.5 4-3.5c4.5-4.5 11.5-7 18-7.5C50.5 51.5 42.5 57 32 57z"
                fill={white}
            />
            <circle cx="22.5" cy="35" r="4" fill={ink} />
            <circle cx="41.5" cy="35" r="4" fill={ink} />
            <circle cx="24" cy="33.5" r="1.5" fill="white" />
            <circle cx="43" cy="33.5" r="1.5" fill="white" />
            <ellipse cx="32" cy="49" rx="4" ry="3" fill={ink} />
        </svg>
    );
}
