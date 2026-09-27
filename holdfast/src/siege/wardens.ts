import { createQuery, Not, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    Ground,
    HealthTrait,
    Hero,
    Movement,
    placeSpawnPoints,
    readEach,
    teleportActor,
    Transform,
} from "@spawnite/engine/core";
import { declareWardenStats } from "./stats";
import { ShotCredit, StandingWardens, Stride, WardenTrait } from "./traits";

//  The heroes the room spawns, taken into the siege.

/** Metres from the fire a warden stands at the start of a run: clear of
 *  its stones, near enough to talk. */
const standMetres = 6.5;
/** Places round the fire, one per colour. */
const standPlaces = 4;

const newHeroes = createQuery(Hero, Not(WardenTrait));
/** Every warden in the room, down or not. */
export const wardens = createQuery(Hero, WardenTrait);
const placedWardens = createQuery(Hero, WardenTrait, Transform);

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
    const feet = warden.get(Transform);
    if (!feet) return;
    const { x, z } = findWardenPlace(warden.get(WardenTrait)?.hue ?? 0, feet);
    const surface = world.queryFirst(Ground)?.get(Ground)?.surface;
    feet.setY(surface?.getHeightAt({ x, z }) ?? 0);
    teleportActor(world, warden);
}

/** Every hero the room spawned since the last step becomes a warden: her
 *  health moves to her `WardenTrait`, off the engine's `HealthTrait`, so no
 *  shot damages her and the engine's reap never removes her at zero. Her
 *  colour is the lowest the others leave free, her stats start at their
 *  bases, and her stride is the movement the room spawned her with. She
 *  stands where the room spawned her, at her colour's place. */
export function adoptWardens(world: World) {
    readEach(world, newHeroes, (_traits, hero) => {
        let hue = 0;
        while (isHueWorn(world, hue)) hue++;
        const movement = hero.get(Movement);
        hero.remove(HealthTrait);
        hero.add(
            WardenTrait({ hue }),
            ShotCredit({ shots: 2 }),
            Stride({
                speed: movement?.speed ?? 0,
                jumpHeight: movement?.jumpHeight ?? 0,
            }),
        );
        declareWardenStats(hero);
    });
}

/** Gathers the wardens on their feet for this step's systems. */
export function gatherStandingWardens(world: World) {
    if (!world.has(StandingWardens)) world.add(StandingWardens);
    const standing = world.get(StandingWardens);
    if (!standing) return;
    standing.length = 0;
    readEach(world, placedWardens, ([survivor], warden) => {
        if (!survivor.down) standing.push(warden);
    });
}

/** The wardens on their feet, as this step gathered them. */
export function queryStandingWardens(world: World) {
    return world.get(StandingWardens) ?? [];
}

/** Whether `hero` is a warden on her feet, the one a monster chases: by
 *  the list the room's step gathered, which reads no trait per call, or by
 *  her own trait on a page, whose world runs no siege. */
export function isWardenStanding(world: World, hero: Entity) {
    const standing = world.get(StandingWardens);
    if (standing) return standing.includes(hero);
    return hero.get(WardenTrait)?.down === false;
}

/** Every warden in the room, down or not. */
export function queryWardens(world: World) {
    return world.query(wardens);
}
