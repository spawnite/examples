import { lazy, Suspense } from "react";
import {
    Game,
    QualityLevel,
    Scene,
    type QualityOptions,
} from "@spawnite/engine";
import { plugins } from "../game";
import { Field } from "../scenes/Field";
import { Lobby } from "../scenes/Lobby";
import { fieldScene, lobbyScene } from "../store/flow";

//  Development only: a production build drops the import.
const DepthfieldDevtools = import.meta.env.DEV
    ? lazy(() => import("./devtools"))
    : undefined;

//  The neon is the game's look, so its glow draws at every level, as the
//  field's stack drew it before the levels set bloom. The arena's floor
//  covers the engine's ground, so no level grows grass, whose blades would
//  poke through it.
const quality: QualityOptions = {
    levels: {
        [QualityLevel.Minimum]: { bloom: true, grassShare: 0 },
        [QualityLevel.Low]: { bloom: true, grassShare: 0 },
        [QualityLevel.Medium]: { grassShare: 0 },
        [QualityLevel.High]: { grassShare: 0 },
    },
};

export function App() {
    return (
        <Game
            name="depthfield"
            start={lobbyScene}
            plugins={plugins}
            quality={quality}
        >
            <Scene name={lobbyScene} component={Lobby} />
            <Scene name={fieldScene} component={Field} />
            {DepthfieldDevtools && (
                <Suspense fallback={null}>
                    <DepthfieldDevtools />
                </Suspense>
            )}
        </Game>
    );
}

export default App;
