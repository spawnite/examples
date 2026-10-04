import { createQuery, type Entity, type World } from "koota";
import type { Vector3 } from "three";
import {
    emitEvent,
    findEntity,
    roundTo,
    WalletTrait,
} from "@spawnite/engine/core";
import { readWardenStat, WardenStat } from "./stats";
import {
    type CoinBurst,
    CoinBurstsTrait,
    LedgerTrait,
    SiegeTrait,
    WardenTrait,
} from "./traits";
import { queryWardens } from "./wardens";

//  Coins: every warden earns every coin, and each spends her own. A
//  monster's coins go to every warden in the room as it dies, each share
//  the drop over the crowd factor, so each earns about what a solo player
//  would, as Risk of Rain 2 splits its gold among the team. Each page
//  draws the coins popping from the monster and flying to each warden.

/** Coins' worth a monster drops at a place. */
interface CoinDrop {
    position: Vector3;
    value: number;
}

/** What a drop is divided by with `wardens` in the room: 1 alone, and 0.6
 *  more for each warden past the first, as a wave's count grows. */
export function measureCrowdFactor(wardens: number) {
    return 1 + 0.6 * (Math.max(1, wardens) - 1);
}

/** Whole coins one burst draws at most: a colossus's share flies as a
 *  handful, each worth more. */
export const mostBurstCoins = 6;

const sieges = createQuery(SiegeTrait);

/** Adds `burst` to the step's coin bursts on the siege. */
function addCoinBurst(world: World, burst: CoinBurst) {
    const siege = findEntity(world, sieges);
    if (!siege) return;
    emitEvent(siege, CoinBurstsTrait, (held) => {
        held.bursts.push(burst);
        return held;
    });
}

/** Her ledger, added where she has none. */
export function readLedger(warden: Entity) {
    if (!warden.has(LedgerTrait)) warden.add(LedgerTrait);
    return warden.get(LedgerTrait) ?? LedgerTrait.schema;
}

/** Credits `value` coins to `warden`, times her coin value, carrying what
 *  falls short of a whole coin to the next, and returns the whole coins
 *  her wallet took. */
function creditCoins(warden: Entity, value: number) {
    const survivor = warden.get(WardenTrait);
    if (!survivor) return 0;
    const earned =
        value * readWardenStat(warden, WardenStat.CoinValue) +
        survivor.coinRemainder;
    const whole = Math.floor(earned);
    warden.set(WardenTrait, { coinRemainder: earned - whole });
    if (whole === 0) return 0;
    if (!warden.has(WalletTrait)) warden.add(WalletTrait);
    warden.set(WalletTrait, (wallet) => ({ coins: wallet.coins + whole }));
    const ledger = readLedger(warden);
    warden.set(LedgerTrait, { earned: ledger.earned + whole });
    return whole;
}

/** Pays every warden in the room her share of the `value` coins a monster
 *  dropped at `position`, down or dropped or sheltered alike, and adds a
 *  burst for each whole coin share, which each page flies to her. */
export function shareCoins(world: World, { position, value }: CoinDrop) {
    const wardens = queryWardens(world);
    if (wardens.length === 0) return;
    const share = value / measureCrowdFactor(wardens.length);
    for (const warden of wardens) {
        const coins = creditCoins(warden, share);
        if (coins > 0)
            addCoinBurst(world, {
                to: warden,
                x: roundTo(position.x, 2),
                y: roundTo(position.y, 2),
                z: roundTo(position.z, 2),
                coins,
            });
    }
}

/** Takes `price` coins from her wallet, where it holds them, and counts
 *  them spent; false, taking nothing, where it does not. */
export function spendCoins(warden: Entity, price: number) {
    const coins = warden.get(WalletTrait)?.coins ?? 0;
    if (price > coins) return false;
    warden.set(WalletTrait, { coins: coins - price });
    const ledger = readLedger(warden);
    warden.set(LedgerTrait, { spent: ledger.spent + price });
    return true;
}
