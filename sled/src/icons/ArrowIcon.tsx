import { ink, readIconLabelProps, type SledIconProps } from "./svg";

interface ArrowIconProps extends SledIconProps {
    /** Which way it points. */
    direction: "left" | "right";
}

/** A chunky white arrowhead with rounded corners, pointing left or right. */
export function ArrowIcon({ direction, label, className }: ArrowIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <path
                transform={direction === "left" ? "matrix(-1 0 0 1 64 0)" : ""}
                d="M20 8.5c0-3.5 3.8-5.6 6.8-3.8l29 22.6c3 2.3 3 6.9 0 9.3l-29 22.7c-3 1.8-6.8-.3-6.8-3.8z"
                fill="white"
                stroke={ink}
                strokeWidth="5"
                strokeLinejoin="round"
            />
        </svg>
    );
}
