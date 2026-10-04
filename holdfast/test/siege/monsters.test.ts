// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { fixedStepSeconds, InvulnerableTrait } from "@spawnite/engine";
import { spawnMonster } from "../../src/siege/monsters";
import { MonsterKind, WardenTrait } from "../../src/siege/traits";
import { planWave } from "../../src/siege/waves";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** A warden with a husk in reach on either side, each ready to strike. */
async function surroundWarden() {
    siege = await openSiege();
    const warden = joinWarden(siege, { name: "Ada", position: onField() });
    for (const side of [-1, 1])
        spawnMonster(siege.world, {
            kind: MonsterKind.Husk,
            position: onField(side * 0.9),
            plan: planWave(1, 1),
        });
    return { game: siege, warden };
}

it("lands one blow when two monsters strike her in the same moment", async () => {
    const { game, warden } = await surroundWarden();

    game.step(fixedStepSeconds);

    //  A husk strikes for 5.
    expect(warden.get(WardenTrait)?.health).toBe(95);
});

it("lands no second blow within half a second of the first", async () => {
    const { game, warden } = await surroundWarden();
    game.step(fixedStepSeconds);

    game.step(0.45);

    expect(warden.get(WardenTrait)?.health).toBe(95);
});

it("lets the waiting monster strike her once the half second has passed", async () => {
    const { game, warden } = await surroundWarden();
    game.step(fixedStepSeconds);

    game.step(0.55);

    expect(warden.get(WardenTrait)?.health).toBe(90);
});

it("lands no blow on an invulnerable warden, as a profile's bot plays", async () => {
    const { game, warden } = await surroundWarden();
    warden.add(InvulnerableTrait);

    game.step(fixedStepSeconds);

    expect(warden.get(WardenTrait)?.health).toBe(100);
});
