import { lazy, Suspense } from "react";
import { Game, registerMaps, Scene } from "@spawnite/engine";
import { Run } from "../scenes/Run";
import { systems } from "../systems";

//  Every map file under src/maps, each by its file name.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

//  Shown in development, or with ?debug in the URL to demo a deploy.
//  A creator's game keeps the wiki's DEV-only gate.
const showsDevtools =
    import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has("debug");
const SledDevtools = lazy(() => import("./devtools"));

export function App() {
    return (
        <Game name="sled" start="run" systems={systems}>
            <Scene name="run" component={Run} />
            {showsDevtools && (
                <Suspense fallback={null}>
                    <SledDevtools />
                </Suspense>
            )}
        </Game>
    );
}

export default App;
