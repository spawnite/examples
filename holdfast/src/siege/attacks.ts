import { createQuery, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    Body,
    ChaseTrait,
    defaultWalkerBody,
    readEach,
    readField,
    Transform,
    updateEach,
    type StepOptions,
} from "@spawnite/engine/core";
import { findNearestWarden, mercySeconds } from "./monsters";
import {
    BoltFlight,
    BoltTrait,
    Mercy,
    MonsterTrait,
    SlamClock,
    SlamTrait,
    Spit,
    WardenTrait,
} from "./traits";
import { queryStandingWardens } from "./wardens";
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
    return warden.get(Body) ?? defaultWalkerBody;
}

/** A blow a warden takes from a slam or a bolt, and whether her breath
 *  after the last blow spares her it. */
interface Blow {
    warden: Entity;
    amount: number;
    heedsMercy: boolean;
}

/** Takes the blow's health from her, unless her breath spares her it, and
 *  starts her breath again, as a claw's blow does. A slam is not spared:
 *  its ring is the warning, and a claw just before it must not cancel it. */
function hurtWarden({ warden, amount, heedsMercy }: Blow) {
    const health = readField(warden, WardenTrait, "health");
    if (health === undefined) return;
    if (heedsMercy && (readField(warden, Mercy, "seconds") ?? 0) > 0) return;
    warden.set(WardenTrait, { health: Math.max(0, health - amount) });
    if (!warden.has(Mercy)) warden.add(Mercy);
    warden.set(Mercy, { seconds: mercySeconds });
}

const colossi = createQuery(SlamClock, SlamTrait, MonsterTrait, Transform);

/** Lands a colossus's slam: every standing warden inside its ring, level
 *  with it, takes its damage, and it walks again. */
function landSlam(world: World, colossus: Entity) {
    const slam = colossus.get(SlamTrait);
    const settings = colossus.get(MonsterTrait);
    const middle = colossus.get(Transform);
    if (!slam || !settings || !middle) return;
    for (const warden of queryStandingWardens(world)) {
        const feet = warden.get(Transform);
        if (!feet) continue;
        const apart = Math.hypot(feet.x - slam.x, feet.z - slam.z);
        if (
            apart <= slam.radius + readBody(warden).radius &&
            Math.abs(feet.y - middle.y) <= slamHeightMetres
        )
            hurtWarden({ warden, amount: settings.damage, heedsMercy: false });
    }
    colossus.set(SlamTrait, { winding: false, slams: slam.slams + 1 });
    colossus.set(ChaseTrait, { speed: settings.speed });
}

/** Winds each colossus up once a standing warden comes within its reach
 *  and its last slam has cooled, standing still while it does, and lands
 *  the slam where it stood once the wind-up has run out. */
export function windUpSlams(world: World, { deltaSeconds }: StepOptions) {
    readEach(world, colossi, ([clock, slam, settings, middle], colossus) => {
        if (slam.winding) {
            const windUp = clock.windUp - deltaSeconds;
            colossus.set(SlamClock, {
                windUp: Math.max(0, windUp),
                cooldown: monsterSettings[settings.kind].cooldown,
            });
            if (windUp <= 0) landSlam(world, colossus);
            return;
        }
        const cooldown = Math.max(0, clock.cooldown - deltaSeconds);
        const { distance } = findNearestWarden(world, middle);
        if (cooldown > 0 || distance > slamTriggerMetres) {
            if (cooldown !== clock.cooldown)
                colossus.set(SlamClock, { cooldown });
            return;
        }
        colossus.set(SlamClock, { windUp: slamWindUpSeconds, cooldown: 0 });
        colossus.set(SlamTrait, {
            winding: true,
            x: middle.x,
            z: middle.z,
            radius: slamRadiusMetres,
        });
        colossus.set(ChaseTrait, { speed: 0 });
    });
}

const spitters = createQuery(Spit, MonsterTrait, Transform);
//  Written in place for each bolt.
const boltFrom = new Vector3();
const boltWay = new Vector3();

/** Has each spitter whose last bolt has cooled spit one at the nearest
 *  standing warden within its reach, where she stands now: one who keeps
 *  moving is missed. */
export function spitBolts(world: World, { deltaSeconds }: StepOptions) {
    readEach(world, spitters, ([spit, settings, mouth], spitter) => {
        const cooldown = Math.max(0, spit.cooldown - deltaSeconds);
        const { warden, distance } = findNearestWarden(world, mouth);
        const feet = warden?.get(Transform);
        if (cooldown > 0 || !feet || distance > spitReachMetres) {
            if (cooldown !== spit.cooldown) spitter.set(Spit, { cooldown });
            return;
        }
        boltFrom.set(mouth.x, mouth.y + boltHeightMetres, mouth.z);
        boltWay
            .set(feet.x - mouth.x, feet.y - mouth.y, feet.z - mouth.z)
            .normalize()
            .multiplyScalar(boltSpeed);
        world.spawn(
            Transform(boltFrom.clone()),
            BoltTrait({ size: boltRadius }),
            BoltFlight({
                x: boltWay.x,
                y: boltWay.y,
                z: boltWay.z,
                damage: settings.damage,
                seconds: boltSeconds,
            }),
        );
        spitter.set(Spit, {
            cooldown: monsterSettings[settings.kind].cooldown,
        });
    });
}

const bolts = createQuery(BoltFlight, Transform);

/** Whether a bolt at `at` has met `warden`'s body. */
function isBoltOn(at: Vector3, warden: Entity) {
    const feet = warden.get(Transform);
    if (!feet) return false;
    const body = readBody(warden);
    return (
        Math.hypot(at.x - feet.x, at.z - feet.z) <= boltRadius + body.radius &&
        at.y >= feet.y - boltRadius &&
        at.y <= feet.y + body.height + boltRadius
    );
}

/** Flies each bolt along its way: the first standing warden it meets
 *  takes its damage and it is gone, as it is once its time runs out.
 *  ponytail: it flies through the stones and the hearth; a cover cast per
 *  bolt would stop it there. */
export function flyBolts(world: World, { deltaSeconds }: StepOptions) {
    updateEach(world, bolts, ([flight, at], bolt) => {
        at.x += flight.x * deltaSeconds;
        at.y += flight.y * deltaSeconds;
        at.z += flight.z * deltaSeconds;
        flight.seconds -= deltaSeconds;
        for (const warden of queryStandingWardens(world))
            if (isBoltOn(at, warden)) {
                hurtWarden({ warden, amount: flight.damage, heedsMercy: true });
                bolt.destroy();
                return;
            }
        if (flight.seconds <= 0) bolt.destroy();
    });
}
