import { useHas, useQueryFirst, useTrait } from "koota/react";
import { useEffect, useRef } from "react";
import { AuthorityTrait, HeroTrait } from "@spawnite/engine";
import { WardenTrait } from "../siege/traits";
import { playSound, Sound } from "./sounds";
import { LifeMachine } from "../siege/life";

/** The most steps a quick run of coins climbs, an octave: a burst of coins
 *  landing plays a rising scale, as Sonic's rings and Vampire Survivors'
 *  gems do. */
const coinRunSteps = 7;
/** The major scale's semitones, so a run climbs in tune. */
const scale = [0, 2, 4, 5, 7, 9, 11, 12];

/** The pitch of the coin that lands `run` coins into a quick run of them. */
export function readCoinPitch(run: number) {
    return 2 ** (scale[Math.min(run, coinRunSteps)] / 12);
}

/** Sounds her own warden's news: a blow she takes, her fall and her rise,
 *  a card she takes. Her coins chime as each lands, where they fly. */
export function Cues() {
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const survivor = useTrait(hero, WardenTrait);
    const health = survivor?.health ?? 0;
    const down = useHas(hero, LifeMachine.is.down);
    const taken = survivor?.taken ?? "";
    const lastRef = useRef({ health, down, taken });

    useEffect(() => {
        const last = lastRef.current;
        lastRef.current = { health, down, taken };
        if (down && !last.down) playSound(Sound.Down);
        else if (!down && last.down) playSound(Sound.Revive);
        else if (health < last.health - 0.5) playSound(Sound.Hurt);
        if (taken !== "" && taken !== last.taken) playSound(Sound.Card);
    }, [health, down, taken]);

    return null;
}
