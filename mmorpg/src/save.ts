import type { World } from "koota";
import {
    frameCamera,
    readCameraFraming,
    readGameSave,
    type GameStores,
    type PlayerProps,
} from "@spawnite/engine";

export const autosaveSettings = {
    //  The safety net under the page events, so a tab that dies loses at most
    //  this much. Zelda: Breath of the Wild autosaves on a timer of a few
    //  minutes beside the events it names; one small JSON affords less.
    seconds: 30,
};

type SaveStore = GameStores["save"];

interface SaveOptions {
    store: SaveStore;
}

export function saveGame(world: World, { store }: SaveOptions) {
    //  The stored framing is optional, so a save with none would quietly drop
    //  the player's.
    const camera = readCameraFraming(world);
    if (!camera) return false;
    const save = readGameSave(world);
    return save === null
        ? false
        : store.getState().writeSave({ ...save, camera });
}

/** The saved hero as Player's spawn props, or none when nothing is saved,
 *  so Player spawns her on its own defaults. */
export function readSavedHero(
    store: SaveStore,
): Pick<PlayerProps, "position" | "facing" | "health" | "stats"> {
    const save = store.getState().initialSave;
    if (!save?.hero) return {};
    const { position, facing, health } = save.hero;
    const { x, y, z } = position;
    return { position: [x, y, z], facing, health, stats: save.stats };
}

export function loadCamera(world: World, { store }: SaveOptions) {
    const { initialSave, markSaved } = store.getState();
    if (initialSave?.camera) frameCamera(world, initialSave.camera);
    //  Read back rather than reused: the orbit clamps a stored framing to its
    //  own bounds, and a baseline of what was asked for would read as a change
    //  on the next frame and save it straight back.
    const camera = readCameraFraming(world);
    if (!camera) return;
    // Keep the saved hero baseline so startup grounding remains eligible to save.
    const save = initialSave ?? readGameSave(world);
    if (save) markSaved({ ...save, camera });
}

//  Counts the frames' seconds and saves when enough of them have passed. The
//  count lives here rather than in the loop, so the rule is in one file and a
//  test drives it with deltas instead of a clock.
export function createAutosave(store: SaveStore) {
    let secondsSinceSave = 0;

    return function autosaveGame(world: World, deltaSeconds: number) {
        secondsSinceSave += deltaSeconds;
        if (secondsSinceSave < autosaveSettings.seconds) return false;

        secondsSinceSave = 0;
        return saveGame(world, { store });
    };
}
