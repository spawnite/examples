// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import {
    ChaseTargets,
    createGameWorld,
    fixedStepSeconds,
    HealthTrait,
    isPayloadShaped,
    Messages,
    mountHeadlessScene,
    SpawnPoints,
    spawnHero,
    Transform,
} from "@spawnite/engine";
import { pickWeapons, readyWeapon } from "../../src/siege/signals";
import { SiegePhase, WardenTrait } from "../../src/siege/traits";
import {
    deliverSignal,
    onField,
    openSiege,
    readSiege,
    type OpenedSiege,
} from "./room";
import { Holdfast } from "../../src/scenes/Holdfast";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

//  6.5 m from the fire at 45°, 135°, 225° and 315° round y from +z.
const side = 6.5 * Math.SQRT1_2;

it("spawns the warden of each seat at her colour's place by the fire", async () => {
    siege = await openSiege();

    const places = (siege.world.get(SpawnPoints) ?? []).map(({ x, z }) => [
        x,
        z,
    ]);

    expect(places).toHaveLength(4);
    const expected = [
        [side, side],
        [side, -side],
        [-side, -side],
        [-side, side],
    ];
    places.forEach(([x, z], seat) => {
        expect(x).toBeCloseTo(expected[seat][0], 3);
        expect(z).toBeCloseTo(expected[seat][1], 3);
    });
});

it("leaves a warden where the room spawned her as the siege takes her in", async () => {
    siege = await openSiege();
    const spawned = onField(2, 1);
    const hero = spawnHero(siege.world, {
        position: spawned,
        facing: 0,
        health: HealthTrait.schema,
    });

    siege.step(fixedStepSeconds);

    expect(hero.get(WardenTrait)?.hue).toBe(0);
    const feet = hero.get(Transform);
    expect(feet?.x).toBeCloseTo(spawned.x, 3);
    expect(feet?.z).toBeCloseTo(spawned.z, 3);
});

it("gives a warden who joins in place of one who left her colour and her place", async () => {
    siege = await openSiege();
    const { world } = siege;
    const points = world.get(SpawnPoints) ?? [];
    const join = (seat: number) =>
        spawnHero(world, {
            position: points[seat].clone(),
            facing: 0,
            health: HealthTrait.schema,
        });
    const ada = join(0);
    const bo = join(1);
    siege.step(fixedStepSeconds);
    ada.destroy();
    const cy = join(0);
    siege.step(fixedStepSeconds);

    //  A run's start stands each warden at her colour's place.
    deliverSignal(world, { hero: bo, name: readyWeapon });
    deliverSignal(world, { hero: cy, name: readyWeapon });
    siege.step(fixedStepSeconds);

    expect(readSiege(world).phase).toBe(SiegePhase.Breather);
    expect(cy.get(WardenTrait)?.hue).toBe(0);
    const feet = cy.get(Transform);
    expect(feet?.x).toBeCloseTo(points[0].x, 3);
    expect(feet?.z).toBeCloseTo(points[0].z, 3);
});

it("takes each signal from a page with no payload, and refuses one that carries any", async () => {
    siege = await openSiege();
    const messages = siege.world.get(Messages);

    for (const name of [readyWeapon, ...pickWeapons]) {
        const shape = messages?.get(name)?.shape;
        if (!shape) throw new Error(`No ${name} message.`);
        expect(isPayloadShaped({}, shape)).toBe(true);
        expect(isPayloadShaped({ slot: 1 }, shape)).toBe(false);
    }
});

it("lets a page's chase name a standing warden and not a downed one, with no siege running there", async () => {
    //  A page mounts the scene on a world that runs no siege systems.
    const world = createGameWorld();
    const page = await mountHeadlessScene(Holdfast, world);
    const up = world.spawn(WardenTrait({ down: false }));
    const down = world.spawn(WardenTrait({ down: true }));
    const accepts = world.get(ChaseTargets)?.accepts;

    expect([up, down].map((hero) => accepts?.(hero))).toEqual([true, false]);
    await page.unmount();
    world.destroy();
});
