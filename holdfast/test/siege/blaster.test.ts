// @vitest-environment node
import type { World } from "koota";
import { Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import {
    addStatModifier,
    dealDamage,
    requireAuthority,
    fixedStepSeconds,
    HealthTrait,
    readWeaponNumber,
    WalletTrait,
    WeaponNumber,
} from "@spawnite/engine";
import { blasterSettings } from "../../src/siege/blaster";
import { CardId, offerCards, pickCard } from "../../src/siege/cards";
import { spawnMonster } from "../../src/siege/monsters";
import { WardenStat } from "../../src/siege/stats";
import {
    CoinBurstsTrait,
    MonsterKind,
    WardenTrait,
} from "../../src/siege/traits";
import { monsterSettings, planWave } from "../../src/siege/waves";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** A husk standing still `metres` ahead of the warden along negative z. */
function standHusk(world: World, metres: number, health: number) {
    const monster = spawnMonster(world, {
        kind: MonsterKind.Husk,
        position: onField(0, -metres),
        plan: planWave(1, 1),
    });
    monster.set(HealthTrait, { current: health, maximum: health });
    return monster;
}

/** The blaster's rate, pellets and pierce as the room's judge reads them
 *  off her. */
function readBlaster(warden: Parameters<typeof readWeaponNumber>[1]) {
    return {
        shotsPerSecond: readWeaponNumber(
            blasterSettings,
            warden,
            WeaponNumber.ShotsPerSecond,
        ),
        pellets: readWeaponNumber(
            blasterSettings,
            warden,
            WeaponNumber.Pellets,
        ),
        pierce: readWeaponNumber(blasterSettings, warden, WeaponNumber.Pierce),
    };
}

it("hits as hard as her damage, which Heavy Rounds raises by 15%", async () => {
    siege = await openSiege();
    const hero = joinWarden(siege, { name: "Ada", position: onField() });
    const before = readWeaponNumber(blasterSettings, hero, WeaponNumber.Damage);

    hero.set(WardenTrait, { offer: offerCards([CardId.HeavyRounds]) });
    pickCard(hero, 0);

    expect([
        before,
        readWeaponNumber(blasterSettings, hero, WeaponNumber.Damage),
    ]).toEqual([10, 11.5]);
});

it("fires at her rate, with her pellets and her pierce, as her stats give them", async () => {
    siege = await openSiege();
    const hero = joinWarden(siege, { name: "Ada", position: onField() });
    const before = readBlaster(hero);

    addStatModifier(hero, WardenStat.FireRate, { source: "test", flat: 1 });
    addStatModifier(hero, WardenStat.Pellets, { source: "test", flat: 2 });
    addStatModifier(hero, WardenStat.Pierce, { source: "test", flat: 1 });

    expect([before, readBlaster(hero)]).toEqual([
        { shotsPerSecond: 6, pellets: 1, pierce: 0 },
        { shotsPerSecond: 7, pellets: 3, pierce: 1 },
    ]);
});

it("credits the kill to the warden whose shot took the monster's last health, and pays its coins to her from where it fell", async () => {
    siege = await openSiege();
    const hero = joinWarden(siege, { name: "Ada", position: onField() });
    siege.step(fixedStepSeconds);
    const husk = standHusk(siege.world, 6, 1);

    dealDamage(requireAuthority(siege.world), husk, {
        amount: 10,
        source: hero,
    });
    siege.step(fixedStepSeconds);

    expect(husk.isAlive()).toBe(false);
    expect(hero.get(WardenTrait)?.kills).toBe(1);
    expect(hero.get(WalletTrait)?.coins).toBe(
        monsterSettings[MonsterKind.Husk].coins,
    );
    const bursts = siege.world
        .queryFirst(CoinBurstsTrait)
        ?.get(CoinBurstsTrait)?.bursts;
    expect(bursts).toHaveLength(1);
    const from = new Vector3(bursts?.[0].x, bursts?.[0].y, bursts?.[0].z);
    expect(from.distanceTo(onField(0, -6))).toBeLessThan(0.1);
});

it("pays the coins of a monster no warden's shot killed all the same, and credits no one the kill", async () => {
    siege = await openSiege();
    const hero = joinWarden(siege, { name: "Ada", position: onField() });
    siege.step(fixedStepSeconds);
    const husk = standHusk(siege.world, 6, 1);

    dealDamage(requireAuthority(siege.world), husk, { amount: 10 });
    siege.step(fixedStepSeconds);

    expect(husk.isAlive()).toBe(false);
    expect(hero.get(WardenTrait)?.kills).toBe(0);
    expect(hero.get(WalletTrait)?.coins).toBe(
        monsterSettings[MonsterKind.Husk].coins,
    );
});
