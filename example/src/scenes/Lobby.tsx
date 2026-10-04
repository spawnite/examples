import {
    Button,
    Camera,
    CameraPreset,
    Hud,
    Panel,
    PanelVariant,
    Slot,
    useScenes,
    World,
} from "@spawnite/engine";
import "../items";
import { Spirit } from "../components/Spirit";

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins and its save.
export { plugins } from "../game";
export { save } from "../save";

/** The void spirit standing in the meadow, a free camera, and the buttons to the run
 *  and the platforms. */
export function Lobby() {
    const scenes = useScenes();

    return (
        <World map="meadow">
            <Spirit />
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
