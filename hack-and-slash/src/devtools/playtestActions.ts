import type { PlaytestAction } from "@spawnite/devtools";
import type { SceneName } from "@spawnite/engine";
import { finishCreation, useProgress } from "../hero/progress";
import { closeWindow, openWindow } from "../hud/windows";
import { editLook, useTown } from "../town/folk";

//  The steps `spawnite play action` runs. Each calls what its button in the
//  game calls, and refuses, with why, where that button is not on screen.

/** Whether the character creator stands on screen: the lobby alone draws
 *  it, for a hero not yet made or a look being changed. */
function isCreatorOpen(scene: SceneName | null) {
    return (
        scene === "lobby" &&
        (!useProgress.getState().created || useTown.getState().editingLook)
    );
}

/** What the character creator's Done does. */
export function finishLook(scene: SceneName | null) {
    if (!isCreatorOpen(scene))
        throw new Error(
            "Done closes the character creator, and it is not open.",
        );
    finishCreation();
    editLook(false);
}

/** What the GM window's Class editor button does. */
export function openClassEditor(scene: SceneName | null) {
    if (scene !== "lobby" && scene !== "run")
        throw new Error(
            `Class editor opens over the hero's screen, which the lobby and the run draw, and the page shows ${scene ?? "no scene"}.`,
        );
    if (isCreatorOpen(scene))
        throw new Error(
            "Class editor opens over the hero's screen, and the character creator stands over it: run Done first.",
        );
    closeWindow("gm");
    openWindow("classes");
}

/** The steps by name, for <Devtools playtestActions>, in the scene the
 *  game draws. */
export function listPlaytestActions(scene: SceneName | null): PlaytestAction[] {
    return [
        { name: "Done", run: () => finishLook(scene) },
        { name: "Class editor", run: () => openClassEditor(scene) },
    ];
}
