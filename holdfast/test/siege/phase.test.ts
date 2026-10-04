// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { fixedStepSeconds } from "@spawnite/engine";
import { LifeMachine } from "../../src/siege/life";
import { isPhase, lastFallSeconds, PhaseMachine } from "../../src/siege/phase";
import { siegePlugin } from "../../src/siege/siege.plugin";
import { WardenTrait } from "../../src/siege/traits";
import {
    breatherSeconds,
    countdownSeconds,
    firstBreatherSeconds,
    readyBreatherSeconds,
    waveClearSeconds,
} from "../../src/siege/waves";
import {
    clearWave,
    deliverSignal,
    joinWarden,
    onField,
    openSiege,
    takePlaces,
    type OpenedSiege,
} from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** The phase machine's state on the siege's entity. */
function readMachine(game: OpenedSiege) {
    const entity = game.world.queryFirst(PhaseMachine.trait);
    if (!entity) throw new Error("No phase machine in the world.");
    return PhaseMachine.read(entity);
}

async function openFight() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    takePlaces(siege, ada);
    siege.step(firstBreatherSeconds + 0.1);
    return { game: siege, ada };
}

it("counts the gathering down once every warden is ready, and stops when one is not", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    siege.step(fixedStepSeconds);
    expect(readMachine(siege).value).toEqual({ waiting: "gathering" });

    deliverSignal(siege.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    siege.step(countdownSeconds / 2);
    expect(readMachine(siege).value).toEqual({ waiting: "counting" });

    deliverSignal(siege.world, {
        hero: ada,
        message: siegePlugin.messages.unready,
    });
    siege.step(fixedStepSeconds);
    expect(readMachine(siege).value).toEqual({ waiting: "gathering" });
});

it("counts the first breather down whole, since the wardens readied for the run already", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    takePlaces(siege, ada);
    expect(readMachine(siege).value).toEqual({ breather: "resting" });

    deliverSignal(siege.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    siege.step(firstBreatherSeconds - 1);
    expect(readMachine(siege).value).toEqual({ breather: "resting" });

    siege.step(1 + fixedStepSeconds * 2);
    expect(readMachine(siege).value).toEqual({ fight: "fighting" });
});

it("waits out the beat after a held wave before the deal, then rests the breather", async () => {
    const { game, ada } = await openFight();
    expect(readMachine(game).value).toEqual({ fight: "fighting" });

    clearWave(game);
    expect(readMachine(game).value).toEqual({ breather: "dealing" });
    expect(ada.get(WardenTrait)?.offer).toHaveLength(0);

    game.step(waveClearSeconds);
    const rest = readMachine(game);
    expect(rest.value).toEqual({ breather: "resting" });
    //  The breather counts from the deal, not through the beat before it.
    expect(rest.secondsLeft).toBeGreaterThan(
        breatherSeconds - waveClearSeconds,
    );
    expect(ada.get(WardenTrait)?.offer.length).toBeGreaterThan(0);
});

it("cuts the breather to its ready seconds from the deal when every warden readies during the beat", async () => {
    const { game, ada } = await openFight();
    clearWave(game);
    game.step(1);
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    game.step(waveClearSeconds - 1 + fixedStepSeconds * 2);

    const rest = readMachine(game);
    expect(rest.value).toEqual({ breather: "resting" });
    expect(rest.secondsLeft).toBeLessThanOrEqual(readyBreatherSeconds);
    expect(rest.secondsLeft).toBeGreaterThan(
        readyBreatherSeconds - fixedStepSeconds * 3,
    );
});

it("keeps the whole breather when a warden readies and unreadies during the beat", async () => {
    const { game, ada } = await openFight();
    clearWave(game);
    game.step(1);
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    game.step(fixedStepSeconds);
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.unready,
    });
    game.step(waveClearSeconds - 1 + fixedStepSeconds);

    const rest = readMachine(game);
    expect(rest.value).toEqual({ breather: "resting" });
    expect(rest.secondsLeft).toBeGreaterThan(breatherSeconds - 1);
});

it("holds the run on its last fall, then ends it", async () => {
    siege = await openSiege();
    const game = siege;
    const ada = joinWarden(game, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(game, { name: "Bo", position: onField(6) });
    takePlaces(game, ada, bo);
    game.step(firstBreatherSeconds + 0.1);

    for (const warden of [ada, bo]) warden.set(WardenTrait, { health: 0 });
    game.step(fixedStepSeconds * 2);
    expect(readMachine(game).value).toEqual({ fight: "falling" });

    game.step(lastFallSeconds);
    expect(readMachine(game).value).toEqual({ over: "gathering" });
});

it("names a phase by the phase machine's tags alone", async () => {
    siege = await openSiege();

    //  @ts-expect-error: a warden's tag is not a phase.
    expect(isPhase(siege.world, LifeMachine.is.down)).toBe(false);
});
