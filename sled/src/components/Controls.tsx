import { useEffect } from "react";
import {
    Hud,
    Icon,
    isUiOwned,
    Joystick,
    Tap,
    useHeadless,
    useInput,
} from "@spawnite/engine";

/** Sled's controls beyond the engine's keys. On a touch screen, a stick
 *  pulls the sling down and aims it, then steers, and a tap fires the sling
 *  and then jumps. Enter fires as Space does. */
export function Controls() {
    const steer = useInput((state) => state.steer);
    const jump = useInput((state) => state.jump);
    const headless = useHeadless();
    useEffect(() => {
        //  Headless there is no page to take a key from.
        if (headless) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code === "Enter" && !event.repeat && !isUiOwned(event))
                jump();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [jump, headless]);

    return (
        <Hud>
            <Joystick
                onSteer={steer}
                className="fixed bottom-14 left-14 hidden pointer-coarse:flex"
            />
            <Tap
                label="Launch or jump"
                onTap={jump}
                className="fixed right-14 bottom-14 hidden pointer-coarse:flex"
            >
                <Icon name="arrow-big-up" />
            </Tap>
        </Hud>
    );
}
