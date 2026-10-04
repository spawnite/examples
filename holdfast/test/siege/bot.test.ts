// @vitest-environment node
import { createWorld, type Entity, type World } from "koota";
import { Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import {
    HeroTrait,
    TransformTrait,
    WalletTrait,
    writeStateTags,
    type WirePayload,
} from "@spawnite/engine";
import {
    bot,
    lingerSeconds,
    readBoltDangers,
    readSlamDangers,
} from "../../src/siege/bot";
import { CardId, offerCards } from "../../src/siege/cards";
import { GunId } from "../../src/siege/guns";
import { LifeTrait, ReadinessTrait } from "../../src/siege/life";
import { rackStands } from "../../src/siege/shop";
import { siegePlugin } from "../../src/siege/siege.plugin";
import {
    Rarity,
    BoltTrait,
    SiegeTrait,
    SlamTrait,
    WardenGunTrait,
    WardenTrait,
} from "../../src/siege/traits";
import type { Phase } from "../../src/siege/phase";
import { breatherSeconds } from "../../src/siege/waves";
import { showPhase } from "../hud/phase";

//  Holdfast's room bot: what it says as a player's page says it, from the
//  world the stream brings her.

const worlds: World[] = [];

/** A message the bot sends: its name, and its payload, none where left
 *  out, as the room takes it. */
interface Sent {
    name: string;
    payload: WirePayload;
}

const { messages } = siegePlugin;
const readySignal: Sent = { name: messages.ready.name, payload: {} };
const rerollSignal: Sent = { name: messages.reroll.name, payload: {} };
const upgradeSignal: Sent = { name: messages.upgrade.name, payload: {} };
const feedSignal: Sent = { name: messages.feed.name, payload: {} };
const pickSignals: Sent[] = [0, 1, 2].map((slot) => ({
    name: messages.pick.name,
    payload: { slot },
}));
const buyCardSignals: Sent[] = [0, 1, 2].map((slot) => ({
    name: messages.buyCard.name,
    payload: { slot },
}));
/** The word that buys `gun` at its stand. */
function buySignal(gun: GunId): Sent {
    return { name: messages.buyGun.name, payload: { gun } };
}

afterEach(() => {
    for (const world of worlds.splice(0)) world.destroy();
});

/** What a test sets of the bot's warden: her record, and where the run
 *  stands, her coins and her gun. */
type Setting = Partial<{
    ready: boolean;
    offer: ReturnType<typeof offerCards>;
    taken: string;
    catchUp: number;
    hue: number;
    rerolls: number;
    bought: string[];
}> & {
    wave?: number;
    secondsLeft?: number;
    coins?: number;
    gun?: { gun: GunId; tier: number };
};

/** A siege in `phase` and a warden as `setting` sets her, what the bot
 *  sends on one move there, and where it walks. */
function playTurn(
    phase: Phase,
    {
        wave = 1,
        secondsLeft = 0,
        coins,
        gun,
        ready = false,
        ...warden
    }: Setting,
) {
    const world = createWorld();
    worlds.push(world);
    showPhase(world.spawn(SiegeTrait({ wave, secondsLeft })), phase);
    const hero: Entity = world.spawn(
        WardenTrait,
        ReadinessTrait({ state: ready ? { ready: "key" } : "unready" }),
    );
    writeStateTags(hero, ReadinessTrait);
    hero.set(WardenTrait, warden);
    if (coins !== undefined) hero.add(WalletTrait({ coins }));
    if (gun) hero.add(WardenGunTrait(gun));
    const sent: Sent[] = [];
    const send = (name: string, payload: WirePayload = {}) =>
        sent.push({ name, payload });
    const turn = { world, hero, send, moveSeconds: 1 / 30 };
    bot.play?.(turn);
    return { sent, destination: bot.destination?.(turn) };
}

/** What the bot sends on one move with `setting`. */
function playOnce(phase: Phase, setting: Setting) {
    return playTurn(phase, setting).sent;
}

/** The point in front of `gun`'s stand, a metre toward the fire. */
function readFront(gun: GunId) {
    const stand = rackStands.find((each) => each.gun === gun);
    if (!stand) throw new Error(`No stand sells ${gun}.`);
    const metres = Math.hypot(stand.x, stand.z);
    return [stand.x, stand.z].map((axis) => (axis * (metres - 1)) / metres);
}

/** Three cards on offer, as a breather deals them. */
const dealt = offerCards(["a", "b", "c"]);

it("says she is ready while the siege waits for her or has ended, and not once she is", () => {
    expect(playOnce("waiting", { ready: false })).toEqual([readySignal]);
    expect(playOnce("over", { ready: false })).toEqual([readySignal]);
    expect(playOnce("dawn", { ready: false })).toEqual([readySignal]);
    expect(playOnce("waiting", { ready: true })).toEqual([]);
    expect(playOnce("fight", { ready: false })).toEqual([]);
});

it("takes the first card of a breather's offer until she has taken one", () => {
    expect(playOnce("breather", { offer: dealt, taken: "" })).toEqual([
        pickSignals[0],
    ]);
});

it("says she is ready in a breather once she has taken her card, and not again once she is", () => {
    expect(playOnce("breather", { offer: dealt, taken: "a" })).toEqual([
        readySignal,
    ]);
    expect(
        playOnce("breather", {
            offer: dealt,
            taken: "a",
            ready: true,
        }),
    ).toEqual([]);
});

it("takes the first card of each offer a late joiner catches up with, mid-wave too", () => {
    expect(
        playOnce("fight", {
            offer: dealt,
            taken: "",
            catchUp: 2,
        }),
    ).toEqual([pickSignals[0]]);
    expect(playOnce("fight", { offer: dealt, taken: "" })).toEqual([]);
});

it("picks the element its colour names as the wardens gather, so a room of bots holds each", () => {
    const elements = offerCards([CardId.Storm, CardId.Ember, CardId.Frost]);

    const picks = [0, 1, 2].map((hue) =>
        playOnce("waiting", {
            offer: elements,
            taken: "",
            ready: true,
            hue,
        }),
    );

    expect(picks).toEqual([
        [pickSignals[0]],
        [pickSignals[1]],
        [pickSignals[2]],
    ]);
});

it("takes an element card over the first of an offer", () => {
    const offer = offerCards([
        CardId.HeavyRounds,
        CardId.FleetFoot,
        CardId.StormSurge,
    ]);

    expect(playOnce("breather", { offer, taken: "", ready: true })).toEqual([
        pickSignals[2],
    ]);
});

it("walks to its colour's gun once it can pay for it and buys it, before it says it is ready", () => {
    const { sent, destination } = playTurn("breather", {
        wave: 2,
        coins: 90,
        hue: 0,
        offer: dealt,
        taken: "a",
    });

    expect(sent).toEqual([buySignal(GunId.Scattergun)]);
    const [x, z] = readFront(GunId.Scattergun);
    expect(destination?.[0]).toBeCloseTo(x, 5);
    expect(destination?.[2]).toBeCloseTo(z, 5);
});

it("raises the gun it holds a tier at its stand once it can pay for one", () => {
    const { sent, destination } = playTurn("breather", {
        wave: 6,
        coins: 50,
        hue: 1,
        offer: dealt,
        taken: "a",
        gun: { gun: GunId.Rail, tier: 0 },
    });

    expect(sent).toEqual([upgradeSignal]);
    const [x, z] = readFront(GunId.Rail);
    expect(destination?.[0]).toBeCloseTo(x, 5);
    expect(destination?.[2]).toBeCloseTo(z, 5);
});

it("feeds the fire what its wallet holds past the gun it saves for, beside the fire", () => {
    const { sent, destination } = playTurn("breather", {
        wave: 3,
        coins: 30,
        hue: 0,
        offer: dealt,
        taken: "a",
        bought: ["b"],
        gun: { gun: GunId.Scattergun, tier: 3 },
    });

    expect(sent).toEqual([feedSignal]);
    expect(
        Math.hypot(destination?.[0] ?? 9, destination?.[2] ?? 9),
    ).toBeLessThan(3);
});

it("rerolls an offer with nothing to raise once, when it has the coins", () => {
    expect(
        playOnce("breather", { offer: dealt, taken: "", coins: 15 }),
    ).toEqual([rerollSignal]);
    expect(
        playOnce("breather", {
            offer: dealt,
            taken: "",
            coins: 15,
            rerolls: 1,
        }),
    ).toEqual([pickSignals[0]]);
});

it("runs no errand during a wave, and fights", () => {
    const { sent, destination } = playTurn("fight", {
        wave: 7,
        coins: 400,
    });

    expect(sent).toEqual([]);
    expect(destination).toBeUndefined();
});

it("buys the element card of an offer over a cheaper stat card, which fills her line", () => {
    const offer = [
        { card: CardId.HeavyRounds, rarity: Rarity.Common },
        { card: CardId.FleetFoot, rarity: Rarity.Common },
        { card: CardId.FrostSurge, rarity: Rarity.Rare },
    ];

    expect(
        playOnce("breather", {
            wave: 3,
            coins: 60,
            hue: 0,
            offer,
            taken: CardId.HeavyRounds,
            gun: { gun: GunId.Scattergun, tier: 3 },
        }),
    ).toEqual([buyCardSignals[2]]);
});

it("buys one card of the offer after its free one with what it holds past its savings, before it feeds the fire", () => {
    const setting = {
        wave: 3,
        coins: 30,
        hue: 0,
        offer: dealt,
        taken: "a",
        gun: { gun: GunId.Scattergun, tier: 3 },
    };

    expect(playOnce("breather", setting)).toEqual([buyCardSignals[1]]);
    expect(
        playOnce("breather", {
            ...setting,
            gun: { gun: GunId.Blaster, tier: 0 },
        }),
    ).not.toContainEqual(buyCardSignals[1]);
    expect(playOnce("fight", setting)).not.toContainEqual(buyCardSignals[1]);
});

it("buys the rarest card of the offer it can pay for past its savings, as a player picks the best", () => {
    const offer = [
        { card: CardId.IronHeart, rarity: Rarity.Common },
        { card: CardId.HairTrigger, rarity: Rarity.Common },
        { card: CardId.HeavyRounds, rarity: Rarity.Rare },
    ];
    const setting = {
        wave: 3,
        hue: 0,
        offer,
        taken: CardId.IronHeart,
        gun: { gun: GunId.Scattergun, tier: 3 },
    };

    expect(playOnce("breather", { ...setting, coins: 50 })).toEqual([
        buyCardSignals[2],
    ]);
    expect(playOnce("breather", { ...setting, coins: 30 })).toEqual([
        buyCardSignals[1],
    ]);
});

it("buys one card a breather early in the night and two from mid-run", () => {
    const offer = offerCards([
        CardId.IronHeart,
        CardId.HairTrigger,
        CardId.HeavyRounds,
    ]);
    const setting = {
        coins: 100,
        hue: 0,
        offer,
        taken: CardId.IronHeart,
        bought: [CardId.HairTrigger],
        gun: { gun: GunId.Scattergun, tier: 3 },
    };

    expect(playOnce("breather", { ...setting, wave: 2 })).not.toContainEqual(
        buyCardSignals[2],
    );
    expect(playOnce("breather", { ...setting, wave: 6 })).toEqual([
        buyCardSignals[2],
    ]);
    expect(
        playOnce("breather", {
            ...setting,
            wave: 6,
            bought: [CardId.HairTrigger, CardId.HeavyRounds],
        }),
    ).not.toContainEqual(buyCardSignals[0]);
});

it("buys a stat card it can pay for where the element card of the offer costs more than it holds", () => {
    const offer = [
        { card: CardId.IronHeart, rarity: Rarity.Common },
        { card: CardId.StormSurge, rarity: Rarity.Rare },
        { card: CardId.HairTrigger, rarity: Rarity.Common },
    ];

    expect(
        playOnce("breather", {
            wave: 3,
            coins: 30,
            hue: 0,
            offer,
            taken: CardId.IronHeart,
            gun: { gun: GunId.Scattergun, tier: 3 },
        }),
    ).toEqual([buyCardSignals[2]]);
});

it("lingers in a breather before she says she is ready, as a person reads the offer and heals by the fire", () => {
    const readyAt = breatherSeconds - lingerSeconds;
    const turn = (secondsLeft: number) =>
        playOnce("breather", { offer: dealt, taken: "a", secondsLeft });
    expect(turn(readyAt + 1)).toEqual([]);
    expect(turn(readyAt)).toEqual([readySignal]);
});

/** A wave's world with her standing at the fire and two teammates down,
 *  the nearer at `near`, and where she walks. */
function walkToDowned(phase: Phase, near: [number, number]) {
    const world = createWorld();
    worlds.push(world);
    showPhase(world.spawn(SiegeTrait({ wave: 3 })), phase);
    const warden = (x: number, z: number, down: boolean) => {
        const entity = world.spawn(
            HeroTrait,
            WardenTrait,
            TransformTrait(new Vector3(x, 0, z)),
            LifeTrait({ state: down ? { down: "lying" } : "standing" }),
        );
        writeStateTags(entity, LifeTrait);
        return entity;
    };
    const hero = warden(0, 0, false);
    warden(...near, true);
    warden(9, 9, true);
    warden(1, 1, false);
    return bot.destination?.({
        world,
        hero,
        send: () => undefined,
        moveSeconds: 1 / 30,
    });
}

it("walks to the nearest downed teammate during a wave, to get her up", () => {
    expect(walkToDowned("fight", [3, -4])).toEqual([3, 0, -4]);
    //  Between waves a held wave has got her up already.
    expect(walkToDowned("breather", [3, -4])).toBeUndefined();
});

it("names the ring of each slam winding up as a danger, a margin past its reach, and none for a slam at rest", () => {
    const world = createWorld();
    worlds.push(world);
    world.spawn(SlamTrait({ winding: true, x: 4, z: -2, radius: 5.5 }));
    world.spawn(SlamTrait({ winding: false, x: -8, z: 0, radius: 5.5 }));
    const dangers = readSlamDangers(world);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].at).toEqual([4, 0, -2]);
    expect(dangers[0].radius).toBeGreaterThan(5.5);
});

it("sidesteps a bolt whose path passes her within a step, once she has seen it fly, and not one that misses or flies away", () => {
    const world = createWorld();
    worlds.push(world);
    const hero = world.spawn(
        HeroTrait,
        WardenTrait,
        TransformTrait(new Vector3()),
    );
    const turn = { world, hero, send: () => undefined, moveSeconds: 1 / 30 };
    //  One at her, one passing 4 m wide, one flying off: 7 m/s on x.
    const bolts = [
        world.spawn(BoltTrait, TransformTrait(new Vector3(-8, 1, 0.5))),
        world.spawn(BoltTrait, TransformTrait(new Vector3(-8, 1, 4))),
        world.spawn(BoltTrait, TransformTrait(new Vector3(8, 1, 0))),
    ];
    expect(readBoltDangers(turn)).toEqual([]);
    for (const bolt of bolts)
        bolt.get(TransformTrait)?.setX(
            (bolt.get(TransformTrait)?.x ?? 0) + (7 * 3) / 60,
        );
    const dangers = readBoltDangers(turn);
    expect(dangers).toHaveLength(1);
    expect(dangers[0].at[0]).toBeCloseTo(0);
    expect(dangers[0].at[2]).toBeCloseTo(0.5);
});
