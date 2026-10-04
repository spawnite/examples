import { Bar, Text } from "@spawnite/engine";

//  One of a class's stats: its name, a bar, and its share of the base as a
//  percentage.

/** The share a full bar stands for: past the largest any class rolls. */
const fullShare = 1.7;

interface StatMeterProps {
    label: string;
    /** The share of the base, 1 for the base itself. */
    share: number;
}

export function StatMeter({ label, share }: StatMeterProps) {
    return (
        <Text as="div" className="df-stat">
            <Text>{label}</Text>
            <Bar
                label={label}
                value={share}
                maximum={fullShare}
                color="var(--df-accent)"
                className="df-statbar"
            />
            <Text as="b" tabular>{`${Math.round(share * 100)}%`}</Text>
        </Text>
    );
}
