import { ink, readIconLabelProps, type SledIconProps } from "./svg";
import { WorldId } from "../lobby/worlds";

/** The six arms of the snowflake. */
const arms = [0, 60, 120, 180, 240, 300];

interface WorldIconProps extends SledIconProps {
    world: WorldId;
}

/** A world's badge: a snowflake on ice blue for the snow, a cactus on
 *  sunset orange for the desert. */
export function WorldIcon({ world, label, className }: WorldIconProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            {...readIconLabelProps(label)}
        >
            <circle
                cx="32"
                cy="32"
                r="28"
                fill={world === WorldId.Snow ? "#8ccfff" : "#ff9f5a"}
                stroke={ink}
                strokeWidth="4"
            />
            {world === WorldId.Snow ? (
                <g
                    fill="none"
                    stroke="white"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                >
                    {arms.map((angle) => (
                        <path
                            key={angle}
                            transform={`rotate(${angle} 32 32)`}
                            d="M32 32V14M32 20.5l-5-5M32 20.5l5-5"
                        />
                    ))}
                </g>
            ) : (
                <path
                    d="M28 52V18a4 4 0 0 1 8 0v34M28 38h-6a4 4 0 0 1-4-4v-8M36 32h6a4 4 0 0 0 4-4v-6"
                    fill="none"
                    stroke="#3f9b4a"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    );
}
