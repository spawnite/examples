import { lazy, Suspense } from "react";
import { Game, registerMaps, Scene } from "@spawnite/engine";
import { Meadow } from "../scenes/Meadow";

//  Every map file under src/maps, each by its file name.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

//  Development only: a production build drops the import.
const MmorpgDevtools = import.meta.env.DEV
    ? lazy(() => import("./devtools"))
    : undefined;

export function App() {
    return (
        <Game name="three-mmorpg" start="meadow">
            <Scene name="meadow" component={Meadow} />
            {MmorpgDevtools && (
                <Suspense fallback={null}>
                    <MmorpgDevtools />
                </Suspense>
            )}
        </Game>
    );
}
