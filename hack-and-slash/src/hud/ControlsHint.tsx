import { useEffect, useState } from "react";
import { Text } from "@spawnite/engine";
import { usePortrait, useTouch } from "../view/device";
import { hudPlugin, readKeyCap } from "./hud.plugin";
import { windowKeys } from "./windows";

const attackKey = readKeyCap(hudPlugin.actions.attack);
const potionKey = readKeyCap(hudPlugin.actions.potion);

/** Milliseconds the wilds show the controls before they fade. */
const fadeMilliseconds = 10000;

/** The controls, in the words for the device in hand. `fades`, in the
 *  wilds: gone after a few seconds, and on a phone standing above the
 *  potion and menu buttons rather than beside them. */
export function ControlsHint({
    size = "xs",
    fades = false,
}: {
    size?: "xs" | "sm";
    fades?: boolean;
}) {
    const touch = useTouch();
    const portrait = usePortrait();
    const [shown, setShown] = useState(true);
    useEffect(() => {
        if (!fades) return;
        const timer = setTimeout(() => setShown(false), fadeMilliseconds);
        return () => clearTimeout(timer);
    }, [fades]);
    if (!shown) return null;
    return (
        <Text
            size={size}
            className={
                fades ? `max-w-[70vw] text-center ${touch ? "mb-16" : ""}` : ""
            }
        >
            {touch
                ? `Drag anywhere to walk · tap to attack · hold to keep attacking · ${portrait ? "swipe to dodge" : "Dodge button to dodge"} · walk over loot to take it`
                : `WASD walks · click or hold ${attackKey.toUpperCase()} to attack toward the pointer · Space dodges · ${potionKey.toUpperCase()} potion · ${windowKeys.bag.toUpperCase()} bag · ${windowKeys.stats.toUpperCase()} character · ${windowKeys.skills.toUpperCase()} skills`}
        </Text>
    );
}
