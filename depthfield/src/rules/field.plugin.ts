import {
    definePlugin,
    engineSystems,
    pageAction,
    RunContext,
} from "@spawnite/engine/core";
import { flyEnemyShots, landBlasts, moveEnemies } from "./enemies";
import { eruptVents, sweepBeam } from "./hazards";
import { driveHero, takeDashRequest } from "./hero";
import { collectDrops, collectGems } from "./pickups";
import { advanceRun, levelUp, playEndings } from "./run";
import { fireWeapons, flyShots } from "./weapons";

//  Before the engine's rules, as the source's update ran the run's.
const beforeEngineRules = [engineSystems.cooldowns.countDown];

/** The run's rules, in the order the source's update ran them. The dash
 *  takes the jump before the engine steers, and drives the hero after it.
 *  The level-up comes last, so a step's orbs count. */
export const field = definePlugin({
    name: "field",
    description:
        "The run: the dash, the clock and its waves, the stage's hazard, the enemies, the weapons, the pickups and the level-ups.",
    //  The page's keys: the card picks at a level-up, the notes and the
    //  pause. The room never hears them.
    actions: {
        pickFirst: pageAction({
            keys: ["Digit1", "Numpad1"],
            description: "Takes the first card at a level-up.",
        }),
        pickSecond: pageAction({
            keys: ["Digit2", "Numpad2"],
            description: "Takes the second card at a level-up.",
        }),
        pickThird: pageAction({
            keys: ["Digit3", "Numpad3"],
            description: "Takes the third card at a level-up.",
        }),
        pickFourth: pageAction({
            keys: ["Digit4", "Numpad4"],
            description: "Takes the fourth card at a level-up.",
        }),
        notes: pageAction({
            keys: ["KeyM"],
            description: "Opens and closes the run's notes.",
        }),
        pause: pageAction({
            keys: ["KeyP"],
            description: "Pauses the run, and plays it on.",
        }),
    },
    systems: {
        input: {
            takeDashRequest: {
                system: takeDashRequest,
                after: [engineSystems.hero.copyClientInput],
                before: [engineSystems.hero.steer],
                runsOn: RunContext.Both,
                description:
                    "Takes the jump key or button as the dash, before the engine would jump the hero.",
            },
            driveHero: {
                system: driveHero,
                hero: true,
                after: [engineSystems.hero.steer],
                description:
                    "Sets the hero's speed from the run, drives a dash, counts the hit mercy and the dash cooldown down, and heals by the regen.",
            },
        },
        rules: {
            advanceRun: {
                system: advanceRun,
                before: beforeEngineRules,
                description:
                    "Runs the clock: announces each new enemy kind, drops the minute magnets, spawns the elites, the waves and, at three minutes, the boss; in endless, an elite every 45 seconds and the boss every third minute.",
            },
            landBlasts: {
                system: landBlasts,
                before: beforeEngineRules,
                description:
                    "Fades each blast ring and stomp, and hurts the hero inside a blast on its last moment.",
            },
            eruptVents: {
                system: eruptVents,
                before: beforeEngineRules,
                description:
                    "On the Ember Foundry, glows each vent, then erupts it on its own beat, burning the hero and every enemy standing in it.",
            },
            sweepBeam: {
                system: sweepBeam,
                before: beforeEngineRules,
                description:
                    "On the Prism Vault, draws the beam's line before the hero every twelve seconds, then sweeps it across the field, hurting the hero and every enemy it crosses.",
            },
            moveEnemies: {
                system: moveEnemies,
                before: beforeEngineRules,
                description:
                    "Walks each enemy and plays its attacks, fires the shooters, summons from the summoners, and hurts the hero on a touch.",
            },
            flyEnemyShots: {
                system: flyEnemyShots,
                before: beforeEngineRules,
                description:
                    "Flies each shooter's orb until a prop stops it or it hits the hero.",
            },
            fireWeapons: {
                system: fireWeapons,
                before: beforeEngineRules,
                description:
                    "Fires each weapon the hero owns at the nearest enemy once its clock runs out, and the echo's copy beside it.",
            },
            flyShots: {
                system: flyShots,
                before: beforeEngineRules,
                description:
                    "Flies the bullets, shards, zaps, boomerangs, novas and mines, and lands their hits and kills.",
            },
            collectDrops: {
                system: collectDrops,
                before: beforeEngineRules,
                description:
                    "Pulls each drop near the hero in and takes the ones the hero touches.",
            },
            collectGems: {
                system: collectGems,
                before: beforeEngineRules,
                description:
                    "Pulls each orb near the hero, or every magnetized one, in and adds its experience.",
            },
            playEndings: {
                system: playEndings,
                before: beforeEngineRules,
                description:
                    "Plays the hero's fall out to the death screen, and the boss's to the victory screen.",
            },
            levelUp: {
                system: levelUp,
                before: beforeEngineRules,
                description:
                    "Deals the level-up cards once the experience fills the bar.",
            },
        },
    },
});
