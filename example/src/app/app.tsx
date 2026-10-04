import { lazy, Suspense, useState } from "react";
import {
    Game,
    Hud,
    Panel,
    registerMaps,
    Scene,
    Slot,
    Text,
    useWallet,
    type RoomOptions,
} from "@spawnite/engine";
import { plugins } from "../game";
import { save } from "../save";
import { Lobby } from "../scenes/Lobby";
import { Platforms } from "../scenes/Platforms";
import { Run } from "../scenes/Run";

//  The example game: a lobby where the void spirit stands, then a run through
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

//  Development only: a production build drops the import.
const ExampleDevtools = import.meta.env.DEV
    ? lazy(() => import("./devtools"))
    : undefined;

/** The room `?room=` names, as `spawnite play start` opens a game created
 *  with `--room`; none, so the game plays alone, where it names none. */
function readRoomOptions(search: string): RoomOptions | undefined {
    const query = new URLSearchParams(search);
    const url = query.get("room");
    if (url === null) return undefined;
    return { url, playerName: query.get("name") ?? "Player" };
}

export function App() {
    //  Game reads its room once, when it mounts.
    const [room] = useState(() => readRoomOptions(window.location.search));

    return (
        <Game
            name="example"
            start="lobby"
            room={room}
            plugins={plugins}
            save={save}
        >
            <Scene name="lobby" component={Lobby} />
            <Scene name="run" component={Run} />
            <Scene name="platforms" component={Platforms} />
            <Readout />
            {ExampleDevtools && (
                <Suspense fallback={null}>
                    <ExampleDevtools />
                </Suspense>
            )}
        </Game>
    );
}

export default App;
