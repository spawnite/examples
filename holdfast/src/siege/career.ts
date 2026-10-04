import type { Entity, TraitRecord, World } from "koota";
import { saveHeroes } from "@spawnite/engine/core";
import {
    CareerRunTrait,
    CareerTrait,
    recentRunsKept,
    type SiegeStateTrait,
    WardenTrait,
} from "./traits";
import { queryWardens } from "./wardens";
import { nightWaves } from "./waves";

//  A player's career across runs: the room adds a run's XP to it as the
//  run ends, and as dawn breaks, from what the run already counts, and asks
//  for her save to be stored. Her level is worked out from the XP.

/** XP for each monster she killed. */
export const xpPerKill = 1;
/** XP for each wave the circle held while she was in the run. */
export const xpPerWave = 10;
/** XP for seeing dawn having held the whole night; a warden who came later
 *  gets the share of it the waves she held make. */
export const xpForDawn = 100;
/** XP the second level costs: each level after costs this much more than
 *  the one before, so level 3 starts at 300 and level 4 at 600. */
const levelStep = 100;

/** The XP `level` starts at, from level 1 at none. */
export function readLevelStart(level: number) {
    return (levelStep * level * (level - 1)) / 2;
}

/** The level `xp` gives, from 1. */
export function readLevel(xp: number) {
    let level = Math.max(
        1,
        Math.floor((1 + Math.sqrt(1 + (8 * xp) / levelStep)) / 2),
    );
    //  The square root may land a level off at a level's first XP.
    while (readLevelStart(level + 1) <= xp) level++;
    while (level > 1 && readLevelStart(level) > xp) level--;
    return level;
}

/** Takes `warden` into the run's career count, from `fromWave` waves
 *  already held: none at a run's start, and for a latecomer every wave
 *  up to the one being fought as she comes. */
export function enterCareerRun(warden: Entity, fromWave = 0) {
    if (!warden.has(CareerTrait)) warden.add(CareerTrait);
    warden.set(CareerTrait, { runXp: 0 });
    const run = { fromWave, credited: 0, dawned: false };
    if (warden.has(CareerRunTrait)) warden.set(CareerRunTrait, run);
    else warden.add(CareerRunTrait(run));
}

/** The XP dawn gives her: all of it for the whole night, and the share of
 *  the night's waves she held for a warden who came later. */
function readDawnXp(fromWave: number, held: number) {
    if (held < nightWaves || fromWave >= nightWaves) return 0;
    return Math.round((xpForDawn * (nightWaves - fromWave)) / nightWaves);
}

/** Adds what the run gave each warden in it since the last time to her
 *  career, counts the run once she held a wave of it and the night once
 *  dawn paid her, and asks the room to store her save: as the run ends,
 *  and as dawn breaks, since a player may leave there. A run is known by
 *  its night seed, and her save keeps the last few counted, so a player
 *  who left and joined the same run again is not counted twice. */
export function creditCareers(
    world: World,
    siege: TraitRecord<typeof SiegeStateTrait>,
) {
    const { held, nightSeed } = siege;
    for (const warden of queryWardens(world)) {
        const run = warden.get(CareerRunTrait);
        const career = warden.get(CareerTrait);
        if (!run || !career) continue;
        const kills = warden.get(WardenTrait)?.kills ?? 0;
        const dawnXp = readDawnXp(run.fromWave, held);
        const earned =
            kills * xpPerKill +
            Math.max(0, held - run.fromWave) * xpPerWave +
            dawnXp;
        const counts =
            held > run.fromWave && !career.recentRuns.includes(nightSeed);
        const dawns = !run.dawned && dawnXp > 0;
        warden.set(CareerTrait, {
            xp: career.xp + Math.max(0, earned - run.credited),
            runs: career.runs + (counts ? 1 : 0),
            dawns: career.dawns + (dawns ? 1 : 0),
            recentRuns: counts
                ? [...career.recentRuns, nightSeed].slice(-recentRunsKept)
                : career.recentRuns,
            runXp: earned,
        });
        warden.set(CareerRunTrait, {
            credited: earned,
            dawned: run.dawned || dawns,
        });
        //  One request each: a list would hold each write for the one
        //  before it, as a trade's does.
        saveHeroes(world, [warden]);
    }
}
