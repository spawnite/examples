import { useWorld } from "koota/react";
import {
    Button,
    ButtonVariant,
    Heading,
    Hud,
    Text,
    useScenes,
} from "@spawnite/engine";
import { primaryLook } from "./classes";
import { useChoice } from "../store/choice";
import { leaveRun } from "../store/flow";

//  The run is lost: black, a red YOU DIED, and the way back.

export function DeathScreen() {
    const world = useWorld();
    const scenes = useScenes();
    const board = useChoice((state) => state.board);
    if (board) return null;
    return (
        <Hud>
            <Text as="div" className="df-youdied df-text" aria-label="You died">
                <Heading level={1}>You Died</Heading>
                <Button
                    variant={ButtonVariant.Accent}
                    className={`${primaryLook} min-w-48`}
                    onPress={() =>
                        leaveRun(world, scenes, useChoice.getState().lastResult)
                    }
                >
                    Try Again
                </Button>
                <Button
                    className="df-btn"
                    onPress={() => useChoice.setState({ board: true })}
                >
                    Leaderboard
                </Button>
            </Text>
        </Hud>
    );
}
