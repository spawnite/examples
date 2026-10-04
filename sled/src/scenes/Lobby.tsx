import { useState } from "react";
import { Hud, useLevels, type LevelId } from "@spawnite/engine";
import { useBank } from "../bank";
import { CoinCount } from "../components/CoinCount";
import { LookKind, LookPicker } from "../lobby/LookPicker";
import { SpeedUpgrade } from "../lobby/SpeedUpgrade";
import { defaultStageLayout, Stage } from "../lobby/Stage";
import { TrackMap } from "../lobby/TrackMap";
import { readTrackWorld } from "../lobby/worlds";
import type { RideId, RiderId } from "../ride/riders";
import { useProgress } from "../shop";

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins.
export { plugins } from "../game";

/** Where the player picks before a run: the rider on its ride on a 3D
 *  stage of the selected track's world, the arrows that cycle the animals
 *  and the rides, the Speed dial under the ride, the bank at the top right
 *  and the map of the tracks at the bottom, whose play button starts the
 *  run. The selected track starts as the last one played, or the first
 *  not finished on a fresh load. */
export function Lobby() {
    const { current } = useLevels();
    const progress = useProgress();
    const bank = useBank();
    const [selected, setSelected] = useState<LevelId>(current);
    //  The looks on show, which may be ones the player does not own yet.
    const [rider, setRider] = useState<RiderId>(progress.rider);
    const [ride, setRide] = useState<RideId>(progress.ride);
    const [layout, setLayout] = useState(defaultStageLayout);
    return (
        <>
            <Stage
                world={readTrackWorld(selected)}
                rider={rider}
                ride={ride}
                locked={{
                    rider: !progress.riders.includes(rider),
                    ride: !progress.rides.includes(ride),
                }}
                onLayout={setLayout}
            />
            <Hud>
                <CoinCount coins={bank} />
                <LookPicker
                    kind={LookKind.Rider}
                    shown={rider}
                    onShow={setRider}
                    at={layout.rider}
                    spread={layout.riderSpread}
                />
                <LookPicker
                    kind={LookKind.Ride}
                    shown={ride}
                    onShow={setRide}
                    at={layout.ride}
                    spread={layout.rideSpread}
                />
                <SpeedUpgrade at={layout.dial} />
                <TrackMap selected={selected} onSelect={setSelected} />
            </Hud>
        </>
    );
}
