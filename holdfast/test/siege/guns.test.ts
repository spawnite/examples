// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    dealDamage,
    requireAuthority,
    fixedStepSeconds,
    HeldWeaponsTrait,
    readWeaponNumber,
    WeaponNumber,
} from "@spawnite/engine";
import { CardId, cards, offerCards, pickCard } from "../../src/siege/cards";
import { Element } from "../../src/siege/elements";
import {
    GunId,
    gunList,
    guns,
    holdGun,
    keepTier,
    readRicochets,
    topTier,
} from "../../src/siege/guns";
import { lanceWeapon } from "../../src/siege/lance";
import {
    MonsterKind,
    StrikeKind,
    WardenGunTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    armWarden,
    readAfflictionsOf,
    readHealth,
    readStrikes,
    standMonster,
} from "./elements";
import { weakSpotMultiplier } from "../../src/siege/weakSpots";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./room";

//  The guns of the fire's rack: what each fires at each tier, what a warden
//  holds, and that every gun lays her element at the same strength a
//  second.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

async function openWithWarden() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });
    siege.step(fixedStepSeconds);
    return { game: siege, ada };
}

it("lays her element through every gun at the same strength a second, a pellet its share of the pull, and a tier that fires faster lays more", async () => {
    const { game, ada } = await openWithWarden();
    armWarden(ada, Element.Frost);
    const chills: number[] = [];
    const expected: number[] = [];
    let place = -24;
    for (const gun of gunList)
        for (let tier = 0; tier <= topTier; tier++) {
            holdGun(ada, gun, tier);
            const { settings } = guns[gun];
            const pulls = readWeaponNumber(
                settings,
                ada,
                WeaponNumber.ShotsPerSecond,
            );
            const pellets = readWeaponNumber(
                settings,
                ada,
                WeaponNumber.Pellets,
            );
            const colossus = standMonster(game.world, {
                kind: MonsterKind.Colossus,
                x: (place += 4),
                z: -14,
                health: 1e6,
            });
            //  A second of her pulls, each pellet a hit, all on the one
            //  monster.
            for (let pull = 0; pull < pulls; pull++)
                for (let pellet = 0; pellet < pellets; pellet++)
                    dealDamage(requireAuthority(game.world), colossus, {
                        amount: 0,
                        source: ada,
                        weapon: gun,
                        data: settings.data ?? null,
                    });
            game.step(fixedStepSeconds);
            chills.push(readAfflictionsOf(colossus).chill);
            //  Its pulls in a second over its base rate's: more where a
            //  tier fires faster.
            expected.push(Math.ceil(pulls) / settings.shotsPerSecond);
        }

    expect(chills[0]).toBeGreaterThan(0);
    chills.forEach((chill, index) =>
        expect(chill).toBeCloseTo(chills[0] * expected[index], 6),
    );
});

it("fires the scattergun as a cone of five pellets and the rail through five monsters, one pull a second each", async () => {
    const { ada } = await openWithWarden();
    const read = (gun: GunId) => {
        holdGun(ada, gun, 0);
        const { settings } = guns[gun];
        return [
            WeaponNumber.ShotsPerSecond,
            WeaponNumber.Pellets,
            WeaponNumber.Pierce,
        ].map((number) => readWeaponNumber(settings, ada, number));
    };

    expect(read(GunId.Blaster)).toEqual([6, 1, 0]);
    expect(read(GunId.Scattergun)).toEqual([1, 5, 0]);
    expect(read(GunId.Rail)).toEqual([1, 1, 4]);
});

it("adds each tier's perk to the gun in her hand, and takes the last gun's off as she swaps", async () => {
    const { ada } = await openWithWarden();
    const pellets = (gun: GunId) =>
        readWeaponNumber(guns[gun].settings, ada, WeaponNumber.Pellets);

    holdGun(ada, GunId.Scattergun, 1);
    const buckshot = pellets(GunId.Scattergun);
    holdGun(ada, GunId.Rail, 3);
    const deadeye = pellets(GunId.Rail);
    holdGun(ada, GunId.Blaster, 2);

    expect(buckshot).toBe(7);
    expect(deadeye).toBe(1);
    expect(pellets(GunId.Blaster)).toBe(2);
    expect(ada.get(WardenGunTrait)).toEqual({
        gun: GunId.Blaster,
        tier: 2,
        bought: 0,
    });
});

it("keeps her tier less one on a new gun, and none below the first", () => {
    expect([3, 2, 1, 0].map(keepTier)).toEqual([2, 1, 0, 0]);
});

it("hands her the gun she holds, and the lance beside it once she takes its card", async () => {
    const { game, ada } = await openWithWarden();
    const joined = ada.get(HeldWeaponsTrait);

    holdGun(ada, GunId.Rail, 0);
    ada.set(WardenTrait, { cards: [CardId.StormLance] });
    game.step(fixedStepSeconds);

    expect(joined).toEqual([GunId.Blaster]);
    expect(ada.get(HeldWeaponsTrait)).toEqual([GunId.Rail, lanceWeapon]);
});

it("bounces a scattergun pellet on to the monster nearest the one it hit from the second tier, twice at the third, each at half the damage before", async () => {
    const { game, ada } = await openWithWarden();
    const hit = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 0,
        health: 500,
    });
    const near = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 3,
        health: 500,
    });
    const next = standMonster(game.world, {
        kind: MonsterKind.Brute,
        x: 6,
        health: 500,
    });
    const shoot = () => {
        dealDamage(requireAuthority(game.world), hit, {
            amount: 20,
            source: ada,
            weapon: GunId.Scattergun,
            data: guns[GunId.Scattergun].settings.data ?? null,
        });
        game.step(fixedStepSeconds);
    };

    holdGun(ada, GunId.Scattergun, 1);
    shoot();
    const once = [readHealth(near), readHealth(next)];
    holdGun(ada, GunId.Scattergun, 3);
    shoot();

    expect(
        [1, 2, 3].map((tier) => readRicochets(GunId.Scattergun, tier)),
    ).toEqual([0, 1, 2]);
    expect(once).toEqual([500, 500]);
    expect([readHealth(near), readHealth(next)]).toEqual([490, 495]);
    expect(readStrikes(game.world).map(({ kind }) => kind)).toContain(
        StrikeKind.Ricochet,
    );
});

it("makes each weak spot the rail's line strikes take triple at the top tier and double below it, and no other gun more than double", async () => {
    const { ada } = await openWithWarden();
    const zoneDamage = (gun: GunId, tier: number) => {
        holdGun(ada, gun, tier);
        return (
            weakSpotMultiplier *
            readWeaponNumber(guns[gun].settings, ada, WeaponNumber.ZoneDamage)
        );
    };

    expect([0, 1, 2, 3].map((tier) => zoneDamage(GunId.Rail, tier))).toEqual([
        2, 2, 2, 3,
    ]);
    expect(
        [GunId.Blaster, GunId.Scattergun].map((gun) => zoneDamage(gun, 3)),
    ).toEqual([2, 2]);
});

it("lays her Marksman card on the rail's Deadeye tier, and a new gun leaves Deadeye behind", async () => {
    const { ada } = await openWithWarden();
    ada.set(WardenTrait, { offer: offerCards([CardId.Marksman]) });
    pickCard(ada, 0);
    const share = cards[CardId.Marksman].modifiers[0]?.modifier.percent ?? 0;
    const read = () =>
        readWeaponNumber(
            guns[GunId.Rail].settings,
            ada,
            WeaponNumber.ZoneDamage,
        );

    holdGun(ada, GunId.Rail, 3);
    const deadeye = read();
    holdGun(ada, GunId.Blaster, keepTier(3));

    expect(deadeye).toBeCloseTo(1.5 * (1 + share));
    expect(read()).toBeCloseTo(1 + share);
});
