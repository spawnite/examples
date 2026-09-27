import { createQuery, type Entity, type TraitRecord, type World } from "koota";
import { Vector3 } from "three";
import {
    findEntity,
    Ground,
    readEach,
    readField,
    Transform,
    type StepOptions,
} from "@spawnite/engine/core";
import { closeOffers, dealCards, dropCards } from "./cards";
import { raiseDownedWardens, restoreWarden } from "./downs";
import { spawnMonster } from "./monsters";
import { drawIndex, drawRandom } from "./random";
import {
    BoltTrait,
    CoinTrait,
    MonsterKind,
    MonsterTrait,
    SiegePhase,
    SiegeState,
    SiegeTrait,
    WardenTrait,
} from "./traits";
import {
    queryStandingWardens,
    queryWardens,
    standWarden,
    wardens,
} from "./wardens";
import {
    arenaMetres,
    breatherSeconds,
    drawElite,
    drawMonsterKind,
    firstBreatherSeconds,
    lobbySeconds,
    planWave,
    spawnMetres,
    standingCap,
} from "./waves";

//  The run: the breathers, the waves and their spawning, on the one siege
//  entity the room spawns on its first step, and the run's end and the
//  next run's start.

/** The siege's record as the step reads and writes it. */
type Siege = TraitRecord<typeof SiegeState>;

/** The siege's record and the step's length, for a phase's work. */
interface SiegeStep {
    siege: Siege;
    deltaSeconds: number;
}

const standingMonsters = createQuery(MonsterTrait);
const lyingCoins = createQuery(CoinTrait);
const flyingBolts = createQuery(BoltTrait);
const sieges = createQuery(SiegeState);
const grounds = createQuery(Ground);
/** Draws a spawn place tries before it settles for one nearer a warden. */
const spawnTries = 6;

//  Written in place for each spawn.
const spot = new Vector3();

/** Whether `spot` stands inside the arena and no nearer any warden than a
 *  spawn's least distance. */
function isFairSpawn(world: World) {
    if (Math.hypot(spot.x, spot.z) > arenaMetres) return false;
    for (const warden of queryStandingWardens(world)) {
        const feet = warden.get(Transform);
        if (
            feet &&
            Math.hypot(feet.x - spot.x, feet.z - spot.z) < spawnMetres.least
        )
            return false;
    }
    return true;
}

/** Puts `spot` on a ring round a random standing warden, inside the arena,
 *  standing on the ground; false where no warden stands. */
function placeSpawn(world: World, siege: Siege) {
    const standing = queryStandingWardens(world);
    if (standing.length === 0) return false;
    for (let attempt = 0; attempt < spawnTries; attempt++) {
        const feet = standing[drawIndex(siege, standing.length)].get(Transform);
        if (!feet) continue;
        const angle = drawRandom(siege) * Math.PI * 2;
        const distance =
            spawnMetres.least +
            drawRandom(siege) * (spawnMetres.most - spawnMetres.least);
        spot.set(
            feet.x + Math.sin(angle) * distance,
            0,
            feet.z + Math.cos(angle) * distance,
        );
        if (isFairSpawn(world)) break;
        //  The last try stands inside the arena, however near.
        if (
            attempt === spawnTries - 1 &&
            Math.hypot(spot.x, spot.z) > arenaMetres
        )
            spot.setLength(arenaMetres);
    }
    const surface = world.queryFirst(Ground)?.get(Ground)?.surface;
    spot.y = surface?.getHeightAt(spot) ?? 0;
    return true;
}

/** Spawns the wave's next batch, as many as the batch, what is left of the
 *  wave and the standing cap allow, and says when the one after is due.
 *  A boss rises first, and on its own; an elite is drawn for each of the
 *  rest. */
function spawnBatch(world: World, siege: Siege) {
    const plan = planWave(siege.wave, queryWardens(world).length);
    const room = standingCap - world.query(standingMonsters).length;
    const count = Math.min(
        siege.bosses > 0 ? 1 : plan.batch,
        siege.toSpawn,
        room,
    );
    for (let index = 0; index < count; index++) {
        if (!placeSpawn(world, siege)) break;
        const boss = siege.bosses > 0;
        spawnMonster(world, {
            kind: boss
                ? MonsterKind.Colossus
                : drawMonsterKind(siege, siege.wave),
            position: spot,
            plan,
            elite: boss ? undefined : drawElite(siege, siege.wave),
        });
        if (boss) siege.bosses--;
        siege.toSpawn--;
    }
    siege.spawnSeconds = plan.interval;
}

/** Takes every bolt still flying out of the world: a held wave hurts
 *  nobody. */
function clearBolts(world: World) {
    for (const bolt of world.query(flyingBolts)) bolt.destroy();
}

/** Takes the run's monsters, coins and bolts out of the world, as a run
 *  that empties or starts over does. */
function clearRun(world: World) {
    for (const monster of world.query(standingMonsters)) monster.destroy();
    for (const coin of world.query(lyingCoins)) coin.destroy();
    clearBolts(world);
}

/** A seed for a new run: the room's own draw, so no two runs play alike. */
function drawSeed() {
    return Math.floor(Math.random() * 2 ** 31);
}

/** Starts a run afresh: every warden on her feet at her place by the fire,
 *  with no card and nothing earned, and the first breather counting
 *  down. */
function startRun(world: World, siege: Siege) {
    clearRun(world);
    for (const warden of queryWardens(world)) {
        dropCards(warden);
        restoreWarden(world, warden);
        standWarden(world, warden);
    }
    siege.phase = SiegePhase.Breather;
    siege.wave = 0;
    siege.secondsLeft = firstBreatherSeconds;
    siege.toSpawn = 0;
    siege.bosses = 0;
    siege.seed = drawSeed();
}

/** Counts the breather down, and opens the next wave when it runs out,
 *  with a card for each warden who took none. */
function restBetweenWaves(world: World, { siege, deltaSeconds }: SiegeStep) {
    siege.secondsLeft = Math.max(0, siege.secondsLeft - deltaSeconds);
    if (siege.secondsLeft > 0) return;
    closeOffers(world, siege);
    siege.phase = SiegePhase.Fight;
    siege.wave++;
    const plan = planWave(siege.wave, queryWardens(world).length);
    siege.toSpawn = plan.count;
    siege.bosses = plan.bosses;
    siege.spawnSeconds = 0;
}

/** Metres past the arena's edge, or below the ground, at which a monster
 *  has strayed where no warden can reach it. */
const strayMetres = 8;

/** Takes out each monster that strayed off the field, pushed into the
 *  trees or through the ground, and spawns it again, so one no warden can
 *  reach never holds the wave; a boss rises again as a boss. */
function recallStrays(world: World, siege: Siege) {
    const ground = findEntity(world, grounds);
    const surface =
        ground === undefined ? undefined : readField(ground, Ground, "surface");
    readEach(world, standingMonsters, ([settings], monster) => {
        const at = monster.get(Transform);
        if (!at) return;
        const height = surface?.getHeightAt(at) ?? 0;
        if (
            Math.hypot(at.x, at.z) <= arenaMetres + strayMetres &&
            at.y >= height - strayMetres
        )
            return;
        monster.destroy();
        siege.toSpawn++;
        if (settings.kind === MonsterKind.Colossus) siege.bosses++;
    });
}

/** Spawns the wave's next batch when it is due, and holds the wave once
 *  all of it has spawned and fallen: the breather, the downed back up, and
 *  three cards for each warden. */
function fightWave(world: World, { siege, deltaSeconds }: SiegeStep) {
    recallStrays(world, siege);
    siege.spawnSeconds -= deltaSeconds;
    if (siege.toSpawn > 0 && siege.spawnSeconds <= 0) spawnBatch(world, siege);
    if (siege.toSpawn > 0 || findEntity(world, standingMonsters) !== undefined)
        return;
    siege.phase = SiegePhase.Breather;
    siege.secondsLeft = breatherSeconds;
    clearBolts(world);
    raiseDownedWardens(world);
    dealCards(world, siege);
}

/** How many wardens in the room have taken their places. */
function countReady(world: World) {
    let ready = 0;
    readEach(world, wardens, ([survivor]) => {
        if (survivor.ready) ready++;
    });
    return ready;
}

/** Whether `warden` has yet to take her place. */
function isUnready(warden: Entity) {
    return !readField(warden, WardenTrait, "ready");
}

/** Starts the next run once every warden has taken her place, or once the
 *  wait the first to take hers started runs out: before the first run, and
 *  on the end screen, so one warden away from her keys holds nobody. */
function gatherWardens(world: World, { siege, deltaSeconds }: SiegeStep) {
    const ready = countReady(world);
    if (ready === 0) {
        siege.secondsLeft = 0;
        return;
    }
    if (findEntity(world, wardens, isUnready) === undefined) {
        startRun(world, siege);
        return;
    }
    if (siege.secondsLeft <= 0) siege.secondsLeft = lobbySeconds;
    siege.secondsLeft = Math.max(0, siege.secondsLeft - deltaSeconds);
    if (siege.secondsLeft === 0) startRun(world, siege);
}

/** Moves the run on by a step: starts it once the wardens take their
 *  places, counts the breather down, opens and spawns each wave, holds it once its last
 *  monster falls, ends the run once every warden is down, and starts the
 *  next once they all ask to. An empty room waits again. */
export function advanceSiege(world: World, { deltaSeconds }: StepOptions) {
    const entity =
        findEntity(world, sieges) ??
        world.spawn(SiegeState({ seed: drawSeed() }), SiegeTrait);
    const siege = entity.get(SiegeState);
    if (!siege) return;
    if (findEntity(world, wardens) === undefined) {
        if (siege.phase !== SiegePhase.Waiting) {
            clearRun(world);
            siege.phase = SiegePhase.Waiting;
            siege.wave = 0;
            siege.secondsLeft = 0;
            entity.set(SiegeState, siege);
            showSiege(entity, siege);
        }
        return;
    }
    const running =
        siege.phase === SiegePhase.Breather || siege.phase === SiegePhase.Fight;
    if (running && queryStandingWardens(world).length === 0) {
        siege.phase = SiegePhase.Over;
        siege.best = Math.max(siege.best, siege.wave);
        siege.secondsLeft = 0;
        //  Nothing moves behind the end screen: a warden who joins there
        //  meets no monster and picks up no coin.
        clearRun(world);
    }
    const step = { siege, deltaSeconds };
    switch (siege.phase) {
        case SiegePhase.Waiting:
            gatherWardens(world, step);
            break;
        case SiegePhase.Breather:
            restBetweenWaves(world, step);
            break;
        case SiegePhase.Fight:
            fightWave(world, step);
            break;
        case SiegePhase.Over:
            gatherWardens(world, step);
            break;
    }
    entity.set(SiegeState, siege);
    showSiege(entity, siege);
}

/** Sets what pages draw of the run, only where it changed: a set wakes
 *  every component that reads it, on the room's thread as on each page. */
function showSiege(entity: Entity, siege: Siege) {
    const shown = entity.get(SiegeTrait);
    const secondsLeft = Math.ceil(siege.secondsLeft);
    if (
        shown &&
        shown.phase === siege.phase &&
        shown.wave === siege.wave &&
        shown.secondsLeft === secondsLeft &&
        shown.toSpawn === siege.toSpawn &&
        shown.best === siege.best
    )
        return;
    entity.set(SiegeTrait, {
        phase: siege.phase,
        wave: siege.wave,
        secondsLeft,
        toSpawn: siege.toSpawn,
        best: siege.best,
    });
}
