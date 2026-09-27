import { useQueryFirst, useTrait } from "koota/react";
import { useEffect, useRef } from "react";
import { Authority, Hero, Wallet } from "@spawnite/engine";
import { WardenTrait } from "../siege/traits";
import { playSound, Sound } from "./sounds";

/** Sounds her own warden's news: a coin into her wallet, a blow she
 *  takes, her fall and her rise, a card she takes. */
export function Cues() {
    const hero = useQueryFirst(Hero, Authority);
    const survivor = useTrait(hero, WardenTrait);
    const wallet = useTrait(hero, Wallet);
    const coins = wallet?.coins ?? 0;
    const health = survivor?.health ?? 0;
    const down = survivor?.down ?? false;
    const taken = survivor?.taken ?? "";
    const lastRef = useRef({ coins, health, down, taken });

    useEffect(() => {
        const last = lastRef.current;
        lastRef.current = { coins, health, down, taken };
        if (coins > last.coins) playSound(Sound.Coin);
        if (down && !last.down) playSound(Sound.Down);
        else if (!down && last.down) playSound(Sound.Revive);
        else if (health < last.health - 0.5) playSound(Sound.Hurt);
        if (taken !== "" && taken !== last.taken) playSound(Sound.Card);
    }, [coins, health, down, taken]);

    return null;
}
