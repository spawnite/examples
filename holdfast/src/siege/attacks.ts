import { createQuery, Not, type Entity, type World } from "koota";
import { Ray, Vector3 } from "three";
import {
    BodyTrait,
    ChaseTrait,
    defaultWalkerBody,
    InvulnerableTrait,
    measureCoverDistance,
    readEach,
    readField,
    RewindTrait,
    TransformTrait,
    updateEach,
    type StepOptions,
} from "@spawnite/engine/core";
import {
    findNearestWarden,
    isInRiseGrace,
    measureStopMetres,
    mercySeconds,
} from "./monsters";
import {
    BoltFlightTrait,
    FrozenTrait,
    BoltTrait,
    MercyTrait,
    MonsterKind,
    MonsterTrait,
    SlamMachine,
    SlamTrait,
    SpitTrait,
    SpitMachine,
    WardenTrait,
} from "./traits";
import { tallyHurt } from "./tally";
import { queryTargetWardens } from "./wardens";
import { monsterSettings } from "./waves";

//  The attacks past a claw: the colossus's slam and the spitter's bolt.

/** Seconds a colossus winds up before its slam lands: long enough to
 *  step out of its ring at a run. */
export const slamWindUpSeconds = 1.3;
/** Metres from the colossus's middle its slam reaches. */
export const slamRadiusMetres = 5.5;
/** Metres from its middle within which a standing warden draws a slam. */
export const slamTriggerMetres = 4.5;
/** Metres a warden may stand above or below a colossus and still be hit. */
const slamHeightMetres = 2.5;

/** Metres from its warden at which a spitter stops walking. */
export const spitRangeMetres = 11;
/** Metres from its warden within which a spitter spits. */
export const spitReachMetres = 16;
/** Metres a second a bolt flies: slow enough to see coming, so a warden
 *  who steps aside is missed. */
export const boltSpeed = 7;
/** Seconds a bolt flies before it fades. */
export const boltSeconds = 3.2;
/** Metres across a bolt's middle, and above the ground it flies. */
export const boltRadius = 0.35;
export const boltHeightMetres = 1.1;

/** A standing warden's body, as a slam or a bolt measures it. */
function readBody(warden: Entity) {
    return warden.get(BodyTrait) ?? defaultWalkerBody;
}

/** A blow a warden takes from a slam or a bolt, and whether her breath
 *  after the last blow spares her it. */
interface Blow {
    world: World;
    warden: Entity;
    amount: number;
    /** The kind that struck it, which the run's tally counts. */
    kind: MonsterKind;
    heedsMercy: boolean;
}

/** Takes the blow's health from her, unless her breath spares her it, and
 *  starts her breath again, as a claw's blow does. A slam is not spared:
 *  its ring is the warning, and a claw just before it must not cancel it.
 *  An `InvulnerableTrait` warden takes none, as the engine's damage spares one. */
function hurtWarden({ world, warden, amount, kind, heedsMercy }: Blow) {
    const health = readField(warden, WardenTrait, "health");
    if (health === undefined || isInRiseGrace(warden)) return;
    if (heedsMercy && (readField(warden, MercyTrait, "seconds") ?? 0) > 0)
        return;
    tallyHurt(world, { amount, kind });
    if (warden.has(InvulnerableTrait)) return;
    warden.set(WardenTrait, { health: Math.max(0, health - amount) });
    if (!warden.has(MercyTrait)) warden.add(MercyTrait);
    warden.set(MercyTrait, { seconds: mercySeconds });
}

//  A frozen monster holds its wind-up and its spit where they stood.
const colossi = createQuery(
    SlamMachine.trait,
    SlamTrait,
    MonsterTrait,
    TransformTrait,
    Not(FrozenTrait),
);

/** Lands a colossus's slam: every warden it may hurt inside its ring, level
 *  with it, takes its damage, and it walks again. */
function landSlam(world: World, colossus: Entity) {
    const slam = colossus.get(SlamTrait);
    const settings = colossus.get(MonsterTrait);
    const middle = colossus.get(TransformTrait);
    if (!slam || !settings || !middle) return;
    for (const warden of queryTargetWardens(world)) {
        const feet = warden.get(TransformTrait);
        if (!feet) continue;
        const apart = Math.hypot(feet.x - slam.x, feet.z - slam.z);
        if (
            apart <= slam.radius + readBody(warden).radius &&
            Math.abs(feet.y - middle.y) <= slamHeightMetres
        )
            hurtWarden({
                world,
                warden,
                amount: settings.damage,
                kind: settings.kind,
                heedsMercy: false,
            });
    }
    colossus.set(SlamTrait, { winding: false, slams: slam.slams + 1 });
    colossus.set(ChaseTrait, { speed: settings.speed });
}

/** Winds each colossus up once a standing warden comes within its reach
 *  and its last slam has cooled, standing still while it does, and lands
 *  the slam where it stood once the wind-up has run out. */
export function windUpSlams(world: World, { deltaSeconds }: StepOptions) {
    //  The room's step, which a page's clock estimates, so a page fills the
    //  ring from the step the wind-up began on.
    const step = world.get(RewindTrait)?.step ?? 0;
    readEach(world, colossi, ([clock, slam, settings, middle], colossus) => {
        if (slam.winding) {
            //  A freeze held the wind-up: its start moves on by the steps
            //  it held, on the first step after.
            const began = step - Math.round(clock.waited / deltaSeconds);
            if (colossus.has(SlamMachine.is.landing)) {
                landSlam(world, colossus);
                SlamMachine.send(colossus, "LANDED");
            } else if (began !== slam.windUpStep)
                colossus.set(SlamTrait, { windUpStep: began });
            return;
        }
        if (!colossus.has(SlamMachine.is.ready)) return;
        const { distance } = findNearestWarden(world, middle);
        if (distance > slamTriggerMetres) return;
        colossus.set(SlamMachine.trait, {
            windUp: slamWindUpSeconds,
            cooldown: monsterSettings[settings.kind].cooldown,
        });
        SlamMachine.send(colossus, "WIND");
        colossus.set(SlamTrait, {
            winding: true,
            x: middle.x,
            z: middle.z,
            radius: slamRadiusMetres,
            windUpStep: step,
        });
        colossus.set(ChaseTrait, { speed: 0 });
    });
}

const spitters = createQuery(
    SpitMachine.trait,
    MonsterTrait,
    TransformTrait,
    Not(FrozenTrait),
);
const sighting = createQuery(
    SpitTrait,
    ChaseTrait,
    BodyTrait,
    TransformTrait,
    Not(FrozenTrait),
);
//  The line from a spitter's middle to hers, written in place for each
//  spitter.
const sight = { ray: new Ray(), range: 0 };

/** A spitter at `feet`, its body's height, and the warden it looks at. */
interface SpitterSight {
    feet: Vector3;
    height: number;
    warden: Entity;
}

/** Whether nothing that stops a shot, the ground, a stone or the hearth,
 *  stands between the spitter's middle and the warden's: where it holds,
 *  her shot at its body lands as its bolt at hers can. */
function canSpitterSee(world: World, { feet, height, warden }: SpitterSight) {
    const hers = warden.get(TransformTrait);
    if (!hers) return false;
    sight.ray.origin.set(feet.x, feet.y + height / 2, feet.z);
    sight.ray.direction.set(
        hers.x - feet.x,
        hers.y + readBody(warden).height / 2 - sight.ray.origin.y,
        hers.z - feet.z,
    );
    sight.range = sight.ray.direction.length();
    if (sight.range === 0) return true;
    sight.ray.direction.divideScalar(sight.range);
    return measureCoverDistance(world, sight) === Infinity;
}

/** Has each spitter within its reach of the nearest warden look for her,
 *  and hold at its range only where it sees her: with a hill or a stone
 *  between them it walks on, as a clawed monster does, until it sees her
 *  or reaches her. One that held without sight would stand beyond her
 *  shots, and she beyond its bolts, for as long as she stood. Runs before
 *  the chase, which reads its reach. */
export function sightSpitters(world: World) {
    readEach(world, sighting, ([spit, chase, body, feet], spitter) => {
        const { warden, distance } = findNearestWarden(world, feet);
        const sees =
            warden !== null &&
            distance <= spitReachMetres &&
            canSpitterSee(world, { feet, height: body.height, warden });
        if (sees !== spit.sees) spitter.set(SpitTrait, { sees });
        const reach = sees ? spitRangeMetres : measureStopMetres(body.radius);
        if (reach !== chase.reach) spitter.set(ChaseTrait, { reach });
    });
}
//  Written in place for each bolt.
const boltFrom = new Vector3();
const boltWay = new Vector3();

/** Has each spitter whose last bolt has cooled spit one at the nearest
 *  standing warden within its reach that it sees, where she stands now:
 *  one who keeps moving is missed. */
export function spitBolts(world: World, { deltaSeconds }: StepOptions) {
    readEach(world, spitters, ([, settings, mouth], spitter) => {
        if (!spitter.has(SpitMachine.is.ready)) return;
        const { warden, distance } = findNearestWarden(world, mouth);
        const feet = warden?.get(TransformTrait);
        if (
            !feet ||
            !spitter.get(SpitTrait)?.sees ||
            distance > spitReachMetres
        )
            return;
        boltFrom.set(mouth.x, mouth.y + boltHeightMetres, mouth.z);
        boltWay
            .set(feet.x - mouth.x, feet.y - mouth.y, feet.z - mouth.z)
            .normalize()
            .multiplyScalar(boltSpeed);
        world.spawn(
            TransformTrait(boltFrom.clone()),
            BoltTrait({ size: boltRadius }),
            BoltFlightTrait({
                x: boltWay.x,
                y: boltWay.y,
                z: boltWay.z,
                damage: settings.damage,
                seconds: boltSeconds,
            }),
        );
        spitter.set(SpitMachine.trait, {
            cooldown: monsterSettings[settings.kind].cooldown,
        });
        SpitMachine.send(spitter, "SPAT");
    });
}

const bolts = createQuery(BoltFlightTrait, TransformTrait);

/** Whether a bolt at `at` has met `warden`'s body. */
function isBoltOn(at: Vector3, warden: Entity) {
    const feet = warden.get(TransformTrait);
    if (!feet) return false;
    const body = readBody(warden);
    return (
        Math.hypot(at.x - feet.x, at.z - feet.z) <= boltRadius + body.radius &&
        at.y >= feet.y - boltRadius &&
        at.y <= feet.y + body.height + boltRadius
    );
}

/** Flies each bolt along its way: the first warden it may hurt that it meets
 *  takes its damage and it is gone, as it is once its time runs out.
 *  ponytail: it flies through the stones and the hearth; a cover cast per
 *  bolt would stop it there. */
export function flyBolts(world: World, { deltaSeconds }: StepOptions) {
    updateEach(world, bolts, ([flight, at], bolt) => {
        at.x += flight.x * deltaSeconds;
        at.y += flight.y * deltaSeconds;
        at.z += flight.z * deltaSeconds;
        flight.seconds -= deltaSeconds;
        for (const warden of queryTargetWardens(world))
            if (isBoltOn(at, warden)) {
                hurtWarden({
                    world,
                    warden,
                    amount: flight.damage,
                    kind: MonsterKind.Spitter,
                    heedsMercy: true,
                });
                bolt.destroy();
                return;
            }
        if (flight.seconds <= 0) bolt.destroy();
    });
}
