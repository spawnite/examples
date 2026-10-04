import { lazy, Suspense } from "react";
import { Game, registerMaps, Scene } from "@spawnite/engine";
import { plugins } from "../game";
import { Track } from "../levels";
import { save } from "../save";
import { Lobby } from "../scenes/Lobby";
import { Run } from "../scenes/Run";

//  Every map file under src/maps, each by its file name.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

//  Development only: a production build drops the import.
const SledDevtools = import.meta.env.DEV
    ? lazy(() => import("./devtools"))
    : undefined;

export function App() {
    return (
        <Game
            name="sled"
            start="lobby"
            plugins={plugins}
            levels={Track}
            save={save}
        >
            <Scene name="lobby" component={Lobby} />
            <Scene name="run" component={Run} />
            {SledDevtools && (
                <Suspense fallback={null}>
                    <SledDevtools />
                </Suspense>
            )}
        </Game>
    );
}

export default App;
