import { createStore } from "@spawnite/engine";
import { hudPlugin, readKeyCap } from "./hud.plugin";

//  Which of the hero's windows are open. A store, so the menu and the keys
//  can each open one.

type Windows = {
    stats: boolean;
    bag: boolean;
    gm: boolean;
    skills: boolean;
    /** The class editor, opened from the GM tools. */
    classes: boolean;
};

const closed: Windows = {
    stats: false,
    bag: false,
    gm: false,
    skills: false,
    classes: false,
};

export const useWindows = createStore<Windows>()(() => closed);

/** Opens a window, or closes it if open. `alone` closes the others as it
 *  opens, as on a phone, where a window takes the screen. */
export function toggleWindow(name: keyof Windows, alone = false) {
    useWindows.setState((open) =>
        alone && !open[name]
            ? { ...closed, [name]: true }
            : { [name]: !open[name] },
    );
}

export function openWindow(name: keyof Windows) {
    useWindows.setState({ [name]: true });
}

export function closeWindow(name: keyof Windows) {
    useWindows.setState({ [name]: false });
}

/** The cap of the key that opens and closes each window the player
 *  opens, as its action binds it. */
export const windowKeys: Record<Exclude<keyof Windows, "classes">, string> = {
    stats: readKeyCap(hudPlugin.actions.stats),
    bag: readKeyCap(hudPlugin.actions.bag),
    gm: readKeyCap(hudPlugin.actions.gm),
    skills: readKeyCap(hudPlugin.actions.skills),
};
