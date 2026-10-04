// @vitest-environment node
import type { Entity, World } from "koota";
import { Quaternion, Ray, Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import {
    dealDamage,
    requireAuthority,
    FacingTrait,
    findDrawnTarget,
    fixedStepSeconds,
    HitZonesTrait,
    positiveY,
    readWeaponNumber,
    TransformTrait,
    WeaponNumber,
} from "@spawnite/engine";
import { blasterSettings, blasterWeapon } from "../../src/siege/blaster";
import { CardId, cards, offerCards, pickCard } from "../../src/siege/cards";
import { Element } from "../../src/siege/elements";
import { gunList, guns } from "../../src/siege/guns";
import { lanceSettings } from "../../src/siege/lance";
import { spawnMonster } from "../../src/siege/monsters";
import {
    EliteModifier,
    MonsterKind,
    WardenTrait,
} from "../../src/siege/traits";
import { planWave } from "../../src/siege/waves";
import {
    eliteSize,
    readWeakSpot,
    weakSpotMultiplier,
} from "../../src/siege/weakSpots";
import { armWarden, readAfflictionsOf, standMonster } from "./elements";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./room";

//  Each monster's weak spot, twice a gun's damage: a head for every kind
//  but the colossus, whose weak spot is its core.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

const kinds = Object.values(MonsterKind);

it.each(kinds)(
    "spawns a %s with its weak spot, twice a gun's damage",
    async (kind) => {
        siege = await openSiege();
        const monster = spawnMonster(siege.world, {
            kind,
            position: onField(0, -8),
            plan: planWave(1, 1),
        });

        const [spot] = monster.get(HitZonesTrait) ?? [];

        expect(spot?.name).toBe(
            kind === MonsterKind.Colossus ? "core" : "head",
        );
        expect(spot?.multiplier).toBe(weakSpotMultiplier);
        expect(weakSpotMultiplier).toBe(2);
    },
);

it("grows an elite's weak spot with the size it is drawn at, and a colossus the room grows", async () => {
    siege = await openSiege();
    const plan = planWave(1, 1);
    const elite = spawnMonster(siege.world, {
        kind: MonsterKind.Husk,
        position: onField(0, -8),
        plan,
        elite: EliteModifier.Swift,
    });
    const grown = spawnMonster(siege.world, {
        kind: MonsterKind.Colossus,
        position: onField(4, -8),
        plan,
        size: 1.3,
    });

    expect(elite.get(HitZonesTrait)?.[0].radius).toBeCloseTo(
        readWeakSpot(MonsterKind.Husk).radius * eliteSize,
    );
    expect(grown.get(HitZonesTrait)?.[0].at.y).toBeCloseTo(
        readWeakSpot(MonsterKind.Colossus).at.y * 1.3,
    );
});

/** The weak spot's middle where `monster` stands facing +z. */
function readSpotMiddle(monster: Entity) {
    const [spot] = monster.get(HitZonesTrait) ?? [];
    const feet = monster.get(TransformTrait) ?? new Vector3();
    const { at, to = at } = spot;
    return new Vector3(
        -(at.x + to.x) / 2,
        (at.y + to.y) / 2,
        -(at.z + to.z) / 2,
    ).add(feet);
}

/** The zone a shot from `from` at `point` strikes, where it hits. */
function strikeFrom(world: World, from: Vector3, point: Vector3) {
    const ray = new Ray(from, point.clone().sub(from).normalize());
    const { target, zone } = findDrawnTarget(world, {
        test: {
            ray,
            range: 30,
            feet: new Vector3(),
            body: { radius: 0, height: 0 },
        },
        shooter: null,
    });
    return target ? (zone?.name ?? "body") : "miss";
}

it.each(kinds)(
    "strikes a %s's weak spot from in front of it, and not its middle",
    async (kind) => {
        siege = await openSiege();
        const monster = standMonster(siege.world, { kind, z: -8 });
        //  Turned round to face the shooter, along +z.
        monster.set(FacingTrait, {
            rotation: new Quaternion().setFromAxisAngle(positiveY, Math.PI),
        });
        const spot = readSpotMiddle(monster);
        const feet = monster.get(TransformTrait)?.clone() ?? new Vector3();
        const eye = new Vector3(feet.x, spot.y, feet.z + 8);
        //  A third of its height up, level from in front.
        const middle = feet.clone().setY(feet.y + spot.y / 3);

        expect(strikeFrom(siege.world, eye, spot)).toBe(
            kind === MonsterKind.Colossus ? "core" : "head",
        );
        expect(
            strikeFrom(siege.world, middle.clone().setZ(middle.z + 8), middle),
        ).toBe("body");
    },
);

it("lays the same dose of an element through a weak spot as through the body", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });
    armWarden(ada, Element.Frost);
    const [head, body] = [-4, 4].map((x) =>
        standMonster(siege?.world as World, { kind: MonsterKind.Brute, x }),
    );

    for (const [monster, zone] of [
        [head, "head"],
        [body, null],
    ] as const)
        dealDamage(requireAuthority(siege.world), monster, {
            amount: zone ? 20 : 10,
            source: ada,
            weapon: blasterWeapon,
            zone,
            data: blasterSettings.data ?? null,
        });
    siege.step(fixedStepSeconds);

    expect(readAfflictionsOf(head).chill).toBeGreaterThan(0);
    expect(readAfflictionsOf(head).chill).toBe(readAfflictionsOf(body).chill);
});

it("raises the weak-spot multiplier of every gun and the lance by her Marksman card's share, and leaves the body's damage alone", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });
    const weapons = [
        ...gunList.map((gun) => guns[gun].settings),
        lanceSettings,
    ];
    const read = (number: WeaponNumber) =>
        weapons.map((weapon) => readWeaponNumber(weapon, ada, number));
    const damage = read(WeaponNumber.Damage);

    ada.set(WardenTrait, { offer: offerCards([CardId.Marksman]) });
    pickCard(ada, 0);
    const share = cards[CardId.Marksman].modifiers[0]?.modifier.percent ?? 0;

    expect(share).toBeGreaterThan(0);
    expect(read(WeaponNumber.ZoneDamage)).toEqual(weapons.map(() => 1 + share));
    expect(read(WeaponNumber.Damage)).toEqual(damage);
});
