// @vitest-environment node
import type { Entity, World } from "koota";
import { Vector3 } from "three";
import { expect, it } from "vitest";
import {
    BobTrait,
    BodyKind,
    Collider,
    ColliderShape,
    createHeadlessGame,
    dumpState,
    PickupTrait,
    placePlayer,
    sendInput,
    SpinTrait,
    stepSeconds,
    Transform,
    Wallet,
} from "@spawnite/engine/core";
import { Vector2 } from "three";
import { ballPosition, coinPositions } from "../src/scenes/Run";

//  The run's first coin, as the headless scene spawns it: the traits its
//  Spin, Bob, Pickup and collider fill.
function spawnCoin(world: World): Entity {
    return world.spawn(
        Transform(new Vector3(...coinPositions[0])),
        SpinTrait({ speed: 2 }),
        BobTrait({ height: 0.2 }),
        PickupTrait({ reward: 1 }),
        Collider({
            shape: ColliderShape.Box,
            kind: BodyKind.Kinematic,
            size: new Vector3(0.8, 0.1, 0.8),
        }),
    );
}

/** The run's ball, as the headless scene spawns it. */
function spawnBall(world: World): Entity {
    return world.spawn(
        Transform(new Vector3(...ballPosition)),
        Collider({
            shape: ColliderShape.Sphere,
            kind: BodyKind.Dynamic,
            size: new Vector3(1, 1, 1),
        }),
    );
}

it("rolls the ball away when she walks into it, and leaves the coin where it sits", async () => {
    let ball: Entity | undefined;
    const game = await createHeadlessGame({
        scene: (world) => {
            spawnCoin(world);
            ball = spawnBall(world);
        },
    });
    if (!ball) throw new Error("no ball");
    const coin = game.world.queryFirst(PickupTrait);
    const [x, y, z] = ballPosition;
    placePlayer(game, new Vector3(x, 0, z + 2));
    //  Forward on the stick is toward negative z at heading zero.
    sendInput(game, { intent: new Vector2(0, 1), steering: true });

    stepSeconds(game, 4);

    const rolled = ball.get(Transform);
    if (!rolled) throw new Error("no ball");
    expect(rolled.z).toBeLessThan(z - 2);
    //  Still on the ground: neither through it nor lifted by the push.
    expect(rolled.y).toBeGreaterThan(y - 0.1);
    expect(rolled.y).toBeLessThan(y + 0.5);
    //  The coin bobs on the spot: a kinematic body neither falls nor drifts.
    const rested = coin?.get(Transform);
    expect(rested?.x).toBe(coinPositions[0][0]);
    expect(rested?.z).toBe(coinPositions[0][2]);
    game.world.destroy();
});

it("credits the first coin to the player beside it within five seconds", async () => {
    const game = await createHeadlessGame({ scene: spawnCoin });
    const coin = game.world.queryFirst(PickupTrait);
    const player = placePlayer(game, new Vector3(0, 0, -2.5));

    stepSeconds(game, 5);

    expect(player.get(Wallet)?.coins).toBe(1);
    expect(coin?.isAlive()).toBe(false);
    game.world.destroy();
});

it("hashes the same seed alike and another seed apart", async () => {
    const run = async (seed: number) => {
        const game = await createHeadlessGame({ scene: spawnCoin, seed });
        //  Out on the hills, where the seed shapes the ground under her.
        placePlayer(game, new Vector3(30, 0, 0));
        stepSeconds(game, 1);
        const dump = dumpState(game.world);
        game.world.destroy();
        return dump;
    };
    const [first, second, other] = await Promise.all([run(1), run(1), run(2)]);

    expect(first.hash).toBe(second.hash);
    expect(other.hash).not.toBe(first.hash);
});
