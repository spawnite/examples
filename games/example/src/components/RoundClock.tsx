import { Hud, Panel, RoundState, Slot, Text, useRound } from "@spawnite/engine";

/** The run's round: the seconds left and the coins toward the target, then
 *  how it ended. */
export function RoundClock() {
    const { secondsLeft, score, target, state } = useRound();
    const label = {
        //  The example's round starts as it mounts, so these never show.
        [RoundState.Ready]: "",
        [RoundState.Countdown]: "",
        [RoundState.Playing]: `${Math.ceil(secondsLeft)} s left, ${score} of ${target} coins`,
        [RoundState.Won]: `Won with ${Math.ceil(secondsLeft)} s left`,
        [RoundState.Lost]: `Out of time, ${score} of ${target} coins`,
    }[state];

    return (
        <Hud>
            <Panel slot={Slot.Top}>
                <Text>{label}</Text>
            </Panel>
        </Hud>
    );
}
