import { lazy, Suspense } from "react";
import { Game, registerMaps, Scene } from "@spawnite/engine";
import { Meadow } from "../scenes/Meadow";

//  Every map file under src/maps, each by its file name.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

//  Shown in development, or with ?debug in the URL to demo a deploy.
//  A creator's game keeps the wiki's DEV-only gate.
const showsDevtools =
    import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has("debug");
const MmorpgDevtools = lazy(() => import("./devtools"));

export function App() {
    return (
        <Game name="three-mmorpg" start="meadow">
            <Scene name="meadow" component={Meadow} />
            {showsDevtools && (
                <Suspense fallback={null}>
                    <MmorpgDevtools />
                </Suspense>
            )}
        </Game>
    );
}
