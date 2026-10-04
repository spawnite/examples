import type { Entity, World } from "koota";
import {
    ChaseTrait,
    dealDamage,
    requireAuthority,
    fixedStepSeconds,
    HealthTrait,
    type WeaponSettings,
} from "@spawnite/engine";
import { blasterSettings, blasterWeapon } from "../../src/siege/blaster";
import { lanceSettings, lanceWeapon } from "../../src/siege/lance";
import {
    addElementPoints,
    type Element,
    levelPoints,
    takeElement,
} from "../../src/siege/elements";
import { spawnMonster } from "../../src/siege/monsters";
import {
    AfflictionsTrait,
    ElementStrikesTrait,
    type MonsterKind,
    MonsterTrait,
    SiegeTrait,
    type Strike,
} from "../../src/siege/traits";
import { planWave } from "../../src/siege/waves";
import { onField, type OpenedSiege } from "./room";

//  The elements in a test: a warden given an element at a level, a monster
//  stood still where the test puts it, and a gun's hit landed on it as the
//  room lands a judged shot, between two steps.

/** Gives `warden` `element` at `level`: her first where she holds none,
 *  her second where she holds one. */
export function armWarden(warden: Entity, element: Element, level = 1) {
    takeElement(warden, element);
    addElementPoints(warden, element, levelPoints[level]);
}

/** A monster the test stands: its kind, where on the field, and its
 *  health, which the test sets so a hit never kills it by accident. */
interface StoodMonster {
    kind: MonsterKind;
    x?: number;
    z?: number;
    health?: number;
    /** Whether it walks at its kind's speed; it stands still otherwise. */
    walks?: boolean;
}

/** Stands a wave-1 monster at `x`, `z` on the field: still, unless the
 *  test lets it walk. */
export function standMonster(
    world: World,
    { kind, x = 0, z = -8, health, walks = false }: StoodMonster,
) {
    const monster = spawnMonster(world, {
        kind,
        position: onField(x, z),
        plan: planWave(1, 1),
    });
    if (health !== undefined)
        monster.set(HealthTrait, { current: health, maximum: health });
    if (!walks) {
        monster.set(MonsterTrait, { speed: 0 });
        monster.set(ChaseTrait, { speed: 0 });
    }
    return monster;
}

/** The guns a test fires, by the name the room knows each by. */
export const guns: Record<string, WeaponSettings> = {
    [blasterWeapon]: blasterSettings,
    [lanceWeapon]: lanceSettings,
};

/** A hit a test lands: on which monster, whose, with which gun, and for
 *  how much health. */
interface LandedHit {
    monster: Entity;
    warden: Entity;
    weapon?: string;
    amount?: number;
}

/** Lands a gun's hit on the monster as the room's judge does, between two
 *  steps, and runs the step that reads it. */
export function landHit(
    game: OpenedSiege,
    { monster, warden, weapon = blasterWeapon, amount = 0 }: LandedHit,
) {
    dealDamage(requireAuthority(game.world), monster, {
        amount,
        source: warden,
        weapon,
        data: guns[weapon].data ?? null,
    });
    game.step(fixedStepSeconds);
}

/** Lands `count` hits, a step apart. */
export function landHits(game: OpenedSiege, hit: LandedHit, count: number) {
    for (let index = 0; index < count; index++) landHit(game, hit);
}

/** The strikes the last step drew on the siege. */
export function readStrikes(world: World): Strike[] {
    return (
        world.queryFirst(SiegeTrait)?.get(ElementStrikesTrait)?.strikes ?? []
    );
}

/** The room's working record of a monster's elements. */
export function readAfflictionsOf(monster: Entity) {
    const state = monster.get(AfflictionsTrait);
    if (!state) throw new Error("The monster has no elements on it.");
    return state;
}

/** Health a monster has left. */
export function readHealth(monster: Entity) {
    return monster.get(HealthTrait)?.current ?? 0;
}
