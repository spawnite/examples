import type { World } from "koota";
import { Vector3 } from "three";
import { boundary, heroRadius } from "./data";
import type { StepSeconds } from "./enemies";
import {
    readGrid,
    readHeroPosition,
    readRun,
    type Area,
    type Placed,
    type Spot,
} from "./field";
import { hurtHero } from "./hero";
import {
    findStage,
    HazardKind,
    type BeamHazard,
    type HazardTiming,
    type VentHazard,
} from "./stages";
import { RunPhase, type RunState } from "./traits";
import { hitEnemy } from "./weapons";

//  The stages' floor hazards. Each keeps a beat on the run's clock, a
//  telegraph and then a strike, so a view reads where each stands from the
//  run alone. A strike hurts the hero through `hurtHero`, which the threat
//  grows and a dash's or a hit's mercy guards, and burns the enemies it
//  catches.

/** Seconds into a run before a hazard first stirs. */
export const hazardStartSeconds = 4;

export enum HazardPhase {
    Idle = "idle",
    Tell = "tell",
    Strike = "strike",
}

/** Where a hazard stands in its beat: its phase, the seconds into that
 *  phase, and the cycle it is in, -1 before the first. */
export interface HazardMoment {
    phase: HazardPhase;
    seconds: number;
    cycle: number;
}

//  Written in place, once per read.
const moment: HazardMoment = { phase: HazardPhase.Idle, seconds: 0, cycle: -1 };

/** Where a beat stands `elapsed` seconds after its first cycle began. The
 *  record is written in place, so read it before the next call. */
function readMoment(
    { cycleSeconds, tellSeconds, strikeSeconds }: HazardTiming,
    elapsed: number,
): Readonly<HazardMoment> {
    moment.cycle = elapsed < 0 ? -1 : Math.floor(elapsed / cycleSeconds);
    const into = elapsed - moment.cycle * cycleSeconds;
    moment.phase =
        elapsed < 0 || into >= tellSeconds + strikeSeconds
            ? HazardPhase.Idle
            : into < tellSeconds
              ? HazardPhase.Tell
              : HazardPhase.Strike;
    moment.seconds =
        moment.phase === HazardPhase.Strike
            ? into - tellSeconds
            : moment.phase === HazardPhase.Tell
              ? into
              : 0;
    return moment;
}

/** The seconds since vent `index` began its first beat: the vents start
 *  one after another, spread round the cycle by the stagger. */
function readVentElapsed(hazard: VentHazard, index: number, time: number) {
    const count = hazard.vents.length;
    const offset =
        (((index * hazard.stagger) % count) / count) * hazard.cycleSeconds;
    return time - hazardStartSeconds - offset;
}

const idle: Readonly<HazardMoment> = {
    phase: HazardPhase.Idle,
    seconds: 0,
    cycle: -1,
};

/** Where vent `index` of the run's stage stands now; idle on a stage with
 *  no vents. Written in place, so read it before the next call. */
export function readVent(run: RunState, index: number) {
    const hazard = findStage(run.stage).hazard;
    if (hazard.kind !== HazardKind.Vents) return idle;
    return readMoment(hazard, readVentElapsed(hazard, index, run.time));
}

//  Scratch for the enemies near a vent.
const ventFound: Placed[] = [];
const ventArea = { from: new Vector3(), to: new Vector3(), pad: 0 };

/** Whether a burn lands this step: at the strike's start and every tick
 *  after, while it lasts. */
function isTick(seconds: number, { deltaSeconds }: StepSeconds, tick: number) {
    return (
        Math.floor(seconds / tick) !==
        Math.floor((seconds - deltaSeconds) / tick)
    );
}

/** The Ember Foundry's vents: each glows, then erupts, on its own beat,
 *  and an eruption burns the hero and every enemy standing in it at its
 *  start and at each tick after. */
export function eruptVents(world: World, step: StepSeconds) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    const hazard = findStage(run.stage).hazard;
    if (hazard.kind !== HazardKind.Vents) return;
    const hero = readHeroPosition(world);
    const grid = readGrid(world);
    for (const [index, vent] of hazard.vents.entries()) {
        const now = readMoment(
            hazard,
            readVentElapsed(hazard, index, run.time),
        );
        if (
            now.phase !== HazardPhase.Strike ||
            !isTick(now.seconds, step, hazard.tickSeconds)
        )
            continue;
        if (measureDistance(hero, vent) < hazard.radius + heroRadius) {
            hurtHero(world, {
                amount: hazard.heroDamage,
                color: hazard.strikeColor,
            });
            if (run.phase !== RunPhase.Playing) return;
        }
        for (const placed of grid.near(
            setAreaAround(vent, hazard.radius),
            ventFound,
        ))
            if (
                measureDistance(placed.position, vent) <
                hazard.radius + placed.enemy.radius
            )
                hitEnemy(world, placed, {
                    amount: hazard.enemyDamage,
                    color: hazard.strikeColor,
                });
    }
}

function measureDistance(from: Spot, to: Spot) {
    return Math.hypot(from.x - to.x, from.z - to.z);
}

/** Sets the vents' scratch area to the box round `at`, `reach` metres
 *  each way. */
function setAreaAround(at: Spot, reach: number): Area {
    ventArea.from.x = at.x - reach;
    ventArea.from.z = at.z - reach;
    ventArea.to.x = at.x + reach;
    ventArea.to.z = at.z + reach;
    return ventArea;
}

/** The beam's line: where it stands in its beat, whether it lies along z
 *  and so sweeps along x, the way it sweeps, and where on its axis it
 *  stands, in metres. */
export interface BeamView extends HazardMoment {
    alongX: boolean;
    direction: number;
    at: number;
}

//  Written in place, once per read.
const beam: BeamView = {
    phase: HazardPhase.Idle,
    seconds: 0,
    cycle: -1,
    alongX: false,
    direction: 1,
    at: 0,
};

/** The beam of the run's stage now: idle on a stage with no beam. Each
 *  cycle turns it a quarter, so it sweeps along x, then z, then back the
 *  other way along each. Written in place, so read it before the next
 *  call. */
export function readBeam(run: RunState): Readonly<BeamView> {
    const hazard = findStage(run.stage).hazard;
    if (hazard.kind !== HazardKind.Beam) {
        beam.phase = HazardPhase.Idle;
        return beam;
    }
    const now = readMoment(hazard, run.time - hazardStartSeconds);
    beam.phase = now.phase;
    beam.seconds = now.seconds;
    beam.cycle = now.cycle;
    beam.alongX = now.cycle % 2 === 1;
    beam.direction = Math.floor(now.cycle / 2) % 2 ? -1 : 1;
    beam.at =
        now.phase === HazardPhase.Strike
            ? readBeamAt(run, hazard, now.seconds)
            : run.beamFrom;
    return beam;
}

/** Where on its axis the beam stands `seconds` into its sweep. */
function readBeamAt(run: RunState, hazard: BeamHazard, seconds: number) {
    const direction = Math.floor(run.beamCycle / 2) % 2 ? -1 : 1;
    return run.beamFrom + direction * hazard.speed * seconds;
}

/** The body's place on the axis the beam sweeps along. */
function readAcross(spot: Spot, alongX: boolean) {
    return alongX ? spot.x : spot.z;
}

/** The stretch of its axis the beam swept this step. */
interface Swept {
    alongX: boolean;
    low: number;
    high: number;
}

//  Written in place, once per step.
const swept: Swept = { alongX: false, low: 0, high: 0 };

function isSwept(spot: Spot) {
    const across = readAcross(spot, swept.alongX);
    return across >= swept.low && across <= swept.high;
}

/** The Prism Vault's beam: each cycle its line appears wall to wall a
 *  lead before the hero, then sweeps across the field to the far wall,
 *  hurting the hero and every enemy it crosses, once each. A dash through
 *  it, whose mercy covers the crossing, dodges it. */
export function sweepBeam(world: World, step: StepSeconds) {
    const run = readRun(world);
    if (run.phase !== RunPhase.Playing) return;
    const hazard = findStage(run.stage).hazard;
    if (hazard.kind !== HazardKind.Beam) return;
    const now = readBeam(run);
    if (now.phase === HazardPhase.Idle) return;
    const hero = readHeroPosition(world);
    if (run.beamCycle !== now.cycle) {
        //  A new cycle: the line goes down before the hero, on the side it
        //  sweeps from.
        run.beamCycle = now.cycle;
        run.beamFrom = Math.max(
            -boundary,
            Math.min(
                boundary,
                readAcross(hero, now.alongX) - now.direction * hazard.lead,
            ),
        );
    }
    if (now.phase !== HazardPhase.Strike) return;
    const to = readBeamAt(run, hazard, now.seconds);
    const from = readBeamAt(
        run,
        hazard,
        Math.max(0, now.seconds - step.deltaSeconds),
    );
    swept.alongX = now.alongX;
    swept.low = Math.min(from, to);
    swept.high = Math.max(from, to);
    if (isSwept(hero)) {
        hurtHero(world, {
            amount: hazard.heroDamage,
            color: hazard.strikeColor,
        });
        if (run.phase !== RunPhase.Playing) return;
    }
    for (const placed of readGrid(world).all)
        if (placed.entity.isAlive() && isSwept(placed.position))
            hitEnemy(world, placed, {
                amount: hazard.enemyDamage,
                color: hazard.strikeColor,
            });
}
