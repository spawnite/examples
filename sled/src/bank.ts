import { trait, type World } from "koota";
import { useTrait, useWorld } from "koota/react";

//  The coins every run has banked, on the world, which the player's save
//  keeps. A run's own coins are the rider's wallet, which starts empty each
//  run; the bank outlives it, and a scene's reload keeps the world.

const BankTrait = trait({ coins: 0 });

/** The coins banked so far: none before the first run ends. */
export function readBank(world: World): number {
    return world.get(BankTrait)?.coins ?? 0;
}

/** Sets the coins banked. */
export function bankCoins(world: World, coins: number) {
    if (world.has(BankTrait)) world.set(BankTrait, { coins });
    else world.add(BankTrait({ coins }));
}

/** The coins banked, for a component: it redraws as they change. */
export function useBank(): number {
    return useTrait(useWorld(), BankTrait)?.coins ?? 0;
}
