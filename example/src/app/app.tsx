import { lazy, Suspense } from "react";
import {
    Game,
    Hud,
    Panel,
    registerMaps,
    Scene,
    Slot,
    Text,
    useWallet,
} from "@spawnite/engine";
import { Lobby } from "../scenes/Lobby";
import { Platforms } from "../scenes/Platforms";
import { Run } from "../scenes/Run";

//  The example game: a lobby where the heroine stands, then a run through
//  three coins to a goal ring, or a climb up five platforms. One file per
//  level of the engine's shape.

/** The wallet, at game level, so it reads the same in every scene. */
function Readout() {
    const { coins } = useWallet();

    return (
        <Hud>
            <Panel slot={Slot.TopRight}>
                <Text>Coins {coins}</Text>
            </Panel>
        </Hud>
    );
}

//  Every map file under src/maps, each by its file name.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

//  Shown in development, or with ?debug in the URL to demo a deploy.
//  A creator's game keeps the wiki's DEV-only gate.
const showsDevtools =
    import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has("debug");
const ExampleDevtools = lazy(() => import("./devtools"));

export function App() {
    return (
        <Game name="example" start="lobby">
            <Scene name="lobby" component={Lobby} />
            <Scene name="run" component={Run} />
            <Scene name="platforms" component={Platforms} />
            <Readout />
            {showsDevtools && (
                <Suspense fallback={null}>
                    <ExampleDevtools />
                </Suspense>
            )}
        </Game>
    );
}

export default App;
