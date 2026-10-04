import type { Entity, Trait, World } from "koota";
import {
    PhaseMachine,
    PhaseTrait,
    readSecondsLeft,
} from "../../src/siege/phase";
import { Vector3 } from "three";
import {
    BodyTrait,
    createGameWorld,
    defaultWalkerBody,
    deliverMessage,
    HealthTrait,
    mountHeadlessScene,
    PlayerNameTrait,
    RoomSourceTrait,
    spawnHero,
    stepSeconds,
    teleportActor,
    TransformTrait,
    WalletTrait,
    writeStateTags,
    type MessageHandle,
    type MessagePayload,
    type MountedScene,
} from "@spawnite/engine";
import { Holdfast, plugins } from "../../src/scenes/Holdfast";
import { siegePlugin } from "../../src/siege/siege.plugin";
import { breatherSeconds, countdownSeconds } from "../../src/siege/waves";
import {
    MonsterTrait,
    SiegeStateTrait,
    WardenTrait,
} from "../../src/siege/traits";

//  The room's side of the game in a test: the scene mounted headless on a
//  room's world that runs the plugins the scene exports, and heroes joined
//  as the room joins them.

export interface OpenedSiege extends MountedScene {
    step: (seconds: number) => void;
    close: () => Promise<void>;
}

export async function openSiege(): Promise<OpenedSiege> {
    const world = createGameWorld(plugins);
    world.add(RoomSourceTrait);
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
        warden.get(TransformTrait)?.copy(spot);
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
    hero.add(
        BodyTrait(defaultWalkerBody),
        WalletTrait,
        PlayerNameTrait({ name }),
    );
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

/** A signal a test sends: whose, which of the siege's messages, and its
 *  payload, none where left out. */
interface TestSignal {
    hero: Entity;
    message: MessageHandle;
    payload?: MessagePayload;
}

/** Her page's signal, as the room hands it to the next step once it has
 *  checked it. */
export function deliverSignal(
    world: World,
    { hero, message, payload = {} }: TestSignal,
) {
    deliverMessage(world, { hero, name: message.name, payload });
}

/** Each warden says she is ready, as her key does, and the run starts
 *  once its countdown runs out, standing each by the fire, from where the
 *  test stands her back. */
export function takePlaces(game: OpenedSiege, ...wardens: Entity[]) {
    for (const hero of wardens)
        deliverSignal(game.world, {
            hero,
            message: siegePlugin.messages.ready,
        });
    game.step(countdownSeconds + 2 / 60);
    returnToSpots(game, wardens);
}

const { is } = PhaseMachine;

/** The phase machine's state for each top state a test puts the run in,
 *  by its tag: a breather resting, a wave being fought, the rest
 *  gathering. */
const phaseStates = new Map<
    Trait,
    ReturnType<typeof PhaseMachine.read>["value"]
>([
    [is.waiting, { waiting: "gathering" }],
    [is.breather, { breather: "resting" }],
    [is.fight, { fight: "fighting" }],
    [is.over, { over: "gathering" }],
    [is.dawn, { dawn: "gathering" }],
]);

/** The room's working record of the run, with the tag of the phase
 *  machine's top state, such as `PhaseMachine.is.fight`. */
export function readSiege(world: World) {
    const siege = world.queryFirst(SiegeStateTrait);
    const state = siege?.get(SiegeStateTrait);
    if (!siege || !state) throw new Error("No siege in the world.");
    return {
        ...state,
        phase: [...phaseStates.keys()].find((tag) => siege.has(tag)),
        secondsLeft: readSecondsLeft(siege),
    };
}

/** Puts the run in `phase`, with `restSeconds` of breather left to
 *  count, as a test sets up a run it did not play to there. */
export function setPhase(
    world: World,
    phase: Trait,
    restSeconds = breatherSeconds,
) {
    const siege = world.queryFirst(SiegeStateTrait);
    if (!siege) throw new Error("No siege in the world.");
    siege.set(PhaseTrait, {
        state: phaseStates.get(phase),
        restSeconds,
        waited: 0,
    });
    writeStateTags(siege, PhaseTrait);
}

/** Kills every monster of the wave as it spawns, until the wave is held,
 *  and steps on to the breather's card deal. */
export function holdWave(game: OpenedSiege) {
    clearWave(game);
    const siege = game.world.queryFirst(PhaseTrait);
    while (
        siege?.has(PhaseMachine.is.breather.dealing) ||
        siege?.has(PhaseMachine.is.breather.dealt)
    )
        game.step(1 / 60);
}

/** Puts the run in wave `wave`'s fight with nothing left to spawn, and
 *  holds it: the breather after it, its cards dealt, with the waves before
 *  it skipped rather than fought. The wardens have taken their places. */
export function skipToBreather(game: OpenedSiege, wave: number) {
    game.world
        .queryFirst(SiegeStateTrait)
        ?.set(SiegeStateTrait, { wave, toSpawn: 0, bosses: 0 });
    setPhase(game.world, PhaseMachine.is.fight);
    for (const monster of game.world.query(MonsterTrait)) monster.destroy();
    holdWave(game);
}

/** Kills every monster of the wave as it spawns, until the wave is held:
 *  the step that holds it and no further. */
export function clearWave(game: OpenedSiege) {
    while (readSiege(game.world).phase === PhaseMachine.is.fight) {
        game.step(1 / 60);
        for (const monster of game.world.query(MonsterTrait)) monster.destroy();
    }
    game.step(1 / 60);
}
