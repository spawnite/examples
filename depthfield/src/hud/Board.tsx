import { Text } from "@spawnite/engine";
import { findStage } from "../rules/stages";
import { useProgress } from "../store/progress";

//  The player's best runs, each with its stage: won runs first, the longest of them first, then
//  by the damage they dealt.
//  ponytail: the player's own runs only; the platform has no leaderboard yet, and the
//  source's /api/scores has no home here (the pull request's follow-up).

function formatClock(seconds: number) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface BoardProps {
    /** The player's own name, marked on the board. */
    you: string;
}

export function Board({ you }: BoardProps) {
    const rows = useProgress((state) => state.board);
    if (!rows.length)
        return (
            <Text as="p" className="df-boardempty">
                No scores yet. Finish a run to claim the first rank.
            </Text>
        );
    return (
        <>
            <Text as="div" className="df-boardhead">
                <Text>{""}</Text>
                <Text>Level</Text>
                <Text>Nickname</Text>
                <Text>Class</Text>
                <Text>Stage</Text>
                <Text>Time</Text>
                <Text>Damage</Text>
            </Text>
            <Text as="ol" className="df-board">
                {rows.map((row, rank) => (
                    <Text
                        key={`${rank} ${row.nickname} ${row.damage}`}
                        as="li"
                        className={row.nickname === you ? "df-you" : ""}
                    >
                        <Text as="b">{rank + 1}</Text>
                        <Text as="i">{`Lv ${row.level}`}</Text>
                        <Text>{row.nickname}</Text>
                        <Text as="em">{row.className}</Text>
                        <Text as="em">{findStage(row.stage).name}</Text>
                        <Text as="time">{formatClock(row.seconds)}</Text>
                        <Text as="strong">{row.damage.toLocaleString()}</Text>
                    </Text>
                ))}
            </Text>
        </>
    );
}
