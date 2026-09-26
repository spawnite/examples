import {
    Camera,
    CameraTarget,
    Hud,
    Panel,
    Player,
    Slot,
    Text,
    World,
} from "@spawnite/engine";

/** What happens in the feature scene, in one line. */
export function Feature() {
    return (
        <World map="meadow">
            <Player />
            <Camera follow={CameraTarget.Player} />
            <Hud>
                <Panel slot={Slot.Bottom}>
                    <Text>Feature</Text>
                </Panel>
            </Hud>
        </World>
    );
}
