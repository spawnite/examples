// @vitest-environment node
import { Vector2 } from "three";
import { expect } from "vitest";
import { Player, World } from "@spawnite/engine";
import { ColliderTrait, sendInput, stepSeconds } from "@spawnite/engine/core";
import { it } from "@spawnite/engine/testing";
import { RollMachine } from "../../src/behaviours/Roll";
import { Ball } from "../../src/components/Ball";
import { ballPosition } from "../../src/scenes/Run";

it("keeps the ball resting on its spot until she pushes it off", async ({
    scene,
}) => {
    const [x, , z] = ballPosition;
    const game = await scene(() => (
        <World map="meadow">
            <Player position={[x, 0, z + 2]} />
            <Ball position={ballPosition} />
        </World>
    ));
    const ball = game.world.queryFirst(ColliderTrait, RollMachine.trait);
    if (!ball) throw new Error("no ball with its roll");

    stepSeconds(game, 1);
    expect(ball.has(RollMachine.is.resting)).toBe(true);

    //  Forward on the stick is toward negative z at heading zero.
    sendInput(game, { intent: new Vector2(0, 1), steering: true });
    stepSeconds(game, 2);
    expect(ball.has(RollMachine.is.pushed)).toBe(true);
}, 30_000);
