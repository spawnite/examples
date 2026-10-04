import { ink, readIconLabelProps, type SledIconProps } from "./svg";

/** A thick white plus with an ink edge. */
export function PlusIcon({ label, className }: SledIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <path
                d="M32 12v40M12 32h40"
                stroke={ink}
                strokeWidth="18"
                strokeLinecap="round"
            />
            <path
                d="M32 12v40M12 32h40"
                stroke="white"
                strokeWidth="9"
                strokeLinecap="round"
            />
        </svg>
    );
}
