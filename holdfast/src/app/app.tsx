import { lazy, Suspense, useState } from "react";
import {
    Game,
    Scene,
    WireFormat,
    type LoadingScreenOptions,
    type RoomOptions,
} from "@spawnite/engine";
import { plugins } from "../game";
import { HoldfastWarmHud } from "../hud/HoldfastWarmHud";
import { save } from "../save";
import { Holdfast } from "../scenes/Holdfast";
import { preloadWardenBodies } from "../views/avatars";
import { preloadCircleModels } from "../views/circle/models";
import { preloadMonsterModels } from "../views/monsters/models";

preloadWardenBodies();
preloadMonsterModels();
preloadCircleModels();

//  Holdfast: every page that opens it joins one room, which runs the siege.
//  The page moves its own warden and draws what the room streams.

/** Where the room runs when the address names none: the port the game's
 *  `room` target serves on. */
const defaultRoomUrl = "ws://localhost:8788";
const firstWords = ["Ash", "Iron", "Ember", "Stone", "Moss", "Frost"];
const secondWords = ["Warden", "Keeper", "Hound", "Lantern", "Oak", "Hawk"];

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

/** The engine's loading screen, dressed for the night; its colours are in
 *  styles.css. */
const loadingScreen: LoadingScreenOptions = {
    title: "Holdfast",
    //  The circle at dusk, from inside it, shot with spawnite play screenshot.
    art: `${import.meta.env.BASE_URL}loading.jpg`,
    line: "Hold the circle till dawn",
    tips: [
        "Step into the lit ring by the fire, or press R, to get ready.",
        "Two elements that meet on one monster set off a reaction.",
        "Between waves, stand by the fire to heal.",
        "Hold the fifteenth wave and dawn breaks over the circle.",
    ],
};

//  Development only: a production build drops the import.
const HoldfastDevtools = import.meta.env.DEV
    ? lazy(() => import("./devtools"))
    : undefined;

export function App() {
    //  Game reads its room once, when it mounts.
    const [room] = useState(() => readRoomOptions(window.location.search));

    return (
        <Game
            name="holdfast"
            start="holdfast"
            room={room}
            plugins={plugins}
            save={save}
            loadingScreen={loadingScreen}
        >
            <Scene name="holdfast" component={Holdfast} />
            <HoldfastWarmHud />
            {HoldfastDevtools && (
                <Suspense fallback={null}>
                    <HoldfastDevtools />
                </Suspense>
            )}
        </Game>
    );
}

export default App;
