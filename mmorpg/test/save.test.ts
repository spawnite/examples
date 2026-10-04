// @vitest-environment node
import { Vector3 } from "three";
import { expect, onTestFinished } from "vitest";
import {
    bindSaveSession,
    countItem,
    createSaveSession,
    type SaveSession,
    EquipmentTrait,
    equipItem,
    HealthTrait,
    HeroTrait,
    InventoryTrait,
    LootTrait,
    maxHealthStat,
    placePlayer,
    readStat,
    registerMaps,
    stepSeconds,
    TransformTrait,
} from "@spawnite/engine";
import { it, type CreateWorld, type Scene } from "@spawnite/engine/testing";
import { plugins } from "../src/game";
import { save } from "../src/save";
import { Meadow } from "../src/scenes/Meadow";

//  The game names the engine's saves in `include`, and the engine reads and
//  restores them: a hero saved on one meadow comes back on the next.

/** The meadow headless, with the player's save session on its world
 *  loaded from `record`, as Game binds it before the scene mounts. */
async function mountMeadow(
    scene: Scene,
    createWorld: CreateWorld,
    record: unknown,
) {
    onTestFinished(
        registerMaps(import.meta.glob("../src/maps/*.json", { eager: true })),
    );
    const { world } = createWorld(plugins);
    const session = createSaveSession(world, {
        save,
        player: () => ({ id: "player" }),
    });
    bindSaveSession(world, session);
    expect(session.load(record)).toMatchObject({ ok: true });
    const game = await scene(Meadow, world);
    const hero = game.world.queryFirst(HeroTrait);
    if (!hero) throw new Error("The meadow spawned no hero.");
    return { game, hero, session };
}

/** Walks her to each loot the meadow lays, so she takes it. */
function takeLoot(game: Awaited<ReturnType<Scene>>, standing: number) {
    const positions = game.world
        .query(LootTrait, TransformTrait)
        .map((loot) => loot.get(TransformTrait)?.clone() ?? new Vector3());
    for (const { x, z } of positions) {
        placePlayer(game, new Vector3(x, standing, z));
        stepSeconds(game, 0.5);
    }
}

/** The record the session holds now, as a write would read it. */
function readRecord(session: SaveSession) {
    const read = session.read();
    if (!read?.ok) throw new Error("The save did not read.");
    return read.record;
}

it("restores what a save wrote onto the next meadow's hero: place, health, bag, ring and loot taken", async ({
    scene,
    createWorld,
}) => {
    const first = await mountMeadow(scene, createWorld, null);
    const standing = first.hero.get(TransformTrait)?.y ?? 0;
    takeLoot(first.game, standing);
    const ring = first.hero
        .get(InventoryTrait)
        ?.findIndex((stack) => stack?.item === "ring-of-vitality");
    expect(equipItem(first.hero, ring ?? -1)).toBe(true);
    first.hero.set(HealthTrait, { current: 61 });
    placePlayer(first.game, new Vector3(14, standing, -22));
    const record: unknown = JSON.parse(
        JSON.stringify(readRecord(first.session)),
    );

    const next = await mountMeadow(scene, createWorld, record);
    const { x, z } = next.hero.get(TransformTrait) ?? {};
    expect({ x, z }).toEqual({ x: 14, z: -22 });
    expect(next.hero.get(HealthTrait)?.current).toBe(61);
    expect(countItem(next.hero, "potion")).toBe(3);
    expect(next.hero.get(EquipmentTrait)?.ring1?.item).toBe("ring-of-vitality");
    //  The ring's +25 counts once.
    expect(readStat(next.hero, maxHealthStat)).toBe(125);
    //  Loot taken is not laid again.
    expect(next.game.world.query(LootTrait)).toHaveLength(0);
    expect(readRecord(next.session)).toEqual(record);
}, 60_000);

it("names the engine saves it keeps, and keeps no camera", () => {
    expect(save.include).toEqual([
        "hero",
        "stats",
        "resources",
        "inventory",
        "loot",
    ]);
});
