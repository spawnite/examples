import { createQuery, type Entity, type TraitRecord, type World } from "koota";
import { findSiege, isPhase, isRunning, PhaseMachine } from "./phase";
import { DisarmedTrait, findEntity } from "@spawnite/engine/core";
import { dealOffer, offerFirstElement, pickCard } from "./cards";
import { enterCareerRun } from "./career";
import { LifeMachine, LifeTrait } from "./life";
import { drawIndex } from "./random";
import { forgetHue } from "./strikes";
import { NewcomerTrait, type SiegeStateTrait, WardenTrait } from "./traits";
import { isConnected, queryWardens } from "./wardens";
import { nameWave, planWave } from "./waves";

const { is } = PhaseMachine;

//  A warden who joins a run already going: she stands at the fire,
//  sheltered, and takes a card for each breather she missed, one after
//  another; the wave still to come grows to what it would have planned
//  with her. Deep Rock Galactic and Risk of Rain 2 drop a joiner into the
//  running mission the same way.

/** The siege's record as the step reads and writes it. */
type Siege = TraitRecord<typeof SiegeStateTrait>;

/** The siege's record and the step's length, as the step hands them on. */
interface SiegeStep {
    siege: Siege;
    deltaSeconds: number;
}

const newcomers = createQuery(WardenTrait, NewcomerTrait);
const shelteredWardens = createQuery(WardenTrait, LifeMachine.is.sheltered);

/** Raises the wave's count to what it would have planned for the wardens
 *  in the room now, where that is more: the monsters not spawned yet take
 *  the difference. A leave lowers nothing, and a colossus already risen
 *  keeps the health it rose with. */
function topUpWave(world: World, siege: Siege) {
    const planned = planWave(
        siege.wave,
        queryWardens(world).length,
        nameWave(siege.nightSeed, siege.wave),
    ).count;
    if (planned <= siege.planned) return;
    siege.toSpawn += planned - siege.planned;
    siege.planned = planned;
}

/** How `warden` is dealt now: the siege's draws, the wave last held, and
 *  whether she holds the circle alone. */
function readDealing(world: World, siege: Siege) {
    return {
        seeded: siege,
        wave: isPhase(world, is.fight) ? siege.wave - 1 : siege.wave,
        alone: queryWardens(world).filter(isConnected).length === 1,
    };
}

/** Takes `warden` into the run: the wave grows for her, the reactions of
 *  a warden who left in her colour are forgotten, and she is sheltered with
 *  her element to pick and a card to take for each breather dealt before
 *  she came, the one dealt now among them. */
function joinRun(
    world: World,
    { siege, deltaSeconds }: SiegeStep,
    warden: Entity,
) {
    if (isPhase(world, is.fight)) topUpWave(world, siege);
    forgetHue(world, warden.get(WardenTrait)?.hue ?? 0);
    const missed = isPhase(world, is.breather)
        ? siege.wave
        : Math.max(0, siege.wave - 1);
    warden.set(WardenTrait, { catchUp: missed + 1 });
    warden.add(DisarmedTrait);
    LifeMachine.send(warden, "SHELTER");
    //  Sheltered in the siege's step, after the machines counted theirs:
    //  her shelter counts this step too, as it always has.
    warden.set(LifeTrait, { waited: deltaSeconds });
    dealOffer(warden, readDealing(world, siege));
    //  Her career counts from the next wave to open: one already being
    //  fought gives her nothing.
    enterCareerRun(warden, siege.wave);
}

/** Welcomes each warden the room spawned since the last step: into the run
 *  where one is going, dawn among it, since Endless goes on from there, or
 *  into the wait for the next, with her element to pick. */
export function welcomeNewcomers(world: World, step: SiegeStep) {
    const siege = findSiege(world);
    const running = siege !== undefined && isRunning(siege);
    //  A list, since each leaves the query as she is welcomed; almost
    //  every step has none, and makes none.
    if (findEntity(world, newcomers) === undefined) return;
    for (const warden of world.query(newcomers)) {
        warden.remove(NewcomerTrait);
        if (running) joinRun(world, step, warden);
        else offerFirstElement(warden);
    }
}

/** Ends her shelter: she may be chased and hurt, and fires again, and any
 *  card she had still to take is gone. */
export function endShelter(warden: Entity) {
    warden.remove(DisarmedTrait);
    LifeMachine.send(warden, "UNSHELTER");
    warden.set(WardenTrait, {
        catchUp: 0,
        offer: [],
        taken: "",
    });
}

/** Takes each card still hers to take, at random, as a breather that
 *  closes takes one she left. */
function takeCardsForHer(world: World, siege: Siege, warden: Entity) {
    let left = warden.get(WardenTrait)?.catchUp ?? 0;
    while (left > 0) {
        const survivor = warden.get(WardenTrait);
        if (survivor?.taken === "" && survivor.offer.length > 0)
            pickCard(warden, drawIndex(siege, survivor.offer.length));
        left--;
        if (left > 0) dealOffer(warden, readDealing(world, siege));
    }
}

/** One step of each sheltered warden: a card she took deals the next, or
 *  ends her shelter when it was the last; her shelter's time running out
 *  takes the rest for her. */
export function tendLatecomers(world: World, { siege }: SiegeStep) {
    if (findEntity(world, shelteredWardens) === undefined) return;
    //  A list, since a warden whose shelter ends leaves the query.
    for (const warden of world.query(shelteredWardens)) {
        const survivor = warden.get(WardenTrait);
        if (!survivor) continue;
        if (survivor.taken !== "") {
            const left = survivor.catchUp - 1;
            if (left > 0) {
                warden.set(WardenTrait, { catchUp: left });
                dealOffer(warden, readDealing(world, siege));
            } else endShelter(warden);
            continue;
        }
        if (!warden.has(LifeMachine.is.sheltered.spent)) continue;
        takeCardsForHer(world, siege, warden);
        endShelter(warden);
    }
}
