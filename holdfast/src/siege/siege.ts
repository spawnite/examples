import { createQuery, type Entity, type TraitRecord, type World } from "koota";
import { Vector3 } from "three";
import {
    dumpKey,
    findEntity,
    GroundTrait,
    InputTrait,
    randomInt,
    readEach,
    readField,
    TransformTrait,
    type StepOptions,
} from "@spawnite/engine/core";
import {
    closeOffers,
    dealCards,
    drawElement,
    dropCards,
    offerFirstElement,
} from "./cards";
import { clearDeeds, presentAwards } from "./awards";
import { creditCareers, enterCareerRun } from "./career";
import { spawnBurst } from "./effects";
import { keepFirstElement } from "./elements";
import { readLevelCost, resetFire } from "./fire";
import { GunId, holdGun } from "./guns";
import { clearTally } from "./strikes";
import {
    findLoneWarden,
    isGettingUpAlone,
    raiseDownedWardens,
    raiseForWait,
    refillSelfRevives,
    restoreWarden,
} from "./downs";
import {
    canStartWithout,
    gatherWardens,
    isEveryoneReady,
    isReadyAsked,
    leaveRing,
    unreadyWardens,
    watchRing,
} from "./gathering";
import { endShelter, tendLatecomers, welcomeNewcomers } from "./latecomers";
import { LifeMachine } from "./life";
import { findNearestWarden, spawnMonster } from "./monsters";
import {
    isFallen,
    isLastFall,
    PhaseMachine,
    PhaseTrait,
    readSecondsLeft,
} from "./phase";
import { drawIndex, drawRandom } from "./random";
import { findStalledMonsters } from "./stalls";
import {
    AwardsTrait,
    BoltTrait,
    BurstKind,
    EndCause,
    FireTrait,
    FiringTrait,
    LedgerTrait,
    MonsterKind,
    MonsterTrait,
    SiegeStateTrait,
    SiegeTrait,
    SteamTrait,
    WaveName,
} from "./traits";
import {
    isConnected,
    queryStandingWardens,
    queryWardens,
    standWarden,
    wardens,
} from "./wardens";
import {
    arenaMetres,
    bossEvery,
    breatherSeconds,
    drawElite,
    drawMonsterKind,
    firstBreatherSeconds,
    monsterSettings,
    nameWave,
    nightWaves,
    planWave,
    readyBreatherSeconds,
    spawnMetres,
} from "./waves";

//  The run: the breathers, the waves and their spawning, on the one siege
//  entity the room spawns on its first step; dawn once the night's last
//  wave is held, and Endless after it; the run's end and the next run's
//  start.

/** The siege's record as the step reads and writes it. */
type Siege = TraitRecord<typeof SiegeStateTrait>;

/** The siege's entity, its record and the step's length, for a phase's
 *  work. */
interface SiegeStep {
    entity: Entity;
    siege: Siege;
    deltaSeconds: number;
}

const { is } = PhaseMachine;

const standingMonsters = createQuery(MonsterTrait);
const flyingBolts = createQuery(BoltTrait);
const steamClouds = createQuery(SteamTrait);
const sieges = createQuery(SiegeStateTrait);
const grounds = createQuery(GroundTrait);
/** Draws a spawn place tries before it settles for one nearer a warden;
 *  the faced waves try as many in front of her first. */
const spawnTries = 6;
/** Radians apart along its ring the monsters of one batch rise: a
 *  cluster from one rift, which a player reads as one threat. */
const clusterRadians = 0.12;
/** The waves whose batches rise in front of a warden, within
 *  `facedRadians` of where her camera faces where the arena leaves room
 *  there, so a player new to the night sees the first monsters come rather
 *  than taking a blow from behind, and anywhere on her ring otherwise. */
const facedWaves = 2;
const facedRadians = Math.PI / 3;

//  Written in place for each spawn.
const spot = new Vector3();
/** The warden's feet, the angle and the distance of the batch's first
 *  spawn, which the rest of the batch rises beside. */
const cluster = { feet: new Vector3(), angle: 0, distance: 0 };

/** Whether `spot` stands inside the arena and no nearer any warden on her
 *  feet than a spawn's least distance, a dropped one among them, since her
 *  player may come back to her. */
function isFairSpawn(world: World) {
    if (Math.hypot(spot.x, spot.z) > arenaMetres) return false;
    for (const warden of queryWardens(world)) {
        if (warden.has(LifeMachine.is.down)) continue;
        const feet = warden.get(TransformTrait);
        if (
            feet &&
            Math.hypot(feet.x - spot.x, feet.z - spot.z) < spawnMetres.least
        )
            return false;
    }
    return true;
}

/** The angle round `warden` a spawn rises at: anywhere, or in the first
 *  waves in front of where her camera faces, which looks down -z turned
 *  by its heading, for tries of their own before the usual ones, so a
 *  warden facing out from the arena's edge still gets a fair spawn. */
function drawSpawnAngle(siege: Siege, warden: Entity, attempt: number) {
    const heading = warden.get(InputTrait)?.heading;
    const faced = siege.wave <= facedWaves && attempt < spawnTries;
    if (!faced || heading === undefined) return drawRandom(siege) * Math.PI * 2;
    return heading + Math.PI + (drawRandom(siege) * 2 - 1) * facedRadians;
}

/** Puts `spot` on the ring of `feet` at `angle`, `distance` out. */
function placeOnRing(feet: Vector3, angle: number, distance: number) {
    spot.set(
        feet.x + Math.sin(angle) * distance,
        0,
        feet.z + Math.cos(angle) * distance,
    );
}

/** Puts `spot` beside the batch's first spawn, the `member`th along its
 *  ring, turning either way in turn; false where that spot is unfair. */
function placeInCluster(world: World, member: number) {
    const step = Math.ceil(member / 2) * (member % 2 === 1 ? 1 : -1);
    placeOnRing(
        cluster.feet,
        cluster.angle + step * clusterRadians,
        cluster.distance,
    );
    return isFairSpawn(world);
}

/** Puts `spot` on a ring round a random standing warden, inside the arena,
 *  standing on the ground, beside the batch's first where it is not the
 *  first; false where no warden stands. */
function placeSpawn(world: World, siege: Siege, member = 0) {
    const standing = queryStandingWardens(world);
    if (standing.length === 0) return false;
    const clustered = member > 0 && placeInCluster(world, member);
    const tries = siege.wave <= facedWaves ? 2 * spawnTries : spawnTries;
    for (let attempt = 0; !clustered && attempt < tries; attempt++) {
        const warden = standing[drawIndex(siege, standing.length)];
        const feet = warden.get(TransformTrait);
        if (!feet) continue;
        const angle = drawSpawnAngle(siege, warden, attempt);
        const distance =
            spawnMetres.least +
            drawRandom(siege) * (spawnMetres.most - spawnMetres.least);
        placeOnRing(feet, angle, distance);
        cluster.feet.copy(feet);
        cluster.angle = angle;
        cluster.distance = distance;
        if (isFairSpawn(world)) break;
        //  The last try stands inside the arena, however near.
        if (attempt === tries - 1 && Math.hypot(spot.x, spot.z) > arenaMetres)
            spot.setLength(arenaMetres);
    }
    const surface = world.queryFirst(GroundTrait)?.get(GroundTrait)?.surface;
    spot.y = surface?.getHeightAt(spot) ?? 0;
    return true;
}

/** The name of wave `wave` of this run's night. */
function readWaveName(siege: Siege, wave: number) {
    return nameWave(siege.nightSeed, wave);
}

/** The plan of the wave being fought, for the wardens in the room now and
 *  its name. */
function planCurrentWave(world: World, siege: Siege) {
    return planWave(
        siege.wave,
        queryWardens(world).length,
        readWaveName(siege, siege.wave),
    );
}

/** Spawns the wave's next batch, as many as the batch, what is left of the
 *  wave and its standing cap allow, and says when the one after is due.
 *  A boss rises first, and on its own; the rest are of the kinds the wave
 *  sends, and an elite is drawn for each where the wave has elites. */
function spawnBatch(world: World, siege: Siege) {
    const plan = planCurrentWave(world, siege);
    const room = plan.cap - world.query(standingMonsters).length;
    const count = Math.min(
        siege.bosses > 0 ? 1 : plan.batch,
        siege.toSpawn,
        room,
    );
    for (let index = 0; index < count; index++) {
        if (!placeSpawn(world, siege, index)) break;
        const boss = siege.bosses > 0;
        spawnMonster(world, {
            kind: boss
                ? MonsterKind.Colossus
                : drawMonsterKind(siege, siege.wave, plan.mix),
            position: spot,
            plan,
            elite:
                boss || !plan.elites ? undefined : drawElite(siege, siege.wave),
            size: boss ? plan.bossSize : 1,
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

/** Takes the run's monsters, bolts and steam out of the world, as a run
 *  that empties or starts over does. */
function clearRun(world: World) {
    for (const monster of world.query(standingMonsters)) monster.destroy();
    for (const cloud of world.query(steamClouds)) cloud.destroy();
    clearBolts(world);
}

/** A seed for a new run: a draw from the world's random, so no two runs
 *  play alike and a continue of the room draws the same. */
function drawSeed(world: World) {
    return randomInt(world, 0, 2 ** 31 - 1);
}

/** Starts a run afresh at dusk: every warden in the room, ready or not, on
 *  her feet at her place by the fire, with no card, the blaster, and
 *  nothing earned but the element she picked as the wardens gathered, or
 *  one at random where she picked none, the fire back at its first level,
 *  a new night's named waves, and the first breather counting down. */
function startRun(world: World, { entity, siege }: SiegeStep) {
    clearRun(world);
    clearTally(world);
    clearDeeds(world);
    resetFire(world);
    for (const warden of queryWardens(world)) {
        endShelter(warden);
        dropCards(warden);
        holdGun(warden, GunId.Blaster, 0);
        if (warden.has(LedgerTrait))
            warden.set(LedgerTrait, LedgerTrait.schema);
        drawElement(siege, warden);
        keepFirstElement(warden);
        warden.remove(FiringTrait);
        restoreWarden(world, warden);
        standWarden(world, warden);
        leaveRing(warden);
        enterCareerRun(warden);
    }
    entity.set(PhaseTrait, { restSeconds: firstBreatherSeconds });
    PhaseMachine.send(entity, "START");
    siege.wave = 0;
    siege.held = 0;
    siege.toSpawn = 0;
    siege.bosses = 0;
    siege.planned = 0;
    siege.waitedSeconds = 0;
    siege.startAsked = false;
    siege.endless = false;
    siege.cause = EndCause.None;
    siege.seed = drawSeed(world);
    siege.nightSeed = siege.seed;
}

export { lastFallSeconds } from "./phase";

/** Why the run ends at this step: every warden whose player is connected
 *  is down, and none alone gets herself up. None while one stands. */
function readEndCause(world: World) {
    if (queryStandingWardens(world).length > 0 || isGettingUpAlone(world))
        return EndCause.None;
    return findLoneWarden(world) === undefined
        ? EndCause.EveryoneDown
        : EndCause.FellAlone;
}

/** Ends the run on the wave reached: nothing moves behind the end screen,
 *  so a warden who joins there meets no monster and picks up no coin, and
 *  every warden gets up at her place by the fire, keeping her kills, coins
 *  and cards for the screen, to gather for the next. Each warden's career
 *  takes what the run gave her. */
function endRun(world: World, { entity, siege }: SiegeStep) {
    presentAwards(world);
    creditCareers(world, siege);
    PhaseMachine.send(entity, "END");
    siege.best = Math.max(siege.best, siege.wave);
    siege.waitedSeconds = 0;
    siege.startAsked = false;
    clearRun(world);
    for (const warden of queryWardens(world)) {
        endShelter(warden);
        raiseForWait(world, warden);
        standWarden(world, warden);
        offerFirstElement(warden);
    }
}

/** Deals the cards once the beat after a held wave has run, and cuts the
 *  breather to a few seconds from its end once every warden is ready, by
 *  the ring or her key, counting from the deal. The machine counts the
 *  breather down and opens the next wave. */
function restBetweenWaves(world: World, { entity, siege }: SiegeStep) {
    if (entity.has(is.breather.dealt)) {
        dealCards(world, { seeded: siege, wave: siege.wave });
        PhaseMachine.send(entity, "DEALT");
        return;
    }
    //  The beat before the deal counts on its own wait, so the ring and
    //  the cut wait for the breather it opens.
    if (!entity.has(is.breather.resting)) return;
    if (!isReadyAsked("breather", siege.wave)) return;
    watchRing(world);
    if (!isEveryoneReady(world)) return;
    //  From what the wait has counted, this step's among it: the breather
    //  ends `readyBreatherSeconds` after the step every warden is ready, as
    //  a countdown that subtracts each step ends it.
    const record = entity.get(PhaseTrait);
    if (!record) return;
    const restSeconds = record.waited + readyBreatherSeconds;
    if (restSeconds < record.restSeconds)
        entity.set(PhaseTrait, { restSeconds });
}

/** Opens the wave the breather counted down to, with a card for each
 *  warden who took none. */
function openWave(world: World, { entity, siege }: SiegeStep) {
    PhaseMachine.send(entity, "OPENED");
    closeOffers(world, siege);
    unreadyWardens(world);
    siege.wave++;
    const plan = planCurrentWave(world, siege);
    siege.toSpawn = plan.count;
    siege.planned = plan.count;
    siege.bosses = plan.bosses;
    siege.spawnSeconds = 0;
}

/** Metres past the arena's edge, or below the ground, at which a monster
 *  has strayed where no warden can reach it. */
const strayMetres = 8;

/** Takes a monster out and spawns it again with the wave's next batch, as
 *  one of the kinds the wave sends; a boss rises again as a boss. Pages see
 *  it sink into a rift where it stood, not fall as if it died: the rift
 *  names it by the key the stream gives it. */
function recallMonster(world: World, siege: Siege, monster: Entity) {
    const kind = monster.get(MonsterTrait)?.kind;
    const feet = monster.get(TransformTrait);
    if (feet && kind)
        spawnBurst(world, {
            kind: BurstKind.Recall,
            position: feet,
            monster: kind,
            size: monsterSettings[kind].radius * 3,
            monsterId: dumpKey(world, monster),
        });
    monster.destroy();
    siege.toSpawn++;
    if (kind === MonsterKind.Colossus) siege.bosses++;
}

/** Takes out each monster that strayed off the field, pushed into the
 *  trees or through the ground, and spawns it again, so one no warden can
 *  reach never holds the wave. One off the field within a spawn's reach of
 *  a warden who stands out there is hers to fight: recalled, it would rise
 *  near her and stray again, and she would never be reached. */
function recallStrays(world: World, siege: Siege) {
    const ground = findEntity(world, grounds);
    const surface =
        ground === undefined
            ? undefined
            : readField(ground, GroundTrait, "surface");
    readEach(world, standingMonsters, (_traits, monster) => {
        const at = monster.get(TransformTrait);
        if (!at) return;
        const height = surface?.getHeightAt(at) ?? 0;
        const below = at.y < height - strayMetres;
        if (
            !below &&
            (Math.hypot(at.x, at.z) <= arenaMetres + strayMetres ||
                findNearestWarden(world, at).distance <= spawnMetres.most)
        )
            return;
        recallMonster(world, siege, monster);
    });
}

/** Opens a breather: the downed back up, nobody ready yet, and three
 *  cards for each warden, dealt after the beat once a wave is `held`, or
 *  at once. */
function openBreather(
    world: World,
    { entity, siege }: SiegeStep,
    held: boolean,
) {
    entity.set(PhaseTrait, { restSeconds: breatherSeconds });
    PhaseMachine.send(entity, held ? "HOLD" : "START");
    clearBolts(world);
    raiseDownedWardens(world);
    unreadyWardens(world);
    if (!held) dealCards(world, { seeded: siege, wave: siege.wave });
}

/** Breaks dawn once the night's last wave is held: the run is won and its
 *  wave the room's best, the downed get up, the coins fly in, and the
 *  wardens gather at the fire to go on into Endless. No card is dealt: the
 *  first breather of Endless deals it. Each warden's career takes the
 *  night, since a player may leave here. */
function breakDawn(world: World, { entity, siege }: SiegeStep) {
    presentAwards(world);
    PhaseMachine.send(entity, "DAWN");
    creditCareers(world, siege);
    siege.best = Math.max(siege.best, siege.wave);
    siege.waitedSeconds = 0;
    siege.startAsked = false;
    clearBolts(world);
    raiseDownedWardens(world);
    unreadyWardens(world);
}

/** Goes on from dawn into Endless, where waves keep climbing: the run
 *  keeps its wave, cards, coins and kills, and a breather opens before the
 *  next wave. */
function goOnIntoEndless(world: World, step: SiegeStep) {
    const { siege } = step;
    siege.endless = true;
    siege.waitedSeconds = 0;
    siege.startAsked = false;
    openBreather(world, step, false);
}

/** Spawns the wave's next batch when it is due, spawns again each monster
 *  that strayed or stood stalled, and holds the wave once all of it has
 *  spawned and fallen: a colossus's wave gives each warden
 *  her self-revive back, and the night's last breaks dawn, where any other
 *  opens a breather. */
function fightWave(world: World, step: SiegeStep) {
    const { entity, siege, deltaSeconds } = step;
    if (entity.has(is.fight.opening)) {
        openWave(world, step);
        return;
    }
    recallStrays(world, siege);
    for (const monster of findStalledMonsters(world, deltaSeconds))
        recallMonster(world, siege, monster);
    siege.spawnSeconds -= deltaSeconds;
    if (siege.toSpawn > 0 && siege.spawnSeconds <= 0) spawnBatch(world, siege);
    if (siege.toSpawn > 0 || findEntity(world, standingMonsters) !== undefined)
        return;
    siege.held = siege.wave;
    if (siege.wave % bossEvery === 0) refillSelfRevives(world);
    if (!siege.endless && siege.wave >= nightWaves) breakDawn(world, step);
    else openBreather(world, step, true);
}

/** Moves the run on in its phase: starts it once the wardens are ready,
 *  counts the breather down, fights the wave, and goes on into Endless
 *  from dawn. */
function advancePhase(world: World, step: SiegeStep) {
    const { entity } = step;
    if (entity.has(is.waiting) || entity.has(is.over)) {
        if (gatherWardens(world, step)) startRun(world, step);
    } else if (entity.has(is.breather)) restBetweenWaves(world, step);
    else if (entity.has(is.fight)) fightWave(world, step);
    else if (entity.has(is.dawn) && gatherWardens(world, step))
        goOnIntoEndless(world, step);
}

/** Moves the run on by a step: welcomes each warden who joined, starts the
 *  run once the wardens are ready, counts the breather down, opens and
 *  spawns each wave, holds it once its last monster falls, breaks dawn
 *  after the night's last and goes on into Endless once the wardens are
 *  ready, ends the run once every warden whose player is connected is down
 *  and none gets herself up, a beat after that last fall, and gathers the
 *  wardens for the next. It
 *  holds still while no warden's player is connected, and an empty room
 *  waits again. */
export function advanceSiege(world: World, { deltaSeconds }: StepOptions) {
    const entity =
        findEntity(world, sieges) ??
        world.spawn(
            SiegeStateTrait({ seed: drawSeed(world) }),
            PhaseTrait,
            SiegeTrait,
            FireTrait({ next: readLevelCost(0) }),
            AwardsTrait,
        );
    const siege = entity.get(SiegeStateTrait);
    if (!siege) return;
    if (findEntity(world, wardens) === undefined) {
        if (!entity.has(is.waiting)) {
            clearRun(world);
            PhaseMachine.send(entity, "EMPTY");
            siege.wave = 0;
            siege.held = 0;
            siege.waitedSeconds = 0;
            siege.endless = false;
            siege.cause = EndCause.None;
            entity.set(SiegeStateTrait, siege);
            showSiege(entity, siege);
        }
        return;
    }
    const step = { entity, siege, deltaSeconds };
    welcomeNewcomers(world, step);
    //  Nobody to play it: the run waits where it stands for a player to
    //  come back, or for the room to let the last go, and `UnattendedTrait`
    //  holds its countdowns and every latecomer's shelter.
    if (findEntity(world, wardens, isConnected) === undefined) {
        entity.set(SiegeStateTrait, siege);
        showSiege(entity, siege);
        return;
    }
    //  Nothing of the run moves on in its last fall: no batch spawns, no
    //  wave is held and no breather counts, so what ended the run stands.
    //  The run ends once the machine has waited out its beat.
    if (isFallen(entity)) endRun(world, step);
    else if (
        !isLastFall(entity) &&
        (entity.has(is.breather) || entity.has(is.fight))
    ) {
        const cause = readEndCause(world);
        if (cause !== EndCause.None) {
            siege.cause = cause;
            PhaseMachine.send(entity, "FALL");
        }
    }
    if (!isLastFall(entity)) advancePhase(world, step);
    tendLatecomers(world, step);
    entity.set(SiegeStateTrait, siege);
    showSiege(entity, siege);
}

/** The name pages were last shown, and the night and wave it names: every
 *  step asks, and a wave's name changes only with the wave. */
const shownName = { key: "", name: WaveName.Plain };

/** The name pages show: the wave's being fought, or during a breather the
 *  next one's. */
function readShownName(siege: Siege, entity: Entity) {
    const wave = entity.has(is.fight)
        ? siege.wave
        : entity.has(is.breather)
          ? siege.wave + 1
          : 0;
    if (wave === 0) return WaveName.Plain;
    const key = `${siege.nightSeed}:${wave}`;
    if (shownName.key !== key) {
        shownName.key = key;
        shownName.name = readWaveName(siege, wave);
    }
    return shownName.name;
}

/** Sets what pages draw of the run, only where it changed: a set wakes
 *  every component that reads it, on the room's thread as on each page. */
function showSiege(entity: Entity, siege: Siege) {
    const shown = entity.get(SiegeTrait);
    const secondsLeft = readShownSeconds(entity, shown);
    const startWithout = canStartWithout(siege);
    const named = readShownName(siege, entity);
    if (
        shown &&
        shown.wave === siege.wave &&
        shown.secondsLeft === secondsLeft &&
        shown.toSpawn === siege.toSpawn &&
        shown.best === siege.best &&
        shown.startWithout === startWithout &&
        shown.named === named &&
        shown.endless === siege.endless &&
        shown.cause === siege.cause
    )
        return;
    entity.set(SiegeTrait, {
        wave: siege.wave,
        secondsLeft,
        toSpawn: siege.toSpawn,
        best: siege.best,
        startWithout,
        named,
        endless: siege.endless,
        cause: siege.cause,
    });
}

/** The whole seconds of the countdown pages show: the gathering's or the
 *  breather's, the breather's whole length while its cards wait for the
 *  deal, and on the last fall what they showed as the run fell. */
function readShownSeconds(
    entity: Entity,
    shown: TraitRecord<typeof SiegeTrait> | undefined,
) {
    if (isLastFall(entity)) return shown?.secondsLeft ?? 0;
    return Math.ceil(readSecondsLeft(entity));
}
