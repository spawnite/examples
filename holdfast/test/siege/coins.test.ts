// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    addStatModifier,
    DisconnectedTrait,
    WalletTrait,
} from "@spawnite/engine";
import {
    measureCrowdFactor,
    shareCoins,
    spendCoins,
} from "../../src/siege/coins";
import { WardenStat } from "../../src/siege/stats";
import {
    CoinBurstsTrait,
    LedgerTrait,
    WardenTrait,
} from "../../src/siege/traits";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./room";

//  Every warden earns every coin, each drop over the crowd factor, and each
//  spends her own.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** The whole coins in each warden's wallet. */
function readWallets(...wardens: Parameters<typeof spendCoins>[0][]) {
    return wardens.map((warden) => warden.get(WalletTrait)?.coins ?? 0);
}

it("divides a drop by 1 alone and 0.6 more for each warden past the first", () => {
    expect([1, 2, 3, 4].map(measureCrowdFactor)).toEqual([1, 1.6, 2.2, 2.8]);
});

it("pays every warden her share of each drop, carrying what falls short of a whole coin to the next", async () => {
    siege = await openSiege();
    const wardens = ["Ada", "Bo", "Cy"].map((name, index) =>
        joinWarden(siege!, { name, position: onField(index * 3) }),
    );

    //  A brute's six coins over three wardens: 2.73 each.
    shareCoins(siege.world, { position: onField(0, -6), value: 6 });
    const first = readWallets(...wardens);
    shareCoins(siege.world, { position: onField(0, -6), value: 6 });

    expect(first).toEqual([2, 2, 2]);
    expect(readWallets(...wardens)).toEqual([5, 5, 5]);
    expect(wardens.map((warden) => warden.get(LedgerTrait)?.earned)).toEqual([
        5, 5, 5,
    ]);
});

it("pays a downed warden and one whose player dropped their share as well", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-4) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(4) });
    siege.step(1 / 60);
    ada.set(WardenTrait, { health: 0 });
    bo.add(DisconnectedTrait);

    shareCoins(siege.world, { position: onField(0, -6), value: 16 });

    expect(readWallets(ada, bo)).toEqual([10, 10]);
});

it("pays a warden who joins late from her arrival on, at the crowd the room holds then", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-4) });
    shareCoins(siege.world, { position: onField(0, -6), value: 8 });
    const bo = joinWarden(siege, { name: "Bo", position: onField(4) });

    shareCoins(siege.world, { position: onField(0, -6), value: 8 });

    expect(readWallets(ada, bo)).toEqual([13, 5]);
});

it("raises her own share alone by her coin value", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-4) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(4) });
    siege.step(1 / 60);
    addStatModifier(ada, WardenStat.CoinValue, {
        source: "card:midas-touch",
        percent: 0.5,
    });

    shareCoins(siege.world, { position: onField(0, -6), value: 16 });

    expect(readWallets(ada, bo)).toEqual([15, 10]);
});

it("flies each whole share from where the monster fell to its warden, and none where a share makes no whole coin", async () => {
    siege = await openSiege();
    const wardens = ["Ada", "Bo", "Cy", "Di"].map((name, index) =>
        joinWarden(siege!, { name, position: onField(index * 3) }),
    );
    siege.step(1 / 60);
    const [ada] = wardens;
    ada.set(WardenTrait, { coinRemainder: 0.9 });

    //  A husk's one coin over four wardens: 0.36 each, a whole one for Ada.
    shareCoins(siege.world, { position: onField(2, -6), value: 1 });

    const siegeEntity = siege.world.queryFirst(CoinBurstsTrait);
    expect(siegeEntity?.get(CoinBurstsTrait)?.bursts).toEqual([
        { to: ada, x: 2, y: 0, z: 3, coins: 1 },
    ]);
});

it("spends from her own wallet alone, and refuses a price her wallet cannot meet", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-4) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(4) });
    shareCoins(siege.world, { position: onField(0, -6), value: 32 });

    const spent = [spendCoins(ada, 15), spendCoins(ada, 6)];

    expect(spent).toEqual([true, false]);
    expect(readWallets(ada, bo)).toEqual([5, 20]);
    expect(ada.get(LedgerTrait)?.spent).toBe(15);
});
