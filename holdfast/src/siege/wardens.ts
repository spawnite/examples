import { createQuery, Not, Or, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    DisconnectedTrait,
    GroundTrait,
    HealthTrait,
    HeroTrait,
    MovementTrait,
    placeSpawnPoints,
    readEach,
    teleportActor,
    TransformTrait,
} from "@spawnite/engine/core";
import { LifeMachine, LifeTrait, ReadinessTrait } from "./life";
import { declareWardenStats } from "./stats";
import {
    CareerTrait,
    NewcomerTrait,
    ShotCreditTrait,
    StandingWardensTrait,
    StrideTrait,
    TargetWardensTrait,
    UnattendedTrait,
    WardenTrait,
} from "./traits";
import { PhaseTrait } from "./phase";

//  The heroes the room spawns, taken into the siege.

/** Metres from the fire a warden stands at the start of a run: clear of
 *  its stones, near enough to talk. */
const standMetres = 6.5;
/** Places round the fire, one per colour. */
const standPlaces = 4;

const newHeroes = createQuery(HeroTrait, Not(WardenTrait));
/** Every warden in the room, down or not. */
export const wardens = createQuery(HeroTrait, WardenTrait);
const placedWardens = createQuery(HeroTrait, WardenTrait, TransformTrait);

/** Whether a warden already wears `hue`. */
function isHueWorn(world: World, hue: number) {
    for (const warden of world.query(wardens))
        if (warden.get(WardenTrait)?.hue === hue) return true;
    return false;
}

/** Writes into `place` where the warden of colour `hue` stands round the
 *  fire, level with it. */
function findWardenPlace(hue: number, place: Vector3) {
    const angle = ((hue % standPlaces) + 0.5) * ((Math.PI * 2) / standPlaces);
    return place.set(
        Math.sin(angle) * standMetres,
        0,
        Math.cos(angle) * standMetres,
    );
}

/** Spawns each warden at her colour's place: the room seats a player at
 *  the lowest seat no other holds, as the siege gives her the lowest free
 *  colour, so her seat's point is her colour's place. The return takes the
 *  places away. */
export function placeWardenSpawns(world: World) {
    return placeSpawnPoints(
        world,
        Array.from({ length: standPlaces }, (_, hue) =>
            findWardenPlace(hue, new Vector3()),
        ),
    );
}

/** Stands `warden` at her colour's place round the fire, on the ground:
 *  where every run starts. A body the physics has built moves there at
 *  once; one it has not is built there. */
export function standWarden(world: World, warden: Entity) {
    const feet = warden.get(TransformTrait);
    if (!feet) return;
    const { x, z } = findWardenPlace(warden.get(WardenTrait)?.hue ?? 0, feet);
    const surface = world.queryFirst(GroundTrait)?.get(GroundTrait)?.surface;
    feet.setY(surface?.getHeightAt({ x, z }) ?? 0);
    teleportActor(world, warden);
}

/** Every hero the room spawned since the last step becomes a warden: her
 *  health moves to her `WardenTrait`, off the engine's `HealthTrait`, so no
 *  shot damages her and the engine's reap never removes her at zero. Her
 *  colour is the lowest the others leave free, her stats start at their
 *  bases, her stride is the movement the room spawned her with, and her
 *  career is the one her save restored, or an empty one. She
 *  stands where the room spawned her, at her colour's place, and waits for
 *  the siege to welcome her into the run, or into the wait for the next. */
export function adoptWardens(world: World) {
    readEach(world, newHeroes, (_traits, hero) => {
        let hue = 0;
        while (isHueWorn(world, hue)) hue++;
        const movement = hero.get(MovementTrait);
        hero.remove(HealthTrait);
        hero.add(
            WardenTrait({ hue }),
            LifeTrait,
            ReadinessTrait,
            ShotCreditTrait({ shots: 2 }),
            StrideTrait({
                speed: movement?.speed ?? 0,
                jumpHeight: movement?.jumpHeight ?? 0,
            }),
            NewcomerTrait,
        );
        declareWardenStats(hero);
        //  Her save may have put hers on already, as she joined.
        if (!hero.has(CareerTrait)) hero.add(CareerTrait);
    });
}

/** Whether her player's connection is up: a warden whose dropped stays in
 *  the room a while, stood still, for her player to come back to. */
export function isConnected(warden: Entity) {
    return !warden.has(DisconnectedTrait);
}

const heldByNobody = createQuery(Or(PhaseTrait, WardenTrait));

/** Marks the siege and every warden `UnattendedTrait` while no warden's player
 *  is connected, and takes it off once one is, before the machines count
 *  this step's waits. */
export function holdUnattended(world: World) {
    let attended = false;
    for (const warden of world.query(wardens))
        if (isConnected(warden)) attended = true;
    for (const entity of world.query(heldByNobody))
        if (attended) entity.remove(UnattendedTrait);
        else if (!entity.has(UnattendedTrait)) entity.add(UnattendedTrait);
}

/** Gathers the wardens on their feet whose player is connected for this
 *  step's systems, and those of them a monster may chase and hurt. */
export function gatherStandingWardens(world: World) {
    if (!world.has(StandingWardensTrait))
        world.add(StandingWardensTrait, TargetWardensTrait);
    const standing = world.get(StandingWardensTrait);
    const targets = world.get(TargetWardensTrait);
    if (!standing || !targets) return;
    standing.length = 0;
    targets.length = 0;
    readEach(world, placedWardens, (_traits, warden) => {
        //  A dropped warden stands still: she revives nobody and anchors
        //  no spawn.
        if (warden.has(LifeMachine.is.down) || !isConnected(warden)) return;
        standing.push(warden);
        if (!warden.has(LifeMachine.is.sheltered)) targets.push(warden);
    });
}

/** The wardens on their feet whose player is connected, as this step
 *  gathered them. */
export function queryStandingWardens(world: World) {
    return world.get(StandingWardensTrait) ?? [];
}

/** The standing wardens a monster may chase and hurt, as this step
 *  gathered them. */
export function queryTargetWardens(world: World) {
    return world.get(TargetWardensTrait) ?? [];
}

/** Whether `hero` is a warden a monster chases: on her feet, not
 *  sheltered, her player connected. By the list the room's step gathered,
 *  which reads no trait per call, or by her own traits on a page, whose
 *  world runs no siege. */
export function isWardenTarget(world: World, hero: Entity) {
    const targets = world.get(TargetWardensTrait);
    if (targets) return targets.includes(hero);
    return hero.has(LifeMachine.is.standing) && isConnected(hero);
}

/** Every warden in the room, down or not. */
export function queryWardens(world: World) {
    return world.query(wardens);
}
