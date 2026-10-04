import { useMemo } from "react";
import { useScenes } from "@spawnite/engine";
import { Devtools } from "@spawnite/devtools";
import { listPlaytestActions } from "../devtools/playtestActions";

//  Loaded through the lazy import in app.tsx, only when its gate shows the
//  tools, so a page that hides them never fetches this module.

export default function GameDevtools() {
    const scene = useScenes().active;
    //  Once per scene, so the page's actions are put there once.
    const playtestActions = useMemo(() => listPlaytestActions(scene), [scene]);
    return <Devtools playtestActions={playtestActions} />;
}
