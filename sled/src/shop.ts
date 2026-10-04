import { trait, type World } from "koota";
import { useTrait, useWorld } from "koota/react";
import { save } from "@spawnite/engine";
import { bankCoins, readBank } from "./bank";
import { lookPrices, RideId, RiderId, type Look } from "./ride/riders";
import { readSpeedStepCost, speedSteps } from "./ride/speed";

//  What the banked coins have bought, on the world beside the bank, which
//  the player's save keeps: the Speed step, the animals and the rides owned,
//  and the pair the rider wears. The lobby buys and equips through the
//  actions below; the run's rider spawns from it.

/** The player's Speed step, looks owned and looks equipped. */
export interface Progress {
    /** The Speed step bought, 0 to `speedSteps`. */
    step: number;
    riders: RiderId[];
    rides: RideId[];
    /** The animal riding, one of `riders`. */
    rider: RiderId;
    /** The ride under it, one of `rides`. */
    ride: RideId;
}

/** A new player's: no Speed step, and the free penguin on the free
 *  toboggan. */
export const newProgress: Progress = {
    step: 0,
    riders: [RiderId.Penguin],
    rides: [RideId.Toboggan],
    rider: RiderId.Penguin,
    ride: RideId.Toboggan,
};

//  Replaced whole on each change, never written into.
const ProgressTrait = trait(() => newProgress);

/** What the coins have bought so far: a new player's before any. */
export function readProgress(world: World): Progress {
    return world.get(ProgressTrait) ?? newProgress;
}

/** What the coins have bought, for a component: it redraws as it
 *  changes. */
export function useProgress(): Progress {
    return useTrait(useWorld(), ProgressTrait) ?? newProgress;
}

/** Sets what the coins have bought. */
export function writeProgress(world: World, progress: Progress) {
    if (world.has(ProgressTrait)) world.set(ProgressTrait, progress);
    else world.add(ProgressTrait(progress));
}

/** Why the shop refused an action, which changed nothing. */
export enum Refusal {
    /** The bank holds fewer coins than the price. */
    TooFewCoins = "too-few-coins",
    /** The Speed step is the last one. */
    TopStep = "top-step",
    /** The look is owned already: equip it instead. */
    Owned = "owned",
    /** The look is not owned yet: buy it first. */
    NotOwned = "not-owned",
}

/** What a shop action did: done, or refused, and why. */
export type ShopResult = { ok: true } | { ok: false; reason: Refusal };

function refuse(reason: Refusal): ShopResult {
    return { ok: false, reason };
}

/** Changes the progress and asks for the save, as a run's end does: a
 *  purchase is a moment to keep. */
function saveProgress(world: World, edit: Partial<Progress>): ShopResult {
    writeProgress(world, { ...readProgress(world), ...edit });
    save();
    return { ok: true };
}

/** Takes `price` from the bank: false, and nothing taken, where it holds
 *  less. */
function pay(world: World, price: number) {
    const coins = readBank(world);
    if (coins < price) return false;
    bankCoins(world, coins - price);
    return true;
}

function isRider(look: Look): look is RiderId {
    return Object.values<string>(RiderId).includes(look);
}

/** Buys the next Speed step for its tier's price from the bank. */
export function buySpeedStep(world: World): ShopResult {
    const { step } = readProgress(world);
    if (step >= speedSteps) return refuse(Refusal.TopStep);
    if (!pay(world, readSpeedStepCost(step + 1)))
        return refuse(Refusal.TooFewCoins);
    return saveProgress(world, { step: step + 1 });
}

/** Buys `look` for its price from the bank, and equips it. */
export function buyLook(world: World, look: Look): ShopResult {
    const progress = readProgress(world);
    if ([...progress.riders, ...progress.rides].includes(look))
        return refuse(Refusal.Owned);
    if (!pay(world, lookPrices[look])) return refuse(Refusal.TooFewCoins);
    return saveProgress(
        world,
        isRider(look)
            ? { riders: [...progress.riders, look], rider: look }
            : { rides: [...progress.rides, look], ride: look },
    );
}

/** Equips `look`, an animal or a ride the player owns. */
export function equipLook(world: World, look: Look): ShopResult {
    const progress = readProgress(world);
    if (isRider(look))
        return progress.riders.includes(look)
            ? saveProgress(world, { rider: look })
            : refuse(Refusal.NotOwned);
    return progress.rides.includes(look)
        ? saveProgress(world, { ride: look })
        : refuse(Refusal.NotOwned);
}
