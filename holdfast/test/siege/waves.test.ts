// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import {
    dealDamage,
    requireAuthority,
    fixedStepSeconds,
    InputTrait,
    TransformTrait,
} from "@spawnite/engine";
import { Vector3 } from "three";
import { spawnMonster } from "../../src/siege/monsters";
import { MonsterKind, MonsterTrait, WardenTrait } from "../../src/siege/traits";
import {
    breatherSeconds,
    firstBreatherSeconds,
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
        dealDamage(requireAuthority(world), monster, { amount: 1e6 });
}

it("waits with no warden, and with wardens until one takes her place", async () => {
    siege = await openSiege();
    siege.step(1);
    expect(readSiege(siege.world).phase).toBe(PhaseMachine.is.waiting);

    const hero = joinWarden(siege, { name: "Ada", position: onField() });
    siege.step(1);
    expect(readSiege(siege.world).phase).toBe(PhaseMachine.is.waiting);

    takePlaces(siege, hero);
    siege.step(1);

    const state = readSiege(siege.world);
    expect(state.phase).toBe(PhaseMachine.is.breather);
    expect(state.wave).toBe(0);
    expect(state.secondsLeft).toBeCloseTo(firstBreatherSeconds - 1, 1);
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
        const at = entity.get(TransformTrait);
        const feet = hero.get(TransformTrait);
        if (at && feet)
            distances.push(Math.hypot(at.x - feet.x, at.z - feet.z));
    });

    game.step(firstBreatherSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
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
    expect(state.phase).toBe(PhaseMachine.is.breather);
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
    for (const monster of rest)
        dealDamage(requireAuthority(game.world), monster, { amount: 1e6 });

    game.step(1);

    expect(survivor.isAlive()).toBe(true);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
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
    const start = monster.get(TransformTrait)?.clone();
    if (!start) throw new Error("The monster has no place.");

    game.step(1);
    const after = monster.get(TransformTrait);
    if (!after) throw new Error("The monster has no place.");
    const feet = hero.get(TransformTrait);
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

    expect(readSiege(siege.world).phase).toBe(PhaseMachine.is.waiting);
    expect(readSiege(siege.world).secondsLeft).toBe(0);
});

it("raises wave 1's batches in front of where her camera faces, each batch together", async () => {
    siege = await openSiege();
    const game = siege;
    const hero = joinWarden(game, { name: "Ada", position: onField() });
    takePlaces(game, hero);
    fortify(game, hero);
    //  Her camera looks down -x.
    if (!hero.has(InputTrait)) hero.add(InputTrait);
    hero.set(InputTrait, { heading: Math.PI / 2 });
    const spots: Vector3[] = [];
    game.world.onAdd(MonsterTrait, (entity: Entity) => {
        const at = entity.get(TransformTrait);
        if (at) spots.push(at.clone());
    });

    game.step(firstBreatherSeconds + 0.1);
    stepUntil(game, {
        done: () => readSiege(game.world).toSpawn === 0,
        seconds: 60,
    });

    const feet = hero.get(TransformTrait);
    if (!feet) throw new Error("She has no feet.");
    expect(spots.length).toBe(planWave(1, 1).count);
    for (const at of spots) {
        const away = new Vector3(at.x - feet.x, 0, at.z - feet.z).normalize();
        //  Within 60 degrees of -x.
        expect(-away.x).toBeGreaterThanOrEqual(Math.cos(Math.PI / 3) - 0.01);
    }
    //  The first batch rises together, from one rift.
    expect(spots[0].distanceTo(spots[1])).toBeLessThan(3);
});

it("keeps wave 1's spawns fair for a warden facing out from the arena's edge", async () => {
    siege = await openSiege();
    const game = siege;
    const hero = joinWarden(game, { name: "Ada", position: onField() });
    takePlaces(game, hero);
    fortify(game, hero);
    game.step(firstBreatherSeconds - 1);
    //  At the edge, her camera looking out along +x.
    hero.get(TransformTrait)?.set(14, 0, 0);
    if (!hero.has(InputTrait)) hero.add(InputTrait);
    hero.set(InputTrait, { heading: -Math.PI / 2 });
    const distances: number[] = [];
    game.world.onAdd(MonsterTrait, (entity: Entity) => {
        const at = entity.get(TransformTrait);
        const feet = hero.get(TransformTrait);
        if (at && feet)
            distances.push(Math.hypot(at.x - feet.x, at.z - feet.z));
    });

    stepUntil(game, {
        done: () =>
            readSiege(game.world).wave === 1 &&
            readSiege(game.world).toSpawn === 0,
        seconds: 60,
    });

    expect(distances.length).toBeGreaterThan(0);
    for (const distance of distances)
        expect(distance).toBeGreaterThanOrEqual(spawnMetres.least - 0.01);
});
