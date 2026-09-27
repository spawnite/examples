import { useQueryFirst, useTrait } from "koota/react";
import {
    Hud,
    Icon,
    Panel,
    Slot,
    Text,
    TrackMoverTrait,
    useWallet,
} from "@spawnite/engine";
import { RunTrait } from "../ride/course";

/** The rider's speed down the run, in kilometres an hour. Its own
 *  component, so the step's writes redraw this line and nothing else. */
function Speed() {
    const rider = useQueryFirst(RunTrait, TrackMoverTrait) ?? null;
    const speed = useTrait(rider, TrackMoverTrait)?.speed ?? 0;
    return <Text>{`${Math.round(speed * 3.6)} km/h`}</Text>;
}

/** The run's coins and, under them, the speed, at the top right: the top
 *  left is the devtools' in a debug build. */
export function RunHud() {
    const coins = useWallet((state) => state.coins);
    return (
        <Hud>
            <Panel slot={Slot.TopRight} className="flex-row">
                <Icon name="coins" label="Coins" className="size-6" />
                <Text>{coins}</Text>
            </Panel>
            <Panel slot={Slot.TopRight}>
                <Speed />
            </Panel>
        </Hud>
    );
}
