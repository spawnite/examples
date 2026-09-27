import { useState } from "react";
import { Game, Scene, WireFormat, type RoomOptions } from "@spawnite/engine";
import { Holdfast } from "../scenes/Holdfast";
import { preloadWardenBodies } from "../views/avatars";
import { preloadCircleModels } from "../views/circle/models";
import { preloadMonsterModels } from "../views/monsters/models";
import { HoldfastLoadingScreen } from "./LoadingScreen";

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

export function App() {
    //  Game reads its room once, when it mounts.
    const [room] = useState(() => readRoomOptions(window.location.search));

    return (
        <Game
            name="holdfast"
            start="holdfast"
            room={room}
            loadingScreen={HoldfastLoadingScreen}
        >
            <Scene name="holdfast" component={Holdfast} />
        </Game>
    );
}

export default App;
