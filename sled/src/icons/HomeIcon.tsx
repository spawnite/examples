import { ink, readIconLabelProps, type SledIconProps } from "./svg";

/** Home: a white house with an ink edge and an ink door. */
export function HomeIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <path
                d="M8 31 32 9l24 22h-6v24H14V31z"
                fill="white"
                stroke={ink}
                strokeWidth="5"
                strokeLinejoin="round"
            />
            <rect x="26" y="37" width="12" height="18" rx="2" fill={ink} />
        </svg>
    );
}
