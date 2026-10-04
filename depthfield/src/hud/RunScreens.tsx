import { useWorld } from "koota/react";
import { useEffect } from "react";
import { Hud, Text } from "@spawnite/engine";
import { say } from "../rules/field";
import { readEarnedStage } from "../rules/run";
import { findStage } from "../rules/stages";
import { RunPhase } from "../rules/traits";
import { endRun } from "../store/flow";
import { unlockStage } from "../store/progress";
import { BoardScreen } from "./BoardScreen";
import { DeathScreen } from "./DeathScreen";
import { FieldNotes } from "./FieldNotes";
import { PauseMenu } from "./PauseMenu";
import { UpgradeSheet } from "./UpgradeSheet";
import { useRunView } from "./useRunView";
import { VictoryScreen } from "./VictoryScreen";

//  Which of the run's screens shows: the cards on a level-up, the pause and
//  the notes on a key, the fade as the hero falls, and the death or victory
//  screen at the end, which counts the run.
//  A run that earns the next stage opens it as it happens.

export function RunScreens() {
    const world = useWorld();
    const phase = useRunView((run) => run.phase);
    const ended =
        phase === RunPhase.Defeated || phase === RunPhase.Complete
            ? phase
            : null;
    useEffect(() => {
        if (ended) endRun(world, ended === RunPhase.Complete);
    }, [ended, world]);
    const earned = useRunView(readEarnedStage);
    useEffect(() => {
        if (earned && unlockStage(earned))
            say(world, `${findStage(earned).name} unlocked.`);
    }, [earned, world]);
    return (
        <>
            <Hud>
                <Text as="div" className="df-crt">
                    {null}
                </Text>
                {(phase === RunPhase.Dying || phase === RunPhase.Defeated) && (
                    <Text as="div" className="df-dying">
                        {null}
                    </Text>
                )}
            </Hud>
            <UpgradeSheet />
            {phase === RunPhase.Playing && <PauseMenu />}
            <FieldNotes />
            {phase === RunPhase.Defeated && <DeathScreen />}
            {phase === RunPhase.Complete && <VictoryScreen />}
            <BoardScreen />
        </>
    );
}
