import { lazy, Suspense } from "react";
import { Game, registerMaps, Scene } from "@spawnite/engine";
import { plugins } from "../game";
import { bladeboundQuality } from "../view/graphics";
import { Lobby } from "../scenes/Lobby";
import { Run } from "../scenes/Run";

//  Bladebound: a town, then the wilds, where the hero hunts monsters for
//  experience, levels up and spends stat points.

//  Every map file under src/maps, each by its file name.
registerMaps(import.meta.glob("../maps/*.json", { eager: true }));

//  Development only, as `spawnite play` drives the game through them; a
//  production build drops the import.
const GameDevtools = import.meta.env.DEV
    ? lazy(() => import("./devtools"))
    : undefined;

export function App() {
    return (
        <Game
            name="bladebound"
            start="lobby"
            plugins={plugins}
            quality={bladeboundQuality}
        >
            <Scene name="lobby" component={Lobby} />
            <Scene name="run" component={Run} />
            {GameDevtools && (
                <Suspense fallback={null}>
                    <GameDevtools />
                </Suspense>
            )}
        </Game>
    );
}

export default App;
