import { lazy, Suspense, useState } from "react";
import {
    Game,
    registerMaps,
    Scene,
    WireFormat,
    type RoomOptions,
} from "@spawnite/engine";
import { plugins } from "../game";
import { Scoreboard } from "../hud/Scoreboard";
import { Arena } from "../scenes/Arena";

//  Every map file under src/maps, each by its file name.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

//  The arena: every page that opens it joins one room, which runs the world.
//  The page moves its own heroine and draws what the room streams.

/** Where the room runs when the address names none: the port the arena's
 *  `room` target serves on. */
const defaultRoomUrl = "ws://localhost:8787";
const firstWords = ["Brave", "Quick", "Quiet", "Lucky", "Swift", "Merry"];
const secondWords = ["Fox", "Otter", "Wren", "Hare", "Lynx", "Newt"];

function pickWord(words: string[]) {
    return words[Math.floor(Math.random() * words.length)];
}

/** The room from `?room=` and the name from `?name=`; a name of two random
 *  words where none is given, so two tabs join as two players. `?wire=json`
 *  has the room send JSON text, to read the socket as it arrives. */
function readRoomOptions(search: string): RoomOptions {
    const query = new URLSearchParams(search);
    return {
        url: query.get("room") ?? defaultRoomUrl,
        playerName:
            query.get("name") ??
            `${pickWord(firstWords)} ${pickWord(secondWords)}`,
        wire:
            query.get("wire") === WireFormat.Json ? WireFormat.Json : undefined,
    };
}

//  Development only: a production build drops the import, and
//  test/build.test.ts proves it.
const ArenaDevtools = import.meta.env.DEV
    ? lazy(() => import("./devtools"))
    : undefined;

export function App() {
    //  Game reads its room once, when it mounts.
    const [room] = useState(() => readRoomOptions(window.location.search));

    return (
        <Game name="arena" start="arena" room={room} plugins={plugins}>
            <Scene name="arena" component={Arena} />
            <Scoreboard />
            {ArenaDevtools && (
                <Suspense fallback={null}>
                    <ArenaDevtools />
                </Suspense>
            )}
        </Game>
    );
}

export default App;
