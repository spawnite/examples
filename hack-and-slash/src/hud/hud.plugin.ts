import {
    definePlugin,
    pageAction,
    type PageActionHandle,
} from "@spawnite/engine";

/** The page's keys: the fight's own and the windows'. The room never hears
 *  them; each runs on the page what it always did. */
export const hudPlugin = definePlugin({
    name: "hud",
    description:
        "The page's keys: the attack, the dodge, the potion, the paw's slots and the windows.",
    actions: {
        /** Held to keep attacking, beside the left button. */
        attack: pageAction({
            keys: ["KeyJ"],
            description:
                "Attacks toward the pointer, again and again while held.",
        }),
        potion: pageAction({ keys: ["KeyQ"], description: "Drinks a potion." }),
        dodge: pageAction({
            keys: ["Space"],
            description: "Dodges the way she walks.",
        }),
        slot1: pageAction({
            keys: ["Digit1", "Numpad1"],
            description: "Uses what stands in the paw's first slot.",
        }),
        slot2: pageAction({
            keys: ["Digit2", "Numpad2"],
            description: "Uses what stands in the paw's second slot.",
        }),
        slot3: pageAction({
            keys: ["Digit3", "Numpad3"],
            description: "Uses what stands in the paw's third slot.",
        }),
        slot4: pageAction({
            keys: ["Digit4", "Numpad4"],
            description: "Uses what stands in the paw's fourth slot.",
        }),
        stats: pageAction({
            keys: ["KeyC"],
            description: "Opens and closes the character window.",
        }),
        bag: pageAction({
            keys: ["KeyI"],
            description: "Opens and closes the bag.",
        }),
        skills: pageAction({
            keys: ["KeyK"],
            description: "Opens and closes the skills window.",
        }),
        gm: pageAction({
            keys: ["KeyG"],
            description: "Opens and closes the GM tools.",
        }),
    },
});

/** The character a key's cap shows for `action`'s first key, lower case:
 *  `j` for KeyJ, `1` for Digit1; empty for an action with no key. */
export function readKeyCap(action: PageActionHandle) {
    return (action.keys[0] ?? "").replace(/^(Key|Digit)/, "").toLowerCase();
}
