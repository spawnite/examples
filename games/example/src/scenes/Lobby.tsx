import {
    Button,
    Camera,
    CameraPreset,
    Hud,
    Panel,
    PanelVariant,
    Player,
    Slot,
    useScenes,
    World,
} from "@spawnite/engine";
import "../items";

/** The heroine standing in the meadow, a free camera, and the buttons to the run
 *  and the platforms. */
export function Lobby() {
    const scenes = useScenes();

    return (
        <World map="meadow">
            <Player />
            {/*  The orbit it has always had: the left button's drag,
                and no click-to-walk. */}
            <Camera
                follow={null}
                preset={CameraPreset.Classic}
                clickToWalk={false}
            />
            <Hud>
                <Panel slot={Slot.Bottom} variant={PanelVariant.Bare}>
                    <Button onPress={() => scenes.go("run")}>Play</Button>
                    <Button onPress={() => scenes.go("platforms")}>
                        Platforms
                    </Button>
                </Panel>
            </Hud>
        </World>
    );
}
