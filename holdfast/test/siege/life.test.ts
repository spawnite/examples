// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    fixedStepSeconds,
    teleportActor,
    TransformTrait,
} from "@spawnite/engine";
import { LifeMachine, LifeTrait } from "../../src/siege/life";
import { WardenTrait } from "../../src/siege/traits";
import { firstBreatherSeconds, shelterSeconds } from "../../src/siege/waves";
import {
    fortify,
    joinWarden,
    onField,
    openSiege,
    takePlaces,
    type OpenedSiege,
} from "./room";

//  The transitions of a warden's body that the game's own tests leave
//  alone: getting up while a teammate tends her, and her shelter's end.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

const { is } = LifeMachine;

async function openFight() {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(game, { name: "Bo", position: onField(6) });
    takePlaces(game, ada, bo);
    fortify(game, bo);
    game.step(firstBreatherSeconds + 0.1);
    return { game, ada, bo };
}

it("is reviving while a teammate stands over her, and lying once she steps away", async () => {
    const { game, ada, bo } = await openFight();
    ada.set(WardenTrait, { health: 0 });
    game.step(fixedStepSeconds * 2);
    expect(ada.has(is.down.lying)).toBe(true);

    const feet = ada.get(TransformTrait);
    if (!feet) throw new Error("No place.");
    const away = bo.get(TransformTrait)?.clone();
    bo.set(TransformTrait, feet.clone());
    teleportActor(game.world, bo);
    game.step(0.5);
    expect(ada.has(is.down.reviving)).toBe(true);
    const revived = ada.get(LifeTrait)?.revived ?? 0;
    expect(revived).toBeGreaterThan(0);

    if (away) bo.set(TransformTrait, away);
    teleportActor(game.world, bo);
    game.step(fixedStepSeconds * 2);
    expect(ada.has(is.down.lying)).toBe(true);
    expect(ada.get(LifeTrait)?.revived).toBeLessThan(revived);
});

it("counts the step she joins on toward her shelter, and ends it on the step its seconds are spent", async () => {
    const { game } = await openFight();
    const cy = joinWarden(game, { name: "Cy", position: onField(0, 12) });
    expect(cy.has(is.sheltered.catchingUp)).toBe(true);
    expect(cy.get(LifeTrait)?.waited).toBeCloseTo(fixedStepSeconds);

    cy.set(LifeTrait, { waited: shelterSeconds - 3 * fixedStepSeconds });
    game.step(fixedStepSeconds * 2);
    expect(cy.has(is.sheltered)).toBe(true);
    game.step(fixedStepSeconds);
    expect(cy.has(is.standing)).toBe(true);
    expect(cy.get(WardenTrait)?.catchUp).toBe(0);
});
