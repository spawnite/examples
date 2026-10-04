// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { HeldWeaponsTrait } from "@spawnite/engine";
import { blasterWeapon } from "../../src/siege/blaster";
import { CardId } from "../../src/siege/cards";
import { lanceWeapon } from "../../src/siege/lance";
import { WardenTrait } from "../../src/siege/traits";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./room";

//  The weapons each warden holds, which the room's judge refuses any other
//  shot by: the blaster, and the lance once her card gives it.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

it("hands a warden the blaster alone, the lance once she takes the Lance card, and the blaster alone again as her cards drop", async () => {
    siege = await openSiege();
    const warden = joinWarden(siege, { name: "Ada", position: onField() });
    siege.step(1 / 60);
    const joined = warden.get(HeldWeaponsTrait);

    warden.set(WardenTrait, { cards: [CardId.HeavyRounds, CardId.StormLance] });
    siege.step(1 / 60);
    const carded = warden.get(HeldWeaponsTrait);
    warden.set(WardenTrait, { cards: [] });
    siege.step(1 / 60);

    expect(joined).toEqual([blasterWeapon]);
    expect(carded).toEqual([blasterWeapon, lanceWeapon]);
    expect(warden.get(HeldWeaponsTrait)).toEqual([blasterWeapon]);
});
