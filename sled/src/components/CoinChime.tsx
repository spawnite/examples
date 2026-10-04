import { useTrait } from "koota/react";
import { Sound, useEntity, WalletTrait } from "@spawnite/engine";
import coin from "@spawnite/assets/sounds/sled/sled-coin.mp3?url";

/** The coin sound, once for each coin the rider's wallet gains.
 *  ponytail: one pitch; the old sled stepped it up a semitone a coin, to
 *  twelve, which needs a pitch on the engine's Sound. */
export function CoinChime() {
    const coins = useTrait(useEntity(), WalletTrait)?.coins ?? 0;
    //  A new key each coin mounts the sound again, so it plays again.
    return coins > 0 ? <Sound key={coins} url={coin} /> : null;
}
