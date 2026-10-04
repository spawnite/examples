import { useWorld } from "koota/react";
import { NotebookText } from "lucide-react";
import { useEffect } from "react";
import {
    Button,
    Hud,
    Icon,
    Joystick,
    listenToAction,
    Tap,
    Text,
    useHeadless,
    useInput,
    useScenes,
} from "@spawnite/engine";
import { field } from "../rules/field.plugin";
import { RunPhase } from "../rules/traits";
import { pickCard } from "../rules/upgrades";
import { useChoice } from "../store/choice";
import { restartRun } from "../store/flow";
import { findRun } from "../views/findRun";
import { usePhoneLayout } from "./usePhoneLayout";
import { useRunView } from "./useRunView";

//  The keys and buttons beyond the engine's walk: P pauses, M opens the
//  field notes, 1 to 4 pick a card. A hidden page pauses the run. On a
//  touch screen a stick walks and a button dashes; the engine's jump is the
//  dash.

export function Controls() {
    const world = useWorld();
    const scenes = useScenes();
    const headless = useHeadless();
    const steer = useInput((state) => state.steer);
    const jump = useInput((state) => state.jump);
    const playing = useRunView((run) => run.phase) === RunPhase.Playing;
    //  A phone keeps pause alone: restart and the notes are in its menu.
    const phone = usePhoneLayout();
    useEffect(() => {
        if (headless) return;
        const phase = () => findRun(world)?.phase;
        const { pickFirst, pickSecond, pickThird, pickFourth, notes, pause } =
            field.actions;
        const stops = [
            ...[pickFirst, pickSecond, pickThird, pickFourth].map(
                (action, digit) =>
                    listenToAction(action, {
                        onPress: () => {
                            if (phase() === RunPhase.Upgrade)
                                pickCard(world, digit);
                        },
                    }),
            ),
            listenToAction(notes, {
                onPress: () =>
                    useChoice.setState((state) => ({ notes: !state.notes })),
            }),
            listenToAction(pause, {
                onPress: () => {
                    if (phase() === RunPhase.Playing)
                        useChoice.setState((state) => ({
                            paused: !state.paused,
                        }));
                },
            }),
        ];
        const onHidden = () => {
            if (document.hidden && phase() === RunPhase.Playing)
                useChoice.setState({ paused: true });
        };
        document.addEventListener("visibilitychange", onHidden);
        return () => {
            for (const stop of stops) stop();
            document.removeEventListener("visibilitychange", onHidden);
        };
    }, [world, headless]);

    return (
        <Hud>
            {playing && (
                <Text
                    as="div"
                    className="fixed top-[132px] right-3 flex gap-1.5 lg:top-[204px]"
                >
                    <Button
                        label="Pause"
                        className="df-btn df-iconbtn"
                        onPress={() =>
                            useChoice.setState((state) => ({
                                paused: !state.paused,
                            }))
                        }
                    >
                        <Icon name="pause" className="size-4" />
                    </Button>
                    {!phone && (
                        <>
                            <Button
                                label="Restart"
                                className="df-btn df-iconbtn"
                                onPress={() => restartRun(world, scenes)}
                            >
                                <Icon name="rotate-ccw" className="size-4" />
                            </Button>
                            <Button
                                label="Field notes"
                                className="df-btn df-iconbtn"
                                onPress={() =>
                                    useChoice.setState({ notes: true })
                                }
                            >
                                <Icon name={NotebookText} className="size-4" />
                            </Button>
                        </>
                    )}
                </Text>
            )}
            <Joystick onSteer={steer} />
            <Tap label="Dash" onTap={jump}>
                ⇢
            </Tap>
        </Hud>
    );
}
