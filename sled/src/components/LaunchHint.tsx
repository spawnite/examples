import { useQueryFirst, useTrait } from "koota/react";
import { Hud, Panel, PanelVariant, Slot, useLevels } from "@spawnite/engine";
import { Track } from "../levels";
import { RunTrait } from "../ride/course";
import { isAiming } from "../ride/sling";
import { Numeral } from "./Numeral";

/** The hint's two lines, which a phone held upright keeps whole. */
const hintLines = ["Drag back", "and let go to launch"];
const hintText = hintLines.join(" ");

/** How to launch, over the rider on the sling of track 1 alone: the first
 *  run teaches the drag, and the launch takes the line away. */
export function LaunchHint() {
    const { current } = useLevels();
    const rider = useQueryFirst(RunTrait) ?? null;
    //  The run's record redraws it, so the launch takes the line away.
    useTrait(rider, RunTrait);
    if (current !== Track.One || !rider || !isAiming(rider)) return null;
    return (
        <Hud>
            <Panel slot={Slot.Center} variant={PanelVariant.Bare}>
                <Numeral
                    as="p"
                    aria-label={hintText}
                    className="flex flex-col items-center gap-2"
                >
                    {hintLines.map((line) => (
                        <Numeral
                            key={line}
                            className="text-2xl whitespace-nowrap sm:text-4xl"
                        >
                            {line}
                        </Numeral>
                    ))}
                </Numeral>
            </Panel>
        </Hud>
    );
}
