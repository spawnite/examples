import { createStore } from "@spawnite/engine";

//  What the page shows of the fight: a defeat's dialog and a level up's
//  banner. The step writes it only when one of those happens.

type Battle = {
    defeated: boolean;
    /** Experience the defeat took. */
    xpLost: number;
    /** Counts level ups, so the banner shows again for each. */
    levelUps: number;
};

export const useBattle = createStore<Battle>()(() => ({
    defeated: false,
    xpLost: 0,
    levelUps: 0,
}));

export function resetBattle() {
    useBattle.setState({ defeated: false, xpLost: 0 });
}
