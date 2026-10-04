import { domAnimation, LazyMotion, m } from "motion/react";
import { Numeral } from "../components/Numeral";
import { RoundButton } from "../components/RoundButton";
import { GaugeIcon } from "../icons/GaugeIcon";
import { speedSteps } from "../ride/speed";

export interface PlayButtonProps {
    /** The selected track's number, counted from 1. */
    track: number;
    /** The Speed step the track is tuned to finish at. */
    needed: number;
    /** The player's Speed step. */
    step: number;
    onPlay: () => void;
}

/** The large gold play button, which plays the selected track. While the
 *  player's Speed step is below the one the track needs, a small gauge and
 *  that step stand beside it in red: a warning, since it still plays. */
export function PlayButton({ track, needed, step, onPlay }: PlayButtonProps) {
    return (
        <LazyMotion features={domAnimation}>
            <m.div className="flex items-end gap-2">
                {step < needed && (
                    <m.div
                        className="mb-1 flex items-center gap-1"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                    >
                        <GaugeIcon
                            reading={needed / speedSteps}
                            className="size-8"
                        />
                        <Numeral
                            as="output"
                            aria-label="Speed step needed"
                            className="text-3xl text-[#ff4a3d]"
                        >
                            {needed}
                        </Numeral>
                    </m.div>
                )}
                <RoundButton
                    icon="play"
                    label={`Play track ${track}`}
                    onPress={onPlay}
                    lead
                />
            </m.div>
        </LazyMotion>
    );
}
