// @vitest-environment node
import type { Entity, Trait } from "koota";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import { Vector3 } from "three";
import {
    fixedStepSeconds,
    heldRule,
    teleportActor,
    TransformTrait,
    WalletTrait,
    type ShotCheck,
} from "@spawnite/engine";
import {
    buyCard,
    CardId,
    isElementPick,
    offerCards,
    pickCard,
} from "../../src/siege/cards";
import { GunId, guns, upgradePrices } from "../../src/siege/guns";
import {
    buyFire,
    buyGun,
    buyReroll,
    isRackOpen,
    rackStands,
    readCardPrice,
    readRerollPrice,
    upgradeGun,
} from "../../src/siege/shop";
import { siegePlugin } from "../../src/siege/siege.plugin";
import {
    FireTrait,
    LedgerTrait,
    Rarity,
    SiegeStateTrait,
    WardenGunTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    deliverSignal,
    joinWarden,
    onField,
    openSiege,
    type OpenedSiege,
    setPhase,
} from "./room";

//  What coins buy: a reroll on the card screen, and at the fire a gun from
//  its rack, a tier of the gun in hand, or a bigger fire. The room checks
//  where she stands, the phase and her wallet.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Sets where the run stands, as the siege would have it. */
function setRun(
    game: OpenedSiege,
    run: { phase: Trait; wave: number; endless?: boolean },
) {
    const { phase, ...rest } = run;
    game.world
        .queryFirst(SiegeStateTrait)
        ?.set(SiegeStateTrait, { endless: false, ...rest });
    setPhase(game.world, phase);
}

/** Stands `warden` at the point `x`, `z`, on her feet. */
function standAt(game: OpenedSiege, warden: Entity, x: number, z: number) {
    warden.get(TransformTrait)?.copy(new Vector3(x, 0, z));
    teleportActor(game.world, warden);
}

/** Stands `warden` in front of the stand that sells `gun`. */
function standAtRack(game: OpenedSiege, warden: Entity, gun: GunId) {
    const stand = rackStands.find((each) => each.gun === gun);
    if (!stand) throw new Error(`No stand sells ${gun}.`);
    standAt(game, warden, stand.x * 0.85, stand.z * 0.85);
}

/** Opens a room with Ada in it, her wallet holding `coins`, in the
 *  breather of wave 5. */
async function openShop(coins: number) {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });
    siege.step(fixedStepSeconds);
    ada.set(WalletTrait, { coins });
    setRun(siege, { phase: PhaseMachine.is.breather, wave: 5 });
    return { game: siege, ada };
}

it("opens the rack from the first breather, while a run is on", () => {
    const phases = ["breather", "fight", "dawn", "over", "waiting"] as const;

    expect(phases.map(isRackOpen)).toEqual([true, true, true, false, false]);
});

it("prices each purchase against 40 coins, one warden's average wave: a card by its rarity, a reroll dearer by a quarter each time, a gun at two waves and a first tier at one", () => {
    expect([0, 1, 2, 3].map(readRerollPrice)).toEqual([10, 20, 30, 40]);
    expect(
        [Rarity.Common, Rarity.Rare, Rarity.Epic].map(readCardPrice),
    ).toEqual([20, 40, 80]);
    expect(
        [GunId.Blaster, GunId.Scattergun, GunId.Rail].map(
            (gun) => guns[gun].price,
        ),
    ).toEqual([20, 80, 80]);
    expect(upgradePrices).toEqual([40, 80, 140]);
});

it("sells her a gun at its stand for its price, and refuses one far from it, with no run on, or past her wallet", async () => {
    const { game, ada } = await openShop(150);

    standAt(game, ada, 0, 9);
    const far = buyGun(game.world, ada, GunId.Rail);
    standAtRack(game, ada, GunId.Rail);
    setRun(game, { phase: PhaseMachine.is.waiting, wave: 0 });
    const shut = buyGun(game.world, ada, GunId.Rail);
    setRun(game, { phase: PhaseMachine.is.breather, wave: 1 });
    const bought = buyGun(game.world, ada, GunId.Rail);
    standAtRack(game, ada, GunId.Scattergun);
    const short = buyGun(game.world, ada, GunId.Scattergun);

    expect([far, shut, bought, short]).toEqual([false, false, true, false]);
    expect(ada.get(WardenGunTrait)).toEqual({
        gun: GunId.Rail,
        tier: 0,
        bought: 1,
    });
    expect(ada.get(WalletTrait)?.coins).toBe(70);
    expect(ada.get(LedgerTrait)).toMatchObject({ spent: 80, guns: 1 });
});

it("raises the gun in her hand a tier at its stand, to the third and no further, and keeps her tier less one on a new gun", async () => {
    const { game, ada } = await openShop(1000);
    standAtRack(game, ada, GunId.Blaster);

    const raised = [1, 2, 3, 4].map(() => upgradeGun(game.world, ada));
    standAtRack(game, ada, GunId.Scattergun);
    buyGun(game.world, ada, GunId.Scattergun);

    expect(raised).toEqual([true, true, true, false]);
    expect(ada.get(WardenGunTrait)).toEqual({
        gun: GunId.Scattergun,
        tier: 2,
        bought: 4,
    });
    expect(ada.get(WalletTrait)?.coins).toBe(1000 - 40 - 80 - 140 - 80);
    expect(ada.get(LedgerTrait)).toMatchObject({ upgrades: 3, guns: 1 });
});

it("takes her word for a purchase from her page's message, as the room hands it to the step", async () => {
    const { game, ada } = await openShop(300);
    standAtRack(game, ada, GunId.Scattergun);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.buyGun,
        payload: { gun: GunId.Scattergun },
    });
    game.step(fixedStepSeconds);
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.upgrade,
    });
    game.step(fixedStepSeconds);

    expect(ada.get(WardenGunTrait)).toEqual({
        gun: GunId.Scattergun,
        tier: 1,
        bought: 2,
    });
    expect(ada.get(WalletTrait)?.coins).toBe(300 - 80 - 40);
});

it("refuses a shot from any gun but the one she holds once she buys another", async () => {
    const { game, ada } = await openShop(200);
    standAtRack(game, ada, GunId.Rail);
    buyGun(game.world, ada, GunId.Rail);
    game.step(fixedStepSeconds);
    const check = (weapon: string) =>
        heldRule({
            world: game.world,
            shooter: ada,
            claim: { weapon },
        } as ShotCheck);

    expect(check(GunId.Blaster)).toBe(
        'The shooter does not hold the weapon "blaster".',
    );
    expect(check(GunId.Scattergun)).toBeDefined();
    expect(check(GunId.Rail)).toBeUndefined();
});

it("rerolls her offer for a price that rises each time, dealing three other cards, and never her element's pick", async () => {
    const { game, ada } = await openShop(100);
    ada.set(WardenTrait, {
        offer: offerCards([
            CardId.HeavyRounds,
            CardId.HairTrigger,
            CardId.FleetFoot,
        ]),
        taken: "",
        rerolls: 0,
    });

    const rerolled = [1, 2, 3].map(() => buyReroll(game.world, ada));
    const offer = ada.get(WardenTrait)?.offer.map(({ card }) => card);
    ada.set(WardenTrait, {
        offer: offerCards([CardId.Storm, CardId.Ember, CardId.Frost]),
        rerolls: 0,
    });
    const element = buyReroll(game.world, ada);

    expect(rerolled).toEqual([true, true, true]);
    expect(ada.get(WalletTrait)?.coins).toBe(100 - 10 - 20 - 30);
    expect(offer).toHaveLength(3);
    expect(offer?.some((card) => isElementPick(card))).toBe(false);
    expect(element).toBe(false);
    expect(ada.get(LedgerTrait)?.rerolls).toBe(3);
});

it("deals three other cards on a reroll than the ones she was offered", async () => {
    const { game, ada } = await openShop(40);
    const first = [CardId.HeavyRounds, CardId.HairTrigger, CardId.FleetFoot];
    ada.set(WardenTrait, { offer: offerCards(first), taken: "" });

    buyReroll(game.world, ada);

    const offer = ada.get(WardenTrait)?.offer.map(({ card }) => card) ?? [];
    expect(offer.filter((card) => first.includes(card as CardId))).toEqual([]);
});

it("rerolls after her free card too, into three cards she buys, and refuses a reroll outside a breather", async () => {
    const { game, ada } = await openShop(40);
    ada.set(WardenTrait, {
        offer: offerCards([
            CardId.HeavyRounds,
            CardId.HairTrigger,
            CardId.FleetFoot,
        ]),
        taken: CardId.HeavyRounds,
        bought: [CardId.HairTrigger],
    });
    const afterTaking = buyReroll(game.world, ada);
    const rerolled = ada.get(WardenTrait);
    setRun(game, { phase: PhaseMachine.is.fight, wave: 6 });
    const fighting = buyReroll(game.world, ada);

    expect([afterTaking, fighting]).toEqual([true, false]);
    expect(rerolled?.taken).toBe(CardId.HeavyRounds);
    expect(rerolled?.bought).toEqual([]);
    expect(ada.get(WalletTrait)?.coins).toBe(40 - 10);
});

it("sells any other card of the offer at its rarity's price once her free card is taken, and none before it", async () => {
    const { ada } = await openShop(100);
    ada.set(WardenTrait, {
        offer: [
            { card: CardId.HeavyRounds, rarity: Rarity.Common },
            { card: CardId.HairTrigger, rarity: Rarity.Rare },
            { card: CardId.FleetFoot, rarity: Rarity.Common },
        ],
        taken: "",
        cards: [],
    });

    const early = buyCard(ada, 1);
    pickCard(ada, 0);
    const again = buyCard(ada, 0);
    const rare = buyCard(ada, 1);
    const twice = buyCard(ada, 1);
    const common = buyCard(ada, 2);

    const broke = buyCard(ada, 2);

    expect([early, again, rare, twice, common, broke]).toEqual([
        false,
        false,
        true,
        false,
        true,
        false,
    ]);
    expect(ada.get(WalletTrait)?.coins).toBe(100 - 40 - 20);
    expect(ada.get(WardenTrait)?.cards).toEqual([
        CardId.HeavyRounds,
        CardId.HairTrigger,
        CardId.FleetFoot,
    ]);
    expect(ada.get(WardenTrait)?.bought).toEqual([
        CardId.HairTrigger,
        CardId.FleetFoot,
    ]);
    expect(ada.get(LedgerTrait)?.cards).toBe(2);
});

it("takes her free card for her as the breather closes, and spends nothing", async () => {
    const { game, ada } = await openShop(100);
    ada.set(WardenTrait, {
        offer: offerCards([
            CardId.HeavyRounds,
            CardId.HairTrigger,
            CardId.FleetFoot,
        ]),
        taken: "",
    });
    setPhase(game.world, PhaseMachine.is.breather, 0.01);

    game.step(fixedStepSeconds * 2);

    expect(ada.get(WardenTrait)?.cards).toHaveLength(1);
    expect(ada.get(WalletTrait)?.coins).toBe(100);
});

it("feeds the fire from beside it while a run is on, and refuses from across the circle", async () => {
    const { game, ada } = await openShop(30);

    standAt(game, ada, 0, 12);
    const far = buyFire(game.world, ada);
    standAt(game, ada, 0, 2.8);
    const fed = buyFire(game.world, ada);
    setRun(game, { phase: PhaseMachine.is.over, wave: 6 });
    const over = buyFire(game.world, ada);

    expect([far, fed, over]).toEqual([false, true, false]);
    expect(game.world.queryFirst(FireTrait)?.get(FireTrait)?.fuel).toBe(10);
    expect(ada.get(LedgerTrait)?.fed).toBe(10);
});
