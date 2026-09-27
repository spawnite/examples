// @vitest-environment node
import { expect, it } from "vitest";
import { Vector3 } from "three";
import {
    activateItem,
    addItem,
    countItem,
    equipItem,
    HealthTrait,
    Hero,
    LootTrait,
    maxHealthStat,
    mountHeadlessScene,
    placePlayer,
    readStat,
    registerMaps,
    stepSeconds,
    Transform,
} from "@spawnite/engine";
import { Meadow } from "../../src/scenes/Meadow";

//  In Node with no page, as `game simulate` mounts it, on the game's own
//  map files, which the app registers.
async function mountMeadow() {
    const dispose = registerMaps(
        import.meta.glob("../../src/maps/*.json", { eager: true }),
    );
    const game = await mountHeadlessScene(Meadow);
    const hero = game.world.queryFirst(Hero);
    if (!hero) throw new Error("The meadow spawned no hero.");
    return {
        game,
        hero,
        unmount: async () => {
            await game.unmount();
            game.world.destroy();
            dispose();
        },
    };
}

it("mounts the meadow headless, with the hero in it", async () => {
    const { game, unmount } = await mountMeadow();

    expect(game.world.query(Hero)).toHaveLength(1);

    await unmount();
}, 30_000);

it("lays a potion and a ring that the hero takes as she reaches each", async () => {
    const { game, hero, unmount } = await mountMeadow();
    //  Her own height on the ground, not the loot's: loot laid above her
    //  reach stays where it is.
    const standing = hero.get(Transform)?.y ?? 0;
    const lootPositions = game.world
        .query(LootTrait, Transform)
        .map((loot) => loot.get(Transform)?.clone() ?? new Vector3());

    expect(lootPositions).toHaveLength(2);
    for (const { x, z } of lootPositions) {
        placePlayer(game, new Vector3(x, standing, z));
        stepSeconds(game, 0.5);
    }

    expect(countItem(hero, "potion")).toBe(3);
    expect(countItem(hero, "ring-of-vitality")).toBe(1);
    expect(game.world.query(LootTrait)).toHaveLength(0);

    await unmount();
}, 30_000);

it("heals the hero 40 with a potion from her bag", async () => {
    const { game, hero, unmount } = await mountMeadow();
    hero.set(HealthTrait, { current: 50 });
    addItem(hero, { item: "potion", count: 1 });

    activateItem(hero, { slot: 0 });
    stepSeconds(game, 0.1);

    expect(hero.get(HealthTrait)?.current).toBe(90);
    expect(countItem(hero, "potion")).toBe(0);

    await unmount();
}, 30_000);

it("raises the hero's max health by 25 while she wears the ring", async () => {
    const { game, hero, unmount } = await mountMeadow();
    addItem(hero, { item: "ring-of-vitality", count: 1 });

    expect(equipItem(hero, 0)).toBe(true);
    stepSeconds(game, 0.1);

    expect(readStat(hero, maxHealthStat)).toBe(125);
    expect(hero.get(HealthTrait)?.maximum).toBe(125);

    await unmount();
}, 30_000);
