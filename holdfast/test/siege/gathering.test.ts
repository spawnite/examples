// @vitest-environment node
import type { Entity } from "koota";
import { Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine, PhaseTrait, readPhase } from "../../src/siege/phase";
import { isReadyAsked } from "../../src/siege/gathering";
import {
    DisconnectedTrait,
    fixedStepSeconds,
    teleportActor,
    TransformTrait,
    WalletTrait,
} from "@spawnite/engine";
import { siegePlugin } from "../../src/siege/siege.plugin";
import { lastFallSeconds } from "../../src/siege/siege";
import {
    SiegeStateTrait,
    SiegeTrait,
    WardenTrait,
} from "../../src/siege/traits";
import {
    countdownSeconds,
    firstBreatherSeconds,
    nightWaves,
    readyRingMetres,
    startWithoutSeconds,
    waveClearSeconds,
} from "../../src/siege/waves";
import {
    deliverSignal,
    holdWave,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    type OpenedSiege,
} from "./room";
import { LifeMachine, ReadinessMachine } from "../../src/siege/life";

//  How the wardens in a room start a run together: the ring by the fire,
//  the countdown once all of them stand in it, and the start without one
//  who never comes.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** A spot inside the ring by the fire, clear of its stones. */
function inRing(x = 0) {
    return new Vector3(x, 0, readyRingMetres - 0.8);
}

/** Walks `warden` to `to`, as her moves would. */
function walk(game: OpenedSiege, warden: Entity, to: Vector3) {
    warden.get(TransformTrait)?.copy(to);
    teleportActor(game.world, warden);
}

/** What pages draw of the run. */
function readShown(game: OpenedSiege) {
    const shown = game.world.queryFirst(SiegeTrait)?.get(SiegeTrait);
    if (!shown) throw new Error("No siege shown.");
    return shown;
}

async function openTwo() {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-6) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(6) });
    return { game: siege, ada, bo };
}

it("readies a warden who steps into the ring by the fire, and not one who steps out", async () => {
    const { game, ada } = await openTwo();

    walk(game, ada, inRing());
    game.step(fixedStepSeconds * 2);
    expect(ada.has(ReadinessMachine.is.ready)).toBe(true);

    walk(game, ada, onField(-6));
    game.step(fixedStepSeconds * 2);
    expect(ada.has(ReadinessMachine.is.ready)).toBe(false);
});

it("readies a warden whose feet reach the lit ring's outer edge, and not one a step past it", async () => {
    const { game, ada, bo } = await openTwo();

    walk(game, ada, new Vector3(0, 0, readyRingMetres - 0.02));
    walk(game, bo, new Vector3(0, 0, -(readyRingMetres + 0.02)));
    game.step(fixedStepSeconds * 2);

    expect(ada.has(ReadinessMachine.is.ready)).toBe(true);
    expect(bo.has(ReadinessMachine.is.ready)).toBe(false);
});

it("readies by the ring in the phases a page lights it, a breather after a wave and dawn among them, and in no other", async () => {
    const { game, ada, bo } = await openTwo();
    //  Keyed by the phase a page reads, which lights the ring, and the
    //  wave it stands at.
    const seen = new Map<string, boolean>();
    const expected = new Map<string, boolean>();
    /** Walks Ada out and back in, and notes whether the ring readied her. */
    function tryRing() {
        walk(game, ada, onField(-6));
        game.step(fixedStepSeconds * 2);
        walk(game, ada, inRing(-1));
        game.step(fixedStepSeconds * 2);
        const phase = readPhase(game.world.queryFirst(PhaseTrait));
        const wave = readShown(game).wave;
        const key = `${phase} at wave ${wave}`;
        seen.set(key, ada.has(ReadinessMachine.is.ready) === true);
        expected.set(key, isReadyAsked(phase, wave));
        walk(game, ada, onField(-6));
        game.step(fixedStepSeconds * 2);
    }

    /** Starts a run from the ring, and leaves Bo out of it after. */
    function startRun() {
        walk(game, ada, inRing(-1));
        walk(game, bo, inRing(1));
        game.step(countdownSeconds + fixedStepSeconds * 2);
        walk(game, bo, onField(6));
    }

    tryRing();
    startRun();
    tryRing();
    game.step(firstBreatherSeconds + 1);
    tryRing();
    holdWave(game);
    game.step(waveClearSeconds + fixedStepSeconds * 2);
    tryRing();
    for (const warden of [ada, bo]) warden.set(WardenTrait, { health: 0 });
    game.step(lastFallSeconds + 0.1);
    tryRing();
    startRun();
    game.step(firstBreatherSeconds + 1);
    game.world
        .queryFirst(SiegeStateTrait)
        ?.set(SiegeStateTrait, { wave: nightWaves });
    holdWave(game);
    tryRing();

    expect([...seen.keys()]).toEqual([
        "waiting at wave 0",
        "breather at wave 0",
        "fight at wave 1",
        "breather at wave 1",
        "over at wave 1",
        `dawn at wave ${nightWaves}`,
    ]);
    expect(seen).toEqual(expected);
    expect(expected.get("breather at wave 0")).toBe(false);
    expect(expected.get("breather at wave 1")).toBe(true);
});

it("keeps a warden who said she is ready ready as she walks through the ring", async () => {
    const { game, ada } = await openTwo();
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    game.step(fixedStepSeconds * 2);

    walk(game, ada, inRing());
    game.step(fixedStepSeconds * 2);
    walk(game, ada, onField(-6));
    game.step(fixedStepSeconds * 2);

    expect(ada.has(ReadinessMachine.is.ready.key)).toBe(true);
});

it("says the ring readied a warden who stepped into it, so stepping out cancels", async () => {
    const { game, ada } = await openTwo();

    walk(game, ada, inRing());
    game.step(fixedStepSeconds * 2);

    expect(ada.has(ReadinessMachine.is.ready.ring)).toBe(true);
});

it("readies and unreadies a warden on her word, wherever she stands", async () => {
    const { game, ada } = await openTwo();

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    game.step(fixedStepSeconds * 2);
    expect(ada.has(ReadinessMachine.is.ready)).toBe(true);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.unready,
    });
    game.step(fixedStepSeconds * 2);
    expect(ada.has(ReadinessMachine.is.ready)).toBe(false);
});

it("counts down five seconds once every warden is ready, then starts the run", async () => {
    const { game, ada, bo } = await openTwo();
    walk(game, ada, inRing(-1));
    walk(game, bo, inRing(1));

    game.step(1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.waiting);
    expect(readSiege(game.world).secondsLeft).toBeCloseTo(
        countdownSeconds - 1,
        1,
    );
    game.step(countdownSeconds - 1 + fixedStepSeconds * 2);

    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.breather,
        wave: 0,
    });
});

it("starts a lone warden's run five seconds after she steps into the ring", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField() });

    walk(siege, ada, inRing());
    siege.step(countdownSeconds - 0.5);
    expect(readSiege(siege.world).phase).toBe(PhaseMachine.is.waiting);
    siege.step(0.6);

    expect(readSiege(siege.world).phase).toBe(PhaseMachine.is.breather);
});

it("cancels the countdown when a warden steps out of the ring", async () => {
    const { game, ada, bo } = await openTwo();
    walk(game, ada, inRing(-1));
    walk(game, bo, inRing(1));
    game.step(2);

    walk(game, bo, onField(6));
    game.step(fixedStepSeconds * 2);
    expect(readSiege(game.world).secondsLeft).toBe(0);
    game.step(countdownSeconds);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.waiting);
});

it("cancels the countdown when a warden joins, until she is ready too", async () => {
    const { game, ada, bo } = await openTwo();
    walk(game, ada, inRing(-1));
    walk(game, bo, inRing(1));
    game.step(2);

    const cy = joinWarden(game, { name: "Cy", position: onField(0, 6) });
    game.step(fixedStepSeconds);
    expect(readSiege(game.world).secondsLeft).toBe(0);
    walk(game, cy, inRing(0));
    game.step(countdownSeconds + fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
});

it("starts no run while a warden is still gathering, however long it takes", async () => {
    const { game, ada } = await openTwo();
    walk(game, ada, inRing());

    game.step(120);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.waiting);
});

it("counts down for those left once the last warden not ready leaves", async () => {
    const { game, ada, bo } = await openTwo();
    walk(game, ada, inRing());
    game.step(3);

    bo.destroy();
    game.step(countdownSeconds + fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
});

it("counts on when a ready warden leaves mid-countdown", async () => {
    const { game, ada, bo } = await openTwo();
    walk(game, ada, inRing(-1));
    walk(game, bo, inRing(1));
    game.step(2);

    bo.destroy();
    game.step(countdownSeconds - 2 + fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
});

it("leaves a disconnected warden out of who must be ready", async () => {
    const { game, ada, bo } = await openTwo();
    bo.add(DisconnectedTrait);

    walk(game, ada, inRing());
    game.step(countdownSeconds + fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
});

it("offers the ready a start without the rest once they have waited thirty seconds", async () => {
    const { game, ada } = await openTwo();
    walk(game, ada, inRing());

    game.step(startWithoutSeconds - 1);
    expect(readShown(game).startWithout).toBe(false);
    game.step(1.1);

    expect(readShown(game).startWithout).toBe(true);
});

it("starts without the rest on a ready warden's word, and takes the rest into the run", async () => {
    const { game, ada, bo } = await openTwo();
    walk(game, ada, inRing());
    game.step(startWithoutSeconds + 0.1);

    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.startWithout,
    });
    game.step(fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.breather);
    const feet = bo.get(TransformTrait);
    expect(Math.hypot(feet?.x ?? 0, feet?.z ?? 0)).toBeLessThan(8);
    expect(bo.has(LifeMachine.is.down)).toBe(false);
});

it("takes no start without the rest from a warden who is not ready, nor before the wait", async () => {
    const { game, ada, bo } = await openTwo();
    walk(game, ada, inRing());
    game.step(startWithoutSeconds - 5);
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.startWithout,
    });
    game.step(fixedStepSeconds * 2);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.waiting);

    game.step(6);
    deliverSignal(game.world, {
        hero: bo,
        message: siegePlugin.messages.startWithout,
    });
    game.step(fixedStepSeconds * 2);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.waiting);
});

/** Runs a two-warden run to its end. */
async function endRun() {
    const { game, ada, bo } = await openTwo();
    walk(game, ada, inRing(-1));
    walk(game, bo, inRing(1));
    game.step(countdownSeconds + fixedStepSeconds * 2);
    ada.set(WalletTrait, { coins: 12 });
    ada.set(WardenTrait, { kills: 9 });
    for (const warden of [ada, bo]) warden.set(WardenTrait, { health: 0 });
    game.step(lastFallSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
    return { game, ada, bo };
}

it("stands every warden up by the fire as the run ends, keeping what she earned for the end screen", async () => {
    const { ada, bo } = await endRun();

    for (const warden of [ada, bo]) {
        expect(warden.has(LifeMachine.is.down)).toBe(false);
        expect(warden.has(ReadinessMachine.is.ready)).toBe(false);
        const feet = warden.get(TransformTrait);
        expect(Math.hypot(feet?.x ?? 0, feet?.z ?? 0)).toBeGreaterThan(
            readyRingMetres,
        );
    }
    expect(ada.get(WardenTrait)?.kills).toBe(9);
    expect(ada.get(WalletTrait)?.coins).toBe(12);
});

it("goes again from the ring as the first run started", async () => {
    const { game, ada, bo } = await endRun();
    walk(game, ada, inRing(-1));
    game.step(countdownSeconds + 1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);

    walk(game, bo, inRing(1));
    game.step(countdownSeconds + fixedStepSeconds * 2);

    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.breather,
        wave: 0,
    });
    expect(ada.get(WardenTrait)?.kills).toBe(0);
});

it("takes a warden who joins on the end screen as one more to wait for", async () => {
    const { game, ada, bo } = await endRun();
    walk(game, ada, inRing(-1));
    walk(game, bo, inRing(1));
    game.step(2);

    joinWarden(game, { name: "Cy", position: onField(0, 6) });
    game.step(countdownSeconds);

    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.over);
});
