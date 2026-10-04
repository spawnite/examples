import { useQueryFirst, useTrait } from "koota/react";
import { TrackMoverTrait, useLevels, useWallet } from "@spawnite/engine";
import { levels } from "../levels";
import { isRiding, RunTrait, stallSpeed } from "../ride/course";
import { spawnDistance } from "../ride/rider";
import { useProgress } from "../shop";
import { RunHudView } from "./RunHudView";

/** The kilometres an hour that one metre a second makes: the factor from
 *  the mover's speed to the readout's. */
const kilometresPerHourPerMetrePerSecond = 3.6;

/** The run's HUD from the live run: the track's number, the share of it
 *  run under the equipped animal's head, from the sling's spawn to the finish line, the coins, and the
 *  speed while riding, red below the speed that stalls the run. All of
 *  it keeps off the top left, which the devtools cover in a debug build. */
export function RunHud() {
    const { levels: order, current } = useLevels();
    const coins = useWallet((state) => state.coins);
    //  The animal the run's rider spawned on: the lobby changes it between
    //  runs only.
    const { rider: animal } = useProgress();
    const rider = useQueryFirst(RunTrait, TrackMoverTrait) ?? null;
    const mover = useTrait(rider, TrackMoverTrait);
    //  The record redraws it, and the run's tags change with the record.
    const run = useTrait(rider, RunTrait);
    //  Only between the launch and the end: on the sling the rider stands
    //  still, and an ended run's screen stands over the HUD.
    const riding = rider !== null && run !== undefined && isRiding(rider);
    const speed = mover?.speed ?? 0;
    const finish = levels[current].finish.at;
    return (
        <RunHudView
            track={order.findIndex((level) => level.id === current) + 1}
            progress={
                ((mover?.distance ?? spawnDistance) - spawnDistance) /
                (finish - spawnDistance)
            }
            rider={animal}
            coins={coins}
            speed={
                riding
                    ? Math.round(speed * kilometresPerHourPerMetrePerSecond)
                    : undefined
            }
            stalling={riding && speed < stallSpeed}
        />
    );
}
