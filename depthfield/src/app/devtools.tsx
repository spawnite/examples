import { useMemo } from "react";
import { useWorld } from "koota/react";
import { Devtools, type DevtoolsPanel } from "@spawnite/devtools";
import { useScenes } from "@spawnite/engine";
import { LookPanel } from "../devtools/LookPanel";
import { PlaytestPanel } from "../devtools/PlaytestPanel";
import { listPlaytestActions } from "../devtools/playtestActions";

//  Loaded only in development, through the lazy import in app.tsx, so a
//  production build never reaches this module or the devtools behind it.

//  Where `spawnite add panel` has a panel's entry pasted.
const panels: DevtoolsPanel[] = [
    { title: "Playtest", component: PlaytestPanel },
    { title: "Look", component: LookPanel },
];

export default function DepthfieldDevtools() {
    const world = useWorld();
    //  The store's own go, the same function every render.
    const { go } = useScenes();
    //  Once per world, so the page's actions are put there once.
    const playtestActions = useMemo(
        () => listPlaytestActions(world, { go }),
        [world, go],
    );
    return <Devtools panels={panels} playtestActions={playtestActions} />;
}
