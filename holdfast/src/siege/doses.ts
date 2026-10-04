import { createQuery, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    DamagedTrait,
    dealDamage,
    requireAuthority,
    HealthTrait,
    random,
    readEach,
    readWeaponNumber,
    TransformTrait,
    updateEach,
    WeaponNumber,
    WeaponsTrait,
    type StepOptions,
} from "@spawnite/engine/core";
import {
    addBurn,
    addChill,
    type Dose,
    findMonstersNear,
    measureChest,
} from "./afflictions";
import {
    arcsPerDose,
    Element,
    findReaction,
    Mark,
    markSettleSeconds,
    ownMarkSettleSeconds,
    readElementLevel,
    readElementPower,
    readHeldElements,
    stormLevels,
    thunderhead,
    topLevel,
} from "./elements";
import { setOffReaction } from "./reactions";
import { addStrike, pushPoint } from "./strikes";
import {
    AfflictionsTrait,
    FiringTrait,
    MonsterTrait,
    StrikeKind,
    WardenElementsTrait,
} from "./traits";

//  Each hit of a warden's gun carries a dose of her elements to the monster
//  it lands on. The room reads a step's hits off each monster's `DamagedTrait`,
//  sets off a reaction where one of her elements meets a mark built by a
//  different one, then lays each element's own effect: Storm's arc, Ember's
//  burn, Frost's chill. Storm's capstone, Thunderhead, runs off the same
//  hits.

declare module "@spawnite/engine" {
    interface Register {
        /** What one pull of a gun applies of its shooter's elements,
         *  shared among its pellets: the blaster's six pulls a second
         *  apply one whole dose, as one shot of a heavy gun does. */
        hitData: { dose: number };
    }
}

/** A dose landing: on which monster, whose, and how much. */
export interface ElementHit {
    monster: Entity;
    warden: Entity;
    dose: number;
    /** The one element it carries, where not all of hers. */
    only?: Element;
}

//  A step's element hits, gathered before any lands, so an arc's own hits
//  never join the list being read.
const hitMonsters: Entity[] = [];
const hitWardens: Entity[] = [];
const hitDoses: number[] = [];
let hitCount = 0;
//  The elements of the warden whose hit lands, refilled for each.
const held: Element[] = [];
//  The dose each element of a hit lays, made for the first and written in
//  place for each after.
let laid: Dose | undefined;
//  Written in place for each arc.
const link = new Vector3();
const arcFrom = new Vector3();

/** A pull's dose: the gun it came from, by name, who fired it, and the
 *  dose its hit carries. */
interface PulledDose {
    weapon: string;
    shooter: Entity;
    dose: number;
}

/** A pellet's share of its pull's dose: the pull's dose over the pellets
 *  she fires it as, so a gun of five pellets lays a fifth with each, and a
 *  card that adds pellets spreads the dose rather than adding to it. */
function readPelletDose(world: World, { weapon, shooter, dose }: PulledDose) {
    const settings = world.get(WeaponsTrait)?.get(weapon);
    if (!settings) return dose;
    return dose / readWeaponNumber(settings, shooter, WeaponNumber.Pellets);
}

//  The monsters one arc passed through, refilled for each.
const arced: Entity[] = [];
const placedMonsters = createQuery(MonsterTrait, HealthTrait, TransformTrait);

/** The monster with health left nearest `link` within `metres` the arc
 *  has not passed through, or null. */
function findNextArcTarget(world: World, metres: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDistance = metres;
    readEach(world, placedMonsters, ([, health, feet], monster) => {
        if (health.current <= 0 || arced.includes(monster)) return;
        const distance = Math.hypot(feet.x - link.x, feet.z - link.z);
        if (distance <= nearestDistance) {
            nearest = monster;
            nearestDistance = distance;
        }
    });
    return nearest;
}

/** Storm's dose: at a chance of its dose, an arc leaps from the monster
 *  through the monsters nearest it, each from the last, and each takes its
 *  damage; a dose of more than one arc's arcs that much harder. The arc is
 *  Storm on each monster it reaches, so it sets off a reaction on one
 *  wearing another element's mark. */
function arcFromMonster(world: World, hit: ElementHit, level: number) {
    const chance = Math.min(1, hit.dose * arcsPerDose);
    if (chance < 1 && random(world) >= chance) return;
    const feet = hit.monster.get(TransformTrait);
    if (!feet) return;
    const { jumps, metres, damage } = stormLevels[level - 1];
    const amount =
        damage *
        Math.max(1, hit.dose * arcsPerDose) *
        readElementPower(hit.warden);
    arcFrom.copy(feet);
    link.copy(feet);
    arced.length = 0;
    arced.push(hit.monster);
    const points: number[] = [];
    pushPoint(points, arcFrom, measureChest(hit.monster));
    for (let jump = 0; jump < jumps; jump++) {
        const next = findNextArcTarget(world, metres);
        const at = next?.get(TransformTrait);
        if (!next || !at) break;
        arced.push(next);
        link.copy(at);
        pushPoint(points, link, measureChest(next));
        dealDamage(requireAuthority(world), next, {
            amount,
            source: hit.warden,
        });
    }
    if (arced.length > 1)
        addStrike(world, { kind: StrikeKind.Arc, by: hit.warden, points });
    //  After the arc is drawn, so a reaction's strike draws over it: each
    //  marked monster it reached is Storm on its mark.
    for (let index = 1; index < arced.length; index++)
        reactToMark(world, {
            monster: arced[index],
            warden: hit.warden,
            elements: stormAlone,
        });
}

/** Notes a Storm hit for Thunderhead: she is firing, at this monster,
 *  where it stands. */
function noteStormHit(hit: ElementHit) {
    if (!hit.warden.has(FiringTrait)) hit.warden.add(FiringTrait);
    const firing = hit.warden.get(FiringTrait);
    const feet = hit.monster.get(TransformTrait);
    if (!firing || !feet) return;
    firing.idleSeconds = 0;
    firing.target = hit.monster;
    firing.x = feet.x;
    firing.y = feet.y;
    firing.z = feet.z;
}

/** Something that may set off a reaction: the monster, the warden whose
 *  hit or arc it is, and the elements it carries. */
interface Reacting {
    monster: Entity;
    warden: Entity;
    elements: readonly Element[];
}

/** Storm alone, as an arc and a bolt carry it. */
const stormAlone: readonly Element[] = [Element.Storm];

/** Sets off the reaction the first of `elements` that differs from the
 *  monster's mark makes, where it wears one that has settled and is not
 *  resting. */
function reactToMark(world: World, { monster, warden, elements }: Reacting) {
    //  A factory trait: `get` hands back the record, and adds none.
    const state = monster.get(AfflictionsTrait);
    if (!state || state.mark === Mark.None || state.restSeconds > 0) return;
    const settle =
        state.markBy === warden ? ownMarkSettleSeconds : markSettleSeconds;
    if (state.markAge < settle) return;
    const mark = state.mark === Mark.Frozen ? Mark.Frozen : Mark.Blazing;
    for (const element of elements) {
        const reaction = findReaction(element, mark);
        if (!reaction) continue;
        setOffReaction(world, {
            monster,
            reaction,
            by: warden,
            builder: state.markBy,
            power: readElementPower(warden),
        });
        return;
    }
}

/** Lands one dose of the warden's elements on the monster: first a
 *  reaction, where one of her elements differs from the mark the monster
 *  wears and it is not resting, then each element's own effect. A mark
 *  this hit builds waits for the next hit to react. */
export function strikeWithElements(world: World, hit: ElementHit) {
    if (hit.only) {
        held.length = 0;
        held.push(hit.only);
    } else readHeldElements(hit.warden, held);
    if (held.length === 0) return;
    reactToMark(world, {
        monster: hit.monster,
        warden: hit.warden,
        elements: held,
    });
    for (const element of held) {
        const level = Math.max(1, readElementLevel(hit.warden, element));
        if (element === Element.Storm) {
            if (!hit.only) noteStormHit(hit);
            arcFromMonster(world, hit, level);
            continue;
        }
        laid ??= { ...hit, level };
        laid.monster = hit.monster;
        laid.warden = hit.warden;
        laid.dose = hit.dose;
        laid.level = level;
        if (element === Element.Ember) addBurn(world, laid);
        else addChill(world, laid);
    }
}

const damagedMonsters = createQuery(MonsterTrait, DamagedTrait);

/** Lands the dose of every hit a warden's gun dealt a monster since the
 *  last step, in the order they landed. */
export function applyElementHits(world: World) {
    hitCount = 0;
    readEach(world, damagedMonsters, ([, damaged], monster) => {
        for (const { data, source, weapon } of damaged.hits) {
            if (!data?.dose || !source?.has(WardenElementsTrait) || !weapon)
                continue;
            hitMonsters[hitCount] = monster;
            hitWardens[hitCount] = source;
            hitDoses[hitCount] = readPelletDose(world, {
                weapon,
                shooter: source,
                dose: data.dose,
            });
            hitCount++;
        }
    });
    for (let index = 0; index < hitCount; index++) {
        const monster = hitMonsters[index];
        if (!monster.isAlive()) continue;
        strikeWithElements(world, {
            monster,
            warden: hitWardens[index],
            dose: hitDoses[index],
        });
    }
}

const firingWardens = createQuery(FiringTrait);
//  Written in place for each bolt.
const boltAt = new Vector3();

/** Of `monsters`, the one whose feet stand nearest `boltAt`, or null. */
function findNearest(monsters: readonly Entity[]): Entity | null {
    let nearest: Entity | null = null;
    let nearestDistance = Infinity;
    for (const monster of monsters) {
        const feet = monster.get(TransformTrait);
        if (!feet) continue;
        const distance = Math.hypot(feet.x - boltAt.x, feet.z - boltAt.z);
        if (distance < nearestDistance) {
            nearest = monster;
            nearestDistance = distance;
        }
    }
    return nearest;
}

/** Whether `monster` still stands with health left. */
function isStanding(monster: Entity | null): monster is Entity {
    return (
        monster !== null &&
        monster.isAlive() &&
        (monster.get(HealthTrait)?.current ?? 0) > 0
    );
}

/** A bolt from the sky on `boltAt`: every monster near it takes its
 *  damage, and the one it strikes a whole Storm dose, which arcs and sets
 *  off a reaction as a hit does: the monster she last hit, or where that
 *  one fell, the monster nearest the place. */
function dropBolt(world: World, warden: Entity, target: Entity | null) {
    const amount = thunderhead.damage * readElementPower(warden);
    const near = findMonstersNear(world, boltAt, thunderhead.metres);
    const struck = isStanding(target) ? target : findNearest(near);
    for (const monster of near)
        dealDamage(requireAuthority(world), monster, {
            amount,
            source: warden,
        });
    const points: number[] = [];
    pushPoint(points, boltAt);
    addStrike(world, { kind: StrikeKind.Thunderhead, by: warden, points });
    if (struck)
        strikeWithElements(world, {
            monster: struck,
            warden,
            dose: 1,
            only: Element.Storm,
        });
}

/** Thunderhead, Storm's capstone: while a warden who holds it fires, a
 *  bolt falls every few seconds on the monster she last hit, or where it
 *  stood when her hit brought it down. */
export function dropThunderheads(world: World, { deltaSeconds }: StepOptions) {
    updateEach(world, firingWardens, ([firing], warden) => {
        firing.idleSeconds += deltaSeconds;
        firing.boltSeconds = Math.max(0, firing.boltSeconds - deltaSeconds);
        if (
            firing.boltSeconds > 0 ||
            firing.idleSeconds > thunderhead.firingSeconds ||
            readElementLevel(warden, Element.Storm) < topLevel
        )
            return;
        firing.boltSeconds = thunderhead.everySeconds;
        const feet = isStanding(firing.target)
            ? firing.target.get(TransformTrait)
            : undefined;
        if (feet) boltAt.copy(feet);
        else boltAt.set(firing.x, firing.y, firing.z);
        dropBolt(world, warden, firing.target);
    });
}
