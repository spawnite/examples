import { defineSave } from "@spawnite/engine";
import { z } from "@spawnite/schema";
import { bankCoins, readBank } from "./bank";
import { RideId, RiderId } from "./ride/riders";
import { speedSteps } from "./ride/speed";
import { newProgress, readProgress, writeProgress } from "./shop";

/** What the player's save keeps: the engine's finished tracks, and on the
 *  world, since sled has no hero, the coins banked and what they bought:
 *  the Speed step, the looks owned and the looks equipped. */
export const save = defineSave({
    include: ["levels"],
    scope: "world",
    version: 2,
    schema: z.object({
        coins: z.int().check(z.nonnegative()),
        step: z.int().check(z.nonnegative(), z.lte(speedSteps)),
        riders: z.array(z.enum(RiderId)),
        rides: z.array(z.enum(RideId)),
        rider: z.enum(RiderId),
        ride: z.enum(RideId),
    }),
    read: ({ world }) => ({ coins: readBank(world), ...readProgress(world) }),
    restore: ({ world }, { coins, ...progress }) => {
        bankCoins(world, coins);
        writeProgress(world, progress);
    },
    //  A save from before the shop bought nothing yet.
    migrations: { 2: (saved) => ({ ...(saved as object), ...newProgress }) },
});
