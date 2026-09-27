//  @vitest-environment jsdom
//  The real orbit these cases register reads a DOMRect as it is built, and
//  node has none.
import { type World } from "koota";
import {
    createGameWorld,
    frameCamera,
    readCameraFraming,
    type CameraFraming,
} from "@spawnite/engine";
import { Vector3 } from "three";
import { expect, it } from "vitest";
import {
    autosaveSettings,
    createAutosave,
    loadCamera,
    readSavedHero,
    saveGame,
} from "../src/save";
import { createSaveStore, spawnInitialEntities } from "@spawnite/engine";
import { moveEntities } from "@spawnite/engine";
import { HealthTrait, Hero } from "@spawnite/engine";
import { Velocity } from "@spawnite/engine";
import { buildSave } from "./helpers/save";
import { heroBuilder } from "./helpers/heroBuilder";
import { createMemoryStorage } from "./helpers/memoryStorage";
import { mountOrbit } from "./helpers/orbit";

const savedKey = "three-mmorpg-save";

//  Where a game with nothing stored opens, and what every save below carries
//  unless the case moves the camera itself.
const defaultFraming: CameraFraming = { azimuth: 0, polar: 1, distance: 6 };

function createTestStore(values = new Map<string, string>()) {
    const { storage } = createMemoryStorage(values);
    const store = createSaveStore(() => storage, { key: savedKey });
    return {
        store,
        values,
        readStoredSave: () => values.get(savedKey) ?? null,
    };
}

/** Spawns her from the save, as Player does with readSavedHero's props. */
function loadGame(
    world: World,
    store: ReturnType<typeof createTestStore>["store"],
) {
    const { initialSave } = store.getState();
    return spawnInitialEntities(
        world,
        initialSave?.hero ?? {
            position: new Vector3(),
            facing: 0,
            health: HealthTrait.schema,
        },
    );
}

function startGame(store: ReturnType<typeof createTestStore>["store"]) {
    const world = createGameWorld();
    const cleanup = loadGame(world, store);
    mountOrbit(world);
    //  A framing of its own before the load, so the case that stores none has
    //  a known one to read back rather than whatever the orbit was built at.
    frameCamera(world, defaultFraming);
    loadCamera(world, { store });
    return { world, cleanup, autosaveGame: createAutosave(store) };
}

function walk(world: World, seconds: number) {
    world.query(Hero, Velocity).updateEach(([velocity]) => {
        velocity.set(1, 0, 0);
    });
    moveEntities(world, seconds);
}

it.each([undefined, { azimuth: 7, polar: 1.2, distance: 4 }])(
    "restores framing %j and marks one baseline without writing",
    (camera) => {
        const saved = { ...buildSave(new Vector3(0, 0, 0)), camera };
        const { store, readStoredSave } = createTestStore(
            new Map([[savedKey, JSON.stringify(saved)]]),
        );
        const { world, cleanup, autosaveGame } = startGame(store);
        //  A stored framing is on the camera, and a game with none stored is
        //  left on the one it opened at.
        expect(readCameraFraming(world)).toEqual(camera ?? defaultFraming);
        autosaveGame(world, autosaveSettings.seconds);
        expect(store.getState().saveCount).toBe(0);
        expect(readStoredSave()).toBe(JSON.stringify(saved));
        frameCamera(world, { azimuth: 2, polar: 0.8, distance: 9 });
        autosaveGame(world, autosaveSettings.seconds);
        expect(readStoredSave()).toBe(
            JSON.stringify({
                ...saved,
                camera: { azimuth: 2, polar: 0.8, distance: 9 },
            }),
        );
        expect(store.getState().saveCount).toBe(1);
        cleanup();
        world.destroy();
    },
);

it("writes nothing before a camera mounts, preserving saved framing", () => {
    const saved = {
        ...buildSave(new Vector3()),
        camera: { azimuth: 2, polar: 1, distance: 8 },
    };
    const { store, readStoredSave } = createTestStore(
        new Map([[savedKey, JSON.stringify(saved)]]),
    );
    //  Not `startGame`, which mounts one: this is the window before the rig
    //  has registered an orbit, where a write would replace the framing the
    //  player left with the one the scene opens on.
    const world = createGameWorld();
    const cleanup = loadGame(world, store);
    walk(world, 1);
    expect(saveGame(world, { store })).toBe(false);
    expect(createAutosave(store)(world, autosaveSettings.seconds)).toBe(false);
    expect(readStoredSave()).toBe(JSON.stringify(saved));
    cleanup();
    world.destroy();
});

it("hands Player the saved hero's position, facing, health and stats", () => {
    const stats = { maxHealth: { modifiers: [{ source: "ring", flat: 20 }] } };
    const saved = {
        hero: heroBuilder()
            .at(new Vector3(3, 9, -4))
            .withFacing(1.2)
            .withHealth(25)
            .toSave(),
        stats,
    };
    const { store } = createTestStore(
        new Map([[savedKey, JSON.stringify(saved)]]),
    );

    //  Nine metres up: the first step stands her on the ground, which the
    //  engine's physics cases cover.
    expect(readSavedHero(store)).toEqual({
        position: [3, 9, -4],
        facing: 1.2,
        health: { current: 25, maximum: 100 },
        stats,
    });
    expect(store.getState().saveCount).toBe(0);
});

it("hands Player nothing when there is no save, so she spawns on its defaults", () => {
    const { store, readStoredSave } = createTestStore();

    expect(readSavedHero(store)).toEqual({});
    //  Marked, not written: a tab that only ever stands here writes nothing.
    const { world, cleanup } = startGame(store);
    expect(readStoredSave()).toBeNull();

    cleanup();
    world.destroy();
});

it("saves once the interval has passed, and not before", () => {
    const { store, readStoredSave } = createTestStore();
    const { world, cleanup, autosaveGame } = startGame(store);

    walk(world, 1);
    autosaveGame(world, autosaveSettings.seconds - 1);
    expect(readStoredSave()).toBeNull();

    autosaveGame(world, 1);

    expect(readStoredSave()).toBe(
        JSON.stringify({
            ...buildSave(new Vector3(1, 0, 0)),
            camera: { azimuth: 0, polar: 1, distance: 6 },
        }),
    );
    expect(store.getState().saveCount).toBe(1);

    cleanup();
    world.destroy();
});

it("writes nothing on an interval where the game did not change", () => {
    const { store } = createTestStore();
    const { world, cleanup, autosaveGame } = startGame(store);

    walk(world, 1);
    autosaveGame(world, autosaveSettings.seconds);
    autosaveGame(world, autosaveSettings.seconds);

    expect(store.getState().saveCount).toBe(1);

    cleanup();
    world.destroy();
});

it("saves a hero that lost health without moving", () => {
    const { store, readStoredSave } = createTestStore();
    const { world, cleanup, autosaveGame } = startGame(store);

    //  Standing still is not the same as nothing happening.
    world.queryFirst(Hero)?.set(HealthTrait, { current: 40, maximum: 100 });
    autosaveGame(world, autosaveSettings.seconds);

    expect(readStoredSave()).toBe(
        JSON.stringify({
            ...buildSave(new Vector3(0, 0, 0), 40),
            camera: { azimuth: 0, polar: 1, distance: 6 },
        }),
    );

    cleanup();
    world.destroy();
});

it("saves nothing when the world holds no hero", () => {
    const { store, readStoredSave } = createTestStore();
    const world = createGameWorld();
    mountOrbit(world);

    expect(saveGame(world, { store })).toBe(false);
    expect(readStoredSave()).toBeNull();

    world.destroy();
});

it("leaves another tab's progress alone while its own hero stands still", () => {
    const shared = new Map<string, string>();
    const walking = createTestStore(shared);
    const parked = createTestStore(shared);
    const walkingGame = startGame(walking.store);
    const parkedGame = startGame(parked.store);
    const parkedAutosave = parkedGame.autosaveGame;

    walk(walkingGame.world, 4);
    saveGame(walkingGame.world, { store: walking.store });
    const walked = walking.readStoredSave();

    parkedAutosave(parkedGame.world, autosaveSettings.seconds);
    parkedAutosave(parkedGame.world, autosaveSettings.seconds);

    expect(parked.readStoredSave()).toBe(walked);
    expect(parked.store.getState().saveCount).toBe(0);

    parkedGame.cleanup();
    parkedGame.world.destroy();
    walkingGame.cleanup();
    walkingGame.world.destroy();
});

it("writes a refused save again once the storage recovers", () => {
    const { storage, values } = createMemoryStorage();
    let refusing = true;
    const store = createSaveStore(
        () => ({
            ...storage,
            setItem: (name: string, value: string) => {
                if (refusing) throw new Error("The quota is full");
                storage.setItem(name, value);
            },
        }),
        { key: savedKey },
    );
    const { world, cleanup, autosaveGame } = startGame(store);

    walk(world, 2);
    expect(autosaveGame(world, autosaveSettings.seconds)).toBe(false);
    expect(values.get(savedKey)).toBeUndefined();
    expect(store.getState().saveCount).toBe(0);

    //  The walk is still unsaved, so the next interval offers it again rather
    //  than treating a write that never landed as done.
    refusing = false;
    expect(autosaveGame(world, autosaveSettings.seconds)).toBe(true);

    expect(values.get(savedKey)).toBe(
        JSON.stringify({
            ...buildSave(new Vector3(2, 0, 0)),
            camera: { azimuth: 0, polar: 1, distance: 6 },
        }),
    );
    expect(store.getState().saveCount).toBe(1);

    cleanup();
    world.destroy();
});
