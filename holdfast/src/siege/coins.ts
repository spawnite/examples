import { createQuery, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    readEach,
    Transform,
    Wallet,
    type StepOptions,
} from "@spawnite/engine/core";
import { drawRandom } from "./random";
import { readWardenStat, WardenStat } from "./stats";
import { CoinScatter, CoinTrait, Lifetime, WardenTrait } from "./traits";
import { queryStandingWardens } from "./wardens";

//  Coins: dropped where a monster falls, pulled to a warden who comes near,
//  and counted into her wallet: the personal score.

/** Metres from a warden inside which a coin flies to her. */
const pullMetres = 3.5;
/** Metres a second a pulled coin flies. */
const pullSpeed = 10;
/** Metres from her middle at which a coin is hers. */
const takeMetres = 0.6;
/** Seconds a coin lies before it fades. */
const coinSeconds = 25;
/** Metres a dropped coin lands from where the monster fell, at most. */
const scatterMetres = 1;
/** Coins one fall scatters, at most; a richer monster's are worth more. */
const mostCoins = 4;
/** Metres above the ground a coin floats. */
const floatMetres = 0.5;
/** Seconds before it goes at which a coin starts to blink. */
const fadingSeconds = 4;

//  Written in place for each coin.
const toward = new Vector3();

/** Coins' worth dropped at a place. */
interface CoinDrop {
    position: Vector3;
    value: number;
}

/** Scatters `value` coins' worth round `position`, a few coins at most. */
export function dropCoins(world: World, { position, value }: CoinDrop) {
    if (!world.has(CoinScatter)) world.add(CoinScatter);
    const scatter = world.get(CoinScatter);
    if (!scatter) return;
    const count = Math.min(value, mostCoins);
    for (let index = 0; index < count; index++) {
        const share =
            Math.floor(value / count) + (index < value % count ? 1 : 0);
        const angle = drawRandom(scatter) * Math.PI * 2;
        const distance = drawRandom(scatter) * scatterMetres;
        world.spawn(
            Transform(
                new Vector3(
                    position.x + Math.sin(angle) * distance,
                    position.y + floatMetres,
                    position.z + Math.cos(angle) * distance,
                ),
            ),
            CoinTrait({ value: share }),
            Lifetime({ seconds: coinSeconds }),
        );
    }
}

/** Credits `value` coins to the warden, times her coin value, carrying
 *  what falls short of a whole coin to the next. */
function creditCoins(warden: Entity, value: number) {
    const survivor = warden.get(WardenTrait);
    if (!survivor) return;
    const earned =
        value * readWardenStat(warden, WardenStat.CoinValue) +
        survivor.coinRemainder;
    const whole = Math.floor(earned);
    warden.set(WardenTrait, { coinRemainder: earned - whole });
    if (!warden.has(Wallet)) warden.add(Wallet);
    warden.set(Wallet, (wallet) => ({ coins: wallet.coins + whole }));
}

const coins = createQuery(CoinTrait, Transform, Lifetime);

/** Pulls each coin toward the nearest warden within reach and gives it to
 *  her once it reaches her, and marks one about to go. */
export function gatherCoins(world: World, { deltaSeconds }: StepOptions) {
    readEach(world, coins, ([settings, position, lifetime], coin) => {
        let taker: Entity | undefined;
        let nearest = pullMetres;
        for (const warden of queryStandingWardens(world)) {
            const feet = warden.get(Transform);
            if (!feet) continue;
            const distance = toward
                .set(feet.x, feet.y + floatMetres, feet.z)
                .distanceTo(position);
            if (distance < nearest) {
                nearest = distance;
                taker = warden;
            }
        }
        const feet = taker?.get(Transform);
        if (taker && feet) {
            if (nearest <= takeMetres) {
                creditCoins(taker, settings.value);
                coin.destroy();
                return;
            }
            toward
                .set(feet.x, feet.y + floatMetres, feet.z)
                .sub(position)
                .setLength(Math.min(pullSpeed * deltaSeconds, nearest));
            position.add(toward);
        }
        const fading = lifetime.seconds < fadingSeconds;
        if (fading !== settings.fading) coin.set(CoinTrait, { fading });
    });
}
