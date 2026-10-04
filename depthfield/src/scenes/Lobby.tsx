import {
    Bloom,
    PostProcessing,
    registerMaps,
    registerModel,
    useHeadless,
    Vignette,
    World,
} from "@spawnite/engine";
import { BoardScreen } from "../hud/BoardScreen";
import { LobbyScreen } from "../hud/LobbyScreen";
import { LobbyCamera } from "../views/LobbyCamera";
import { LobbySoldier } from "../views/LobbySoldier";
import { LobbyStage } from "../views/LobbyStage";
import { soldierModel, soldierModelName } from "../views/models";
import { glowThreshold } from "../views/neon";

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins.
export { plugins } from "../game";

//  Here as well as in the field, so a headless mount of this file alone has
//  the map and the model too.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));
registerModel(soldierModelName, soldierModel);

/** The bloom on the platform's neon: the field's soft glow. */
const bloomIntensity = 1.1;
const bloomRadius = 0.55;
const vignetteDarkness = 0.5;

/** The lobby, where a run is picked and left for: the soldier large on a
 *  neon platform in the stage picked, and the picks and Play over it. Play
 *  goes to the field with the run it starts. */
export function Lobby() {
    const headless = useHeadless();
    return (
        <World map="depthfield">
            {/*  Headless, as a simulate runs it, the lobby draws nothing. */}
            {!headless && (
                <>
                    <LobbyCamera />
                    <LobbyStage />
                    <LobbySoldier />
                    <PostProcessing toneMapping={false}>
                        <Bloom
                            intensity={bloomIntensity}
                            threshold={glowThreshold}
                            radius={bloomRadius}
                        />
                        <Vignette darkness={vignetteDarkness} />
                    </PostProcessing>
                    <LobbyScreen />
                    <BoardScreen />
                </>
            )}
        </World>
    );
}
