import type { Entity, World } from "koota";
import { Vector3 } from "three";
import {
    Body,
    createGameWorld,
    defaultWalkerBody,
    deliverMessage,
    HealthTrait,
    mountHeadlessScene,
    PlayerName,
    RoomSource,
    spawnHero,
    stepSeconds,
    teleportActor,
    Transform,
    Wallet,
    type MountedScene,
} from "@spawnite/engine";
import { Holdfast, systems } from "../../src/scenes/Holdfast";
import { readyWeapon } from "../../src/siege/signals";
import {
    MonsterTrait,
    SiegePhase,
    SiegeState,
    WardenTrait,
} from "../../src/siege/traits";

//  The room's side of the game in a test: the scene mounted headless on a
//  room's world that runs the systems the scene exports, and heroes joined
//  as the room joins them.

export interface OpenedSiege extends MountedScene {
    step: (seconds: number) => void;
    close: () => Promise<void>;
}

export async function openSiege(): Promise<OpenedSiege> {
    const world = createGameWorld(systems);
    world.add(RoomSource);
    const game = await mountHeadlessScene(Holdfast, world);
    return {
        ...game,
        step: (seconds) => stepSeconds(game, seconds),
        close: async () => {
            await game.unmount();
            world.destroy();
        },
    };
}

/** A spot on open, level ground inside the circle, clear of the hearth,
 *  the stones and the cobbled ring. */
export function onField(x = 0, z = 0) {
    return new Vector3(x, 0, 9 + z);
}

/** Where each test's warden stands between runs, which the siege would
 *  otherwise move her from to her place by the fire. */
const spots = new Map<Entity, Vector3>();

/** Stands each warden `spots` holds back on her spot. */
function returnToSpots(game: OpenedSiege, wardens: Entity[]) {
    for (const warden of wardens) {
        const spot = spots.get(warden);
        if (!spot) continue;
        warden.get(Transform)?.copy(spot);
        teleportActor(game.world, warden);
    }
}

/** A warden a test joins: her name, and where the test stands her. */
interface Joining {
    name: string;
    position: Vector3;
}

/** A hero as the room spawns one for a page that joins, taken in by the
 *  siege, and stood at `position` for the test. */
export function joinWarden(game: OpenedSiege, { name, position }: Joining) {
    const hero: Entity = spawnHero(game.world, {
        position,
        facing: 0,
        health: HealthTrait.schema,
    });
    hero.add(Body(defaultWalkerBody), Wallet, PlayerName({ name }));
    spots.set(hero, position.clone());
    game.step(1 / 60);
    returnToSpots(game, [hero]);
    return hero;
}

/** Gives a warden more health than any wave can take, for a test about the
 *  wave rather than about her. The siege takes her in on its first step. */
export function fortify(game: OpenedSiege, warden: Entity) {
    game.step(1 / 60);
    warden.set(WardenTrait, { health: 1e6, maximum: 1e6 });
}

/** A signal a test sends: whose, and which. */
interface TestSignal {
    hero: Entity;
    name: string;
}

/** Her page's signal, as the room hands it to the next step once it has
 *  checked it. */
export function deliverSignal(world: World, { hero, name }: TestSignal) {
    deliverMessage(world, { hero, name, payload: {} });
}

/** Each warden takes her place, as her page does when she presses Play:
 *  the siege reads her word on the next step, and a run that starts on it
 *  stands her by the fire, from where the test stands her back. */
export function takePlaces(game: OpenedSiege, ...wardens: Entity[]) {
    for (const hero of wardens)
        deliverSignal(game.world, { hero, name: readyWeapon });
    game.step(1 / 60);
    returnToSpots(game, wardens);
}

/** The room's working record of the run. */
export function readSiege(world: World) {
    const state = world.queryFirst(SiegeState)?.get(SiegeState);
    if (!state) throw new Error("No siege in the world.");
    return state;
}

/** Kills every monster of the wave as it spawns, until the wave is held. */
export function holdWave(game: OpenedSiege) {
    while (readSiege(game.world).phase === SiegePhase.Fight) {
        game.step(1 / 60);
        for (const monster of game.world.query(MonsterTrait)) monster.destroy();
    }
    game.step(1 / 60);
}
