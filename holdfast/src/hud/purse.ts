import type { Entity } from "koota";
import { useTrait } from "koota/react";
import { useEffect, useRef, useState } from "react";
import { isPlayerHero, WalletTrait } from "@spawnite/engine";
import { useCoinsInFlight } from "../views/CoinView";
import { isStill } from "./still";

/** Milliseconds a spent count takes to run down to what is left. */
export const tickMilliseconds = 300;

/** The coins a readout shows for `warden`: the room's count, less her own
 *  coins still flying to her on this page, so her health panel and the
 *  scoreboard both count a coin as it lands. A teammate's coins read as
 *  the room credits them. */
export function useShownCoins(warden: Entity | undefined) {
    const coins = useTrait(warden, WalletTrait)?.coins ?? 0;
    const flying = useCoinsInFlight((state) => state.coins);
    const own = warden !== undefined && isPlayerHero(warden);
    return Math.max(0, coins - (own ? flying : 0));
}

/** `value` as a count shows it: one that falls runs down to it over
 *  `tickMilliseconds`, as a purse pays out, and one that rises jumps to
 *  it, as each coin lands. */
export function useTickedCount(value: number) {
    const [shown, setShown] = useState(value);
    const shownRef = useRef(value);
    useEffect(() => {
        const from = shownRef.current;
        if (value >= from || isStill()) {
            shownRef.current = value;
            setShown(value);
            return;
        }
        const start = performance.now();
        let frame = 0;
        const tick = (now: number) => {
            const done = Math.min(1, (now - start) / tickMilliseconds);
            const next = Math.round(from + (value - from) * done);
            shownRef.current = next;
            setShown(next);
            if (done < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value]);
    return shown;
}
