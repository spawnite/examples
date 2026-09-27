// @vitest-environment node
import { Vector2, Vector3 } from "three";
import { expect, it } from "vitest";
import { mountHeadlessScene, readModelSize } from "@spawnite/engine";
import {
    Body,
    ChaseTrait,
    defaultWalkerBody,
    fixedStepSeconds,
    HealthTrait,
    launchProjectile,
    placePlayer,
    sendInput,
    stepSeconds,
    teleportActor,
    Transform,
    Wallet,
    Weapons,
    type HeadlessGame,
} from "@spawnite/engine/core";
import models from "../src/models.json";
import { Arena, coinPositions } from "../src/scenes/Arena";

/** The monster on the positive z axis, 16 m out. */
function findMonsterAhead({ world }: HeadlessGame) {
    const monster = world.query(ChaseTrait, Transform).find((entity) => {
        const position = entity.get(Transform);
        return !!position && Math.abs(position.x) < 0.01 && position.z > 0;
    });
    if (!monster) throw new Error("no monster on the z axis");
    return monster;
}

/** Metres from the lowest point of the monster's model to its top, as the
 *  bake measured the file. */
function measureMonsterModelHeight() {
    const { min, max } = models["rock-boulder"].bounds;
    return max[1] - min[1];
}

/** Metres from `position` to the nearest monster. */
function measureNearestMonster({ world }: HeadlessGame, position: Vector3) {
    let nearest = Infinity;
    for (const monster of world.query(ChaseTrait, Transform)) {
        const distance = monster.get(Transform)?.distanceTo(position);
        if (distance !== undefined) nearest = Math.min(nearest, distance);
    }
    return nearest;
}

//  The room loads the scene alone, so the scene registers the arena's
//  names, and a monster left without a size is cut to the rock it is drawn
//  as.
it("sizes the monster as the boulder from the scene the room loads", () => {
    expect(readModelSize("monster")).toEqual(models["rock-boulder"].capsule);
});

it("closes the nearest monster on a heroine who stands still", async () => {
    const game = await mountHeadlessScene(Arena);
    const player = placePlayer(game, new Vector3(0, 0, 0));
    const standing = player.get(Transform)?.clone();
    if (!standing) throw new Error("no heroine");
    const before = measureNearestMonster(game, standing);

    stepSeconds(game, 4);

    expect(before - measureNearestMonster(game, standing)).toBeGreaterThan(5);
    await game.unmount();
    game.world.destroy();
});

it("takes a quarter of the monster ahead's health with a stone from her sling", async () => {
    const game = await mountHeadlessScene(Arena);
    const monster = findMonsterAhead(game);
    const hero = placePlayer(game, new Vector3(0, 0, 8));
    stepSeconds(game, 0.1);
    const sling = game.world.get(Weapons)?.get("sling");
    const feet = hero.get(Transform)?.clone();
    const target = monster.get(Transform)?.clone();
    if (!sling || !feet || !target)
        throw new Error("no sling, heroine or monster");
    const origin = feet.setY(feet.y + defaultWalkerBody.height / 2);

    launchProjectile(game.world, {
        origin,
        direction: target
            .setY(target.y + 0.35)
            .sub(origin)
            .normalize(),
        weapon: sling,
        shooter: hero,
    });
    stepSeconds(game, 1);

    expect(monster.get(HealthTrait)?.current).toBe(75);
    await game.unmount();
    game.world.destroy();
});

it("credits the coin she walks over to her wallet", async () => {
    const game = await mountHeadlessScene(Arena);
    //  The coin straight ahead of her on the z axis: her line toward the
    //  middle passes no other coin within reach.
    const coin = coinPositions.find(({ x, z }) => Math.abs(x) < 0.01 && z > 0);
    if (!coin) throw new Error("no coin on the z axis");
    const player = placePlayer(game, new Vector3(0, 0, coin.z + 2));
    //  Forward on the stick is toward negative z at heading zero.
    sendInput(game, { intent: new Vector2(0, 1), steering: true });

    //  Two metres at five a second, with the ramp up to speed.
    stepSeconds(game, 1);

    expect(player.get(Wallet)?.coins).toBe(1);
    await game.unmount();
    game.world.destroy();
});

it("stops her at a monster she runs into", async () => {
    const game = await mountHeadlessScene(Arena);
    //  Three metres ahead of her along -z: it closes to its reach and stands
    //  there.
    const monster = findMonsterAhead(game);
    const player = placePlayer(game, new Vector3(0, 0, 19));
    sendInput(game, { intent: new Vector2(0, 1), steering: true });

    //  Two seconds straight at it: ten metres at her run, past it.
    stepSeconds(game, 2);

    //  Her radius and its radius short of its axis, nearer than its reach:
    //  she walked up to it, and her capsule stands against its capsule.
    const contact = defaultWalkerBody.radius + (monster.get(Body)?.radius ?? 0);
    const gap =
        (player.get(Transform)?.z ?? 0) - (monster.get(Transform)?.z ?? 0);
    expect(gap).toBeGreaterThan(contact - 0.01);
    expect(gap).toBeLessThan(contact + 0.1);
    await game.unmount();
    game.world.destroy();
});

it("holds her on a monster at the top of the rock it is drawn as", async () => {
    const game = await mountHeadlessScene(Arena);
    const player = placePlayer(game, new Vector3(0, 0, 0));
    //  Her capsule is made on her first step.
    stepSeconds(game, fixedStepSeconds);
    const monster = findMonsterAhead(game);
    const ground = monster.get(Transform)?.y ?? 0;
    //  Over its axis and jumping, so she comes down on its top.
    player.set(
        Transform,
        monster
            .get(Transform)
            ?.clone()
            .setY(ground + 2.5) ?? new Vector3(),
    );
    teleportActor(game.world, player);
    sendInput(game, { jump: true });
    stepSeconds(game, fixedStepSeconds);
    sendInput(game, { jump: false });

    //  Her feet over the ground when her fall first stops.
    let previous = (player.get(Transform)?.y ?? 0) - ground;
    let falling = false;
    let stand: number | undefined;
    for (let step = 0; step < 180 && stand === undefined; step++) {
        stepSeconds(game, fixedStepSeconds);
        const feet = (player.get(Transform)?.y ?? 0) - ground;
        if (previous - feet > 0.05) falling = true;
        else if (falling && previous - feet < 0.01) stand = previous;
        previous = feet;
    }

    //  The rock stands on its lowest point, so its top is its height. The
    //  body reaches a little over it, taller than her 0.6 m step, so she
    //  does not walk up onto it as onto a kerb.
    const rockTop = measureMonsterModelHeight();
    expect(stand).toBeGreaterThan(rockTop - 0.05);
    expect(stand).toBeLessThan(rockTop + 0.15);
    await game.unmount();
    game.world.destroy();
});
