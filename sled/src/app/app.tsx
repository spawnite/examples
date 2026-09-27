import { lazy, Suspense } from "react";
import { Game, registerMaps, Scene } from "@spawnite/engine";
import { Track } from "../levels";
import { Run } from "../scenes/Run";
import { systems } from "../systems";

//  Every map file under src/maps, each by its file name.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

//  Development only: a production build drops the import.
const SledDevtools = import.meta.env.DEV
    ? lazy(() => import("./devtools"))
    : undefined;

export function App() {
    return (
        <Game name="sled" start="run" systems={systems} levels={Track}>
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
