import { Hud } from "@spawnite/engine";
import type { RiderId } from "../ride/riders";
import { CoinCount } from "./CoinCount";
import { RunProgress } from "./RunProgress";
import { SpeedReadout } from "./SpeedReadout";

export interface RunHudViewProps {
    /** The track being run, counted from 1. */
    track: number;
    /** The distance run over the finish's, 0 to 1. */
    progress: number;
    /** The animal riding, whose head slides along the strip. */
    rider: RiderId;
    coins: number;
    /** Kilometres an hour, whole; left out off the ride, on the sling and
     *  once the run has ended. */
    speed?: number;
    /** Below the stall speed while riding. */
    stalling?: boolean;
}

/** The run's HUD with no pane: the strip to the finish across the top,
 *  the coins at the top right, and the speed under them, each a bare
 *  Panel floating over the world. */
export function RunHudView({
    track,
    progress,
    rider,
    coins,
    speed,
    stalling = false,
}: RunHudViewProps) {
    return (
        <Hud>
            <RunProgress track={track} progress={progress} rider={rider} />
            <CoinCount coins={coins} />
            {speed !== undefined && (
                <SpeedReadout speed={speed} stalling={stalling} />
            )}
        </Hud>
    );
}
