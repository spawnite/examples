// @vitest-environment node
import { expect, onTestFinished } from "vitest";
import { Vector3 } from "three";
import type { Entity, World } from "koota";
import {
    CastingTrait,
    activateItem,
    addItem,
    castPress,
    countItem,
    queuePress,
    DamagedTrait,
    type Hit,
    DownedTrait,
    equipItem,
    EquipmentSlot,
    EquipmentTrait,
    Faction,
    findResourceTrait,
    HealthTrait,
    HeroTrait,
    holdsAbility,
    LootLeftTrait,
    LootTrait,
    maxHealthStat,
    MovementTrait,
    nameAbilityCooldown,
    OneShotClipTrait,
    placePlayer,
    readCooldown,
    readStat,
    registerMaps,
    stepSeconds,
    TargetableTrait,
    TransformTrait,
    unequipItem,
} from "@spawnite/engine";
import { it, type CreateWorld, type Scene } from "@spawnite/engine/testing";
import {
    arcaneBolt,
    crystalLance,
    frostNova,
    mana,
} from "../../src/mage/abilities";
import { Meadow } from "../../src/scenes/Meadow";
import { plugins } from "../../src/game";

//  In Node with no page, as `spawnite simulate` mounts it, on the game's own
//  map files, which the app registers.
async function mountMeadow(scene: Scene, createWorld: CreateWorld) {
    onTestFinished(
        registerMaps(
            import.meta.glob("../../src/maps/*.json", { eager: true }),
        ),
    );
    //  On the step the game's own <Game plugins> runs, as a room's would.
    const game = await scene(Meadow, createWorld(plugins).world);
    const hero = game.world.queryFirst(HeroTrait);
    if (!hero) throw new Error("The meadow spawned no hero.");
    return { game, hero };
}

it("mounts the meadow headless, with the hero in it", async ({
    scene,
    createWorld,
}) => {
    const { game } = await mountMeadow(scene, createWorld);

    expect(game.world.query(HeroTrait)).toHaveLength(1);
}, 30_000);

it("lays a potion and a ring that the hero takes as she reaches each", async ({
    scene,
    createWorld,
}) => {
    const { game, hero } = await mountMeadow(scene, createWorld);
    //  Her own height on the ground, not the loot's: loot laid above her
    //  reach stays where it is.
    const standing = hero.get(TransformTrait)?.y ?? 0;
    const lootPositions = game.world
        .query(LootTrait, TransformTrait)
        .map((loot) => loot.get(TransformTrait)?.clone() ?? new Vector3());

    expect(lootPositions).toHaveLength(2);
    for (const { x, z } of lootPositions) {
        placePlayer(game, new Vector3(x, standing, z));
        stepSeconds(game, 0.5);
    }

    expect(countItem(hero, "potion")).toBe(3);
    expect(countItem(hero, "ring-of-vitality")).toBe(1);
    expect(game.world.query(LootTrait)).toHaveLength(0);
    //  So a reload lays neither again.
    expect(game.world.get(LootLeftTrait)).toEqual({
        "meadow-potions": 0,
        "meadow-ring": 0,
    });
}, 30_000);

it("heals the hero 40 with a potion from her bag", async ({
    scene,
    createWorld,
}) => {
    const { game, hero } = await mountMeadow(scene, createWorld);
    hero.set(HealthTrait, { current: 50 });
    addItem(hero, { item: "potion", count: 1 });

    activateItem(hero, { slot: 0 });
    stepSeconds(game, 0.1);

    expect(hero.get(HealthTrait)?.current).toBe(90);
    expect(countItem(hero, "potion")).toBe(0);
}, 30_000);

it("raises the hero's max health by 25 while she wears the ring", async ({
    scene,
    createWorld,
}) => {
    const { game, hero } = await mountMeadow(scene, createWorld);
    addItem(hero, { item: "ring-of-vitality", count: 1 });

    expect(equipItem(hero, 0)).toBe(true);
    stepSeconds(game, 0.1);

    expect(readStat(hero, maxHealthStat)).toBe(125);
    expect(hero.get(HealthTrait)?.maximum).toBe(125);
}, 30_000);

it("starts the hero with the crescent wand in her main hand, which grants Arcane Bolt", async ({
    scene,
    createWorld,
}) => {
    const { game, hero } = await mountMeadow(scene, createWorld);
    stepSeconds(game, 0.1);

    expect(hero.get(EquipmentTrait)?.[EquipmentSlot.MainHand]?.item).toBe(
        "crescent-wand",
    );
    expect(holdsAbility(hero, arcaneBolt)).toBe(true);
    expect(unequipItem(hero, EquipmentSlot.MainHand)).toBe(true);
    expect(holdsAbility(hero, arcaneBolt)).toBe(false);
}, 30_000);

let request = 0;

/** The cast message a press of the bolt's key sends, at `wolf`. */
function castSpell(world: World, hero: Entity, ability: string, wolf?: Entity) {
    queuePress(world, {
        hero,
        name: castPress.name,
        payload: {
            ability,
            target: wolf ?? null,
            request: ++request,
        },
    });
}

function castBoltAt(world: World, hero: Entity, wolf: Entity) {
    castSpell(world, hero, arcaneBolt, wolf);
}

/** Her mana, rounded down: it regenerates 5 a second from the release. */
function readMana(hero: Entity) {
    return Math.floor(hero.get(findResourceTrait(mana))?.current ?? 0);
}

/** The three wolves at their dens, east to west. */
function findWolves(game: { world: World }) {
    return [...game.world.query(TargetableTrait, HealthTrait)].sort(
        (left, right) =>
            (right.get(TransformTrait)?.x ?? 0) -
            (left.get(TransformTrait)?.x ?? 0),
    );
}

it("takes three bolts to down a wolf past the well, which stands again 20 s later", async ({
    scene,
    createWorld,
}) => {
    const { game, hero } = await mountMeadow(scene, createWorld);
    const wolves = game.world.query(TargetableTrait, HealthTrait);
    expect(wolves).toHaveLength(3);
    const [wolf] = wolves;
    expect(wolf.get(HealthTrait)?.maximum).toBe(60);
    const at = wolf.get(TransformTrait)?.clone() ?? new Vector3();
    placePlayer(
        game,
        new Vector3(at.x + 4, hero.get(TransformTrait)?.y ?? 0, at.z + 4),
    );

    //  Each cast winds up 0.6 s and flies 0.4 s, and the next waits out
    //  the 1 s global cooldown its release started.
    for (let bolt = 0; bolt < 3; bolt++) {
        expect(wolf.has(DownedTrait)).toBe(false);
        castBoltAt(game.world, hero, wolf);
        stepSeconds(game, 1.7);
        //  The first two flinch it.
        if (bolt < 2) expect(wolf.get(OneShotClipTrait)?.name).toBe("hit-left");
    }

    expect(wolf.isAlive()).toBe(true);
    expect(wolf.has(DownedTrait)).toBe(true);
    expect(wolf.get(HealthTrait)?.current).toBe(0);
    expect(wolf.get(OneShotClipTrait)).toMatchObject({
        name: "death",
        hold: true,
    });
    //  Still a target; the engine's bolts fly through a downed one.
    expect(wolf.get(TargetableTrait)?.faction).toBe(Faction.Hostile);

    stepSeconds(game, 20);

    expect(wolf.has(DownedTrait)).toBe(false);
    expect(wolf.get(HealthTrait)?.current).toBe(60);
    expect(wolf.get(OneShotClipTrait)?.name).toBe("");
    expect(wolf.get(TargetableTrait)?.faction).toBe(Faction.Hostile);
}, 30_000);

it("downs a wolf with one Crystal Lance after its 0.8 s wind-up, for 20 mana and a 5 s cooldown", async ({
    scene,
    createWorld,
}) => {
    const { game, hero } = await mountMeadow(scene, createWorld);
    const [wolf] = findWolves(game);
    const at = wolf.get(TransformTrait) ?? new Vector3();
    placePlayer(game, new Vector3(at.x + 4, 0, at.z + 4));

    castSpell(game.world, hero, crystalLance, wolf);
    stepSeconds(game, 0.7);
    expect(hero.has(CastingTrait)).toBe(true);
    expect(wolf.get(HealthTrait)?.current).toBe(60);
    //  The release, within a step of 0.8 s.
    stepSeconds(game, 0.15);
    expect(hero.has(CastingTrait)).toBe(false);

    //  Step by step to read the hit on the step it lands.
    let hit: Hit | undefined;
    for (let steps = 0; steps < 60 && !hit; steps++) {
        stepSeconds(game, 1 / 60);
        hit = wolf.get(DamagedTrait)?.hits[0];
    }

    expect(hit).toMatchObject({ weapon: crystalLance });
    //  60 to 75, times 1.5 on a crit, which the hit says it was.
    const [least, most] = hit?.data?.crit ? [90, 113] : [60, 75];
    expect(hit?.amount).toBeGreaterThanOrEqual(least);
    expect(hit?.amount).toBeLessThanOrEqual(most);
    expect(wolf.get(HealthTrait)?.current).toBe(0);
    //  The 20 spent at the release, and the regen since.
    expect(readMana(hero)).toBeGreaterThanOrEqual(80);
    expect(readMana(hero)).toBeLessThanOrEqual(82);
    expect(readCooldown(hero, nameAbilityCooldown(crystalLance))).toMatchObject(
        { seconds: 5 },
    );
    //  The engine downs it on the step after the hit, as it does a hero.
    stepSeconds(game, 1 / 60);
    expect(wolf.has(DownedTrait)).toBe(true);
}, 30_000);

it("strikes every wolf within 6 m with Frost Nova 1.4 s after the press, and slows each for 3 s", async ({
    scene,
    createWorld,
}) => {
    const { game, hero } = await mountMeadow(scene, createWorld);
    const wolves = findWolves(game);
    placePlayer(game, new Vector3(-12.5, 0, -11));

    castSpell(game.world, hero, frostNova);
    //  The step after the press starts the cast and counts the first of
    //  its 84 steps; the 84th releases.
    stepSeconds(game, 83 / 60);
    expect(hero.has(CastingTrait)).toBe(true);
    expect(wolves.map((wolf) => wolf.get(HealthTrait)?.current)).toEqual([
        60, 60, 60,
    ]);
    stepSeconds(game, 1 / 60);
    expect(hero.has(CastingTrait)).toBe(false);
    //  The slow's stat modifier reaches each wolf's speed the step after
    //  the strike.
    stepSeconds(game, 1 / 60);

    for (const wolf of wolves) {
        const health = wolf.get(HealthTrait)?.current ?? 0;
        expect(health).toBeGreaterThanOrEqual(30);
        expect(health).toBeLessThanOrEqual(35);
    }
    const slowed = wolves.map((wolf) => wolf.get(MovementTrait)?.speed ?? 0);
    expect(readMana(hero)).toBe(75);
    expect(readCooldown(hero, nameAbilityCooldown(frostNova))).toMatchObject({
        seconds: 5,
    });

    //  Past the slow's 3 s from the strike.
    stepSeconds(game, 3.1);

    expect(wolves.map((wolf) => wolf.get(MovementTrait)?.speed)).toEqual(
        slowed.map((speed) => speed * 2),
    );
}, 30_000);
