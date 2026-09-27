// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { dealDamage, fixedStepSeconds, Transform } from "@spawnite/engine";
import { spawnMonster } from "../../src/siege/monsters";
import {
    MonsterKind,
    MonsterTrait,
    SiegePhase,
    WardenTrait,
} from "../../src/siege/traits";
import {
    breatherSeconds,
    firstBreatherSeconds,
    lobbySeconds,
    planWave,
    spawnMetres,
} from "../../src/siege/waves";
import {
    fortify,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    takePlaces,
    type OpenedSiege,
} from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** What a test waits for, and how long it waits at most. */
interface Wait {
    done: () => boolean;
    seconds: number;
}

/** Steps until `done` holds, a step at a time, for at most `seconds`. */
function stepUntil(game: OpenedSiege, { done, seconds }: Wait) {
    for (let step = 0; step < seconds / fixedStepSeconds; step++) {
        if (done()) return;
        game.step(fixedStepSeconds);
    }
    throw new Error(`Not done within ${seconds} s.`);
}

/** Every monster standing, killed. */
function killMonsters({ world }: OpenedSiege) {
    for (const monster of world.query(MonsterTrait))
        dealDamage(monster, { amount: 1e6 });
}

it("waits with no warden, and with wardens until one takes her place", async () => {
    siege = await openSiege();
    siege.step(1);
    expect(readSiege(siege.world).phase).toBe(SiegePhase.Waiting);

    const hero = joinWarden(siege, { name: "Ada", position: onField() });
    siege.step(1);
    expect(readSiege(siege.world).phase).toBe(SiegePhase.Waiting);

    takePlaces(siege, hero);
    siege.step(1);

    const state = readSiege(siege.world);
    expect(state.phase).toBe(SiegePhase.Breather);
    expect(state.wave).toBe(0);
    expect(state.secondsLeft).toBeCloseTo(firstBreatherSeconds - 1, 1);
});

it("starts the run without a warden who never takes her place", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-3) });
    joinWarden(siege, { name: "Bo", position: onField(3) });
    takePlaces(siege, ada);

    siege.step(lobbySeconds - 1);
    expect(readSiege(siege.world).phase).toBe(SiegePhase.Waiting);
    siege.step(1.1);

    expect(readSiege(siege.world).phase).toBe(SiegePhase.Breather);
});

it("opens wave 1 when the breather runs out, and spawns all of it round the wardens", async () => {
    siege = await openSiege();
    const game = siege;
    const hero = joinWarden(game, { name: "Ada", position: onField() });
    takePlaces(game, hero);
    fortify(game, hero);
    //  How far each monster stood from her as it spawned.
    const distances: number[] = [];
    game.world.onAdd(MonsterTrait, (entity: Entity) => {
        const at = entity.get(Transform);
        const feet = hero.get(Transform);
        if (at && feet)
            distances.push(Math.hypot(at.x - feet.x, at.z - feet.z));
    });

    game.step(firstBreatherSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(SiegePhase.Fight);
    expect(readSiege(game.world).wave).toBe(1);
    stepUntil(game, {
        done: () => readSiege(game.world).toSpawn === 0,
        seconds: 60,
    });

    expect(distances).toHaveLength(planWave(1, 1).count);
    for (const distance of distances) {
        expect(distance).toBeGreaterThanOrEqual(spawnMetres.least - 0.01);
        expect(distance).toBeLessThanOrEqual(spawnMetres.most + 0.01);
    }
});

it("clears the wave when its last monster falls, and counts the next breather down", async () => {
    siege = await openSiege();
    const game = siege;
    const hero = joinWarden(game, { name: "Ada", position: onField() });
    takePlaces(game, hero);
    fortify(game, hero);
    game.step(firstBreatherSeconds + 0.1);
    stepUntil(game, {
        done: () => readSiege(game.world).toSpawn === 0,
        seconds: 60,
    });
    expect(game.world.query(MonsterTrait).length).toBeGreaterThan(0);

    killMonsters(game);
    game.step(fixedStepSeconds * 2);

    const state = readSiege(game.world);
    expect(game.world.query(MonsterTrait)).toHaveLength(0);
    expect(state.phase).toBe(SiegePhase.Breather);
    expect(state.wave).toBe(1);
    expect(state.secondsLeft).toBeCloseTo(breatherSeconds, 1);
});

it("keeps a wave going while a monster of it still stands", async () => {
    siege = await openSiege();
    const game = siege;
    const hero = joinWarden(game, { name: "Ada", position: onField() });
    takePlaces(game, hero);
    fortify(game, hero);
    game.step(firstBreatherSeconds + 0.1);
    stepUntil(game, {
        done: () => readSiege(game.world).toSpawn === 0,
        seconds: 60,
    });
    const [survivor, ...rest] = game.world.query(MonsterTrait);
    for (const monster of rest) dealDamage(monster, { amount: 1e6 });

    game.step(1);

    expect(survivor.isAlive()).toBe(true);
    expect(readSiege(game.world).phase).toBe(SiegePhase.Fight);
});

it("makes every wave tougher and faster than the one before, and larger but for a boss wave's escort", () => {
    for (let wave = 1; wave < 30; wave++) {
        const plan = planWave(wave, 1);
        const next = planWave(wave + 1, 1);
        if (next.bosses === 0 && plan.bosses === 0)
            expect(next.count).toBeGreaterThan(plan.count);
        expect(next.health).toBeGreaterThan(plan.health);
        expect(next.speed).toBeGreaterThan(plan.speed);
    }
});

it("sends more monsters at two wardens than at one", () => {
    expect(planWave(3, 2).count).toBeGreaterThan(planWave(3, 1).count);
});

it("walks a monster at the warden and strikes her once it reaches her", async () => {
    siege = await openSiege();
    const game = siege;
    const hero = joinWarden(game, { name: "Ada", position: onField() });
    takePlaces(game, hero);
    game.step(firstBreatherSeconds + 0.1);
    stepUntil(game, {
        done: () => game.world.query(MonsterTrait).length > 0,
        seconds: 10,
    });
    const [monster] = game.world.query(MonsterTrait);
    const start = monster.get(Transform)?.clone();
    if (!start) throw new Error("The monster has no place.");

    game.step(1);
    const after = monster.get(Transform);
    if (!after) throw new Error("The monster has no place.");
    const feet = hero.get(Transform);
    if (!feet) throw new Error("The warden has no place.");
    expect(after.distanceTo(feet)).toBeLessThan(start.distanceTo(feet) - 1);

    stepUntil(game, {
        done: () => (hero.get(WardenTrait)?.health ?? 100) < 100,
        seconds: spawnMetres.most,
    });
});

it("hits a warden in reach once per its cooldown", async () => {
    siege = await openSiege();
    const game = siege;
    const hero = joinWarden(game, { name: "Ada", position: onField() });
    game.step(fixedStepSeconds);
    //  Each blow she takes, apart from the healing between waves.
    const blows: number[] = [];
    let health = hero.get(WardenTrait)?.health ?? 0;
    game.world.onChange(WardenTrait, (entity) => {
        const now = entity.get(WardenTrait)?.health ?? 0;
        if (entity === hero && now < health) blows.push(health - now);
        health = now;
    });
    spawnMonster(game.world, {
        kind: MonsterKind.Husk,
        position: onField(0, 1),
        plan: planWave(1, 1),
    });

    //  A husk hits for 5 once a second, slow enough to read its wind-up:
    //  at once, then at 1 s and 2 s.
    game.step(2.1);

    expect(blows).toEqual([5, 5, 5]);
});

it("forgets the wait for the others when the one warden who took her place leaves", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-3) });
    joinWarden(siege, { name: "Bo", position: onField(3) });
    takePlaces(siege, ada);
    siege.step(5);

    ada.destroy();
    siege.step(fixedStepSeconds * 2);

    expect(readSiege(siege.world).phase).toBe(SiegePhase.Waiting);
    expect(readSiege(siege.world).secondsLeft).toBe(0);
});
