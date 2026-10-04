import {
    definePlugin,
    engineSystems,
    integer,
    pageAction,
    text,
} from "@spawnite/engine/core";
import { tendAfflictions } from "./afflictions";
import { holdWardenWeapons } from "./arms";
import { recordDeeds } from "./awards";
import { offerSize } from "./cards";
import { applyElementHits, dropThunderheads } from "./doses";
import { ricochetPellets } from "./ricochets";
import { flyBolts, sightSpitters, spitBolts, windUpSlams } from "./attacks";
import { takeFallenMonsters } from "./blaster";
import { tendWardens } from "./downs";
import { expireEntities } from "./effects";
import { gunList } from "./guns";
import { faceMonsters, strikeWardens } from "./monsters";
import { advanceSiege } from "./siege";
import { tallyMonsters } from "./tally";
import { readSignals } from "./signals";
import { adoptWardens, gatherStandingWardens, holdUnattended } from "./wardens";

//  Before the engine's rules: the wardens are taken in, the signals read,
//  the wardens' weapons handed out and the fallen monsters taken out
//  before the behaviours, so the engine never reaps a warden, and never
//  reaps a monster before the siege drops its coins. The rest run after
//  the engine's rules: the engine's chase walks the monsters, and the
//  siege then turns each to face its warden.
const beforeEngineRules = [engineSystems.cooldowns.countDown];

/** A slot of a warden's card offer. */
const offerSlotField = integer(0, offerSize - 1);

/** The siege the room runs: its systems at the places they read and
 *  write, and the words a page sends it. Named apart from the siege's
 *  state, which most of its modules call `siege`. */
export const siegePlugin = definePlugin({
    name: "siege",
    description:
        "The siege: the wardens, the waves and their monsters, the guns and the elements, the shop at the fire, the cards and the awards.",
    messages: {
        /** "I am ready": her key while the wardens gather, in a breather
         *  and at dawn, and the end and dawn screens' buttons. Stepping
         *  into the ring by the fire says it too. */
        ready: {},
        /** "I am not ready yet": her key again, while she is ready. */
        unready: {},
        /** "Start without the rest": a ready warden's word, once the ready
         *  have waited long enough on those who are not. */
        startWithout: {},
        /** "I take this card", by its slot of the offer. */
        pick: { slot: offerSlotField },
        /** "I buy this card too", by its slot, after the free one. */
        buyCard: { slot: offerSlotField },
        /** "Deal me three other cards", for coins, on the card screen. */
        reroll: {},
        /** "I buy this gun", at its stand of the fire's rack. */
        buyGun: { gun: text(Math.max(...gunList.map((gun) => gun.length))) },
        /** "Raise the gun in my hand a tier", at its stand. */
        upgrade: {},
        /** "I feed the fire", beside it. */
        feed: {},
    },
    //  The page's keys: the room never hears them, and each sends its
    //  word above where it changes the siege.
    actions: {
        /** Takes the first, second and third card, on the number row and
         *  the keypad. */
        pickFirst: pageAction({
            keys: ["Digit1", "Numpad1"],
            description: "Takes the first card of the offer.",
        }),
        pickSecond: pageAction({
            keys: ["Digit2", "Numpad2"],
            description: "Takes the second card of the offer.",
        }),
        pickThird: pageAction({
            keys: ["Digit3", "Numpad3"],
            description: "Takes the third card of the offer.",
        }),
        reroll: pageAction({
            keys: ["Digit4", "Numpad4"],
            description: "Deals three other cards, for coins.",
        }),
        /** C, which no engine action binds: Q turns the map camera, Tab
         *  is a common push-to-talk key and Escape opens the menu. */
        foldHand: pageAction({
            keys: ["KeyC"],
            description: "Folds her hand of cards, and opens it again.",
        }),
        ready: pageAction({
            keys: ["KeyR"],
            description:
                "Readies her, or takes it back, wherever ready means something.",
        }),
        startWithout: pageAction({
            keys: ["Enter"],
            description: "Starts without the rest, once the ready may.",
        }),
        /** Held, as the shooters keep their scoreboard on Tab. */
        counts: pageAction({
            keys: ["Tab"],
            description: "Shows every warden's coins and kills while held.",
        }),
    },
    systems: {
        rules: {
            adoptWardens: {
                system: adoptWardens,
                before: beforeEngineRules,
                description:
                    "Makes each new hero a warden, with the warden's own health, colour, stats and stride.",
            },
            gatherStandingWardens: {
                system: gatherStandingWardens,
                before: beforeEngineRules,
                description:
                    "Lists the wardens on their feet, for the siege's other systems to read.",
            },
            holdUnattended: {
                system: holdUnattended,
                before: beforeEngineRules,
                description:
                    "Holds the run's countdowns and every warden's shelter where they stand while no warden's player is connected.",
            },
            readSignals: {
                system: readSignals,
                before: beforeEngineRules,
                description:
                    "Reads each warden's signal: ready for the run, or the upgrade card the warden picks.",
            },
            holdWardenWeapons: {
                system: holdWardenWeapons,
                before: beforeEngineRules,
                description:
                    "Hands each warden the weapons the room takes shots from: the gun from the fire's rack the warden holds, and the lance once the warden takes its card.",
            },
            applyElementHits: {
                system: applyElementHits,
                before: beforeEngineRules,
                description:
                    "Lands the dose of the warden's elements each gun hit carries on the monster it struck: a reaction on a mark another element built, Storm's arc, Ember's burn and Frost's chill.",
            },
            ricochetPellets: {
                system: ricochetPellets,
                before: beforeEngineRules,
                description:
                    "Bounces each upgraded scattergun pellet that hit a monster on to the monsters nearest it, at half its damage each time.",
            },
            dropThunderheads: {
                system: dropThunderheads,
                before: beforeEngineRules,
                description:
                    "Drops Thunderhead's bolt from the sky on the monster its warden last hit, every few seconds while that warden fires.",
            },
            tendAfflictions: {
                system: tendAfflictions,
                before: beforeEngineRules,
                description:
                    "Ticks each monster's burn, fades its burn and chill, thaws it, counts its mark and rest down, burns and slows it in steam, sets its speed, and shows each page its elements.",
            },
            recordDeeds: {
                system: recordDeeds,
                before: beforeEngineRules,
                description:
                    "Counts each warden's damage to the monsters this step, and the seconds a warden stands alone with every teammate down, for the run's awards.",
            },
            takeFallenMonsters: {
                system: takeFallenMonsters,
                before: beforeEngineRules,
                description:
                    "Takes out each monster a shot left with no health: its coins drop, and its kill counts for the warden who shot it.",
            },
            sightSpitters: {
                system: sightSpitters,
                before: beforeEngineRules,
                description:
                    "Has each spitter hold at its range only where it sees the nearest warden, and walk on where a hill or a stone stands between them.",
            },
            advanceSiege: {
                system: advanceSiege,
                description:
                    "Runs the siege: gathers the wardens, rests them between waves, spawns each wave, and ends the run once every warden is down.",
            },
            faceMonsters: {
                system: faceMonsters,
                description:
                    "Turns each monster to face the nearest standing warden.",
            },
            strikeWardens: {
                system: strikeWardens,
                description:
                    "Has each monster within reach of a standing warden hit the warden, once its claws have cooled and the warden's breath after the last blow has passed.",
            },
            windUpSlams: {
                system: windUpSlams,
                description:
                    "Winds each colossus up near a standing warden, and lands its slam where it stood.",
            },
            spitBolts: {
                system: spitBolts,
                description:
                    "Has each spitter spit a bolt at the nearest standing warden within its reach.",
            },
            flyBolts: {
                system: flyBolts,
                description:
                    "Flies each bolt, hurts the first standing warden it meets, and takes it away once its time runs out.",
            },
            tendWardens: {
                system: tendWardens,
                description:
                    "Keeps each standing warden's stride and healing, downs one out of health, and revives a downed warden while teammates stand over the warden.",
            },
            tallyMonsters: {
                system: tallyMonsters,
                description:
                    "Adds the step's seconds for each monster standing to the run's totals, which the timeline reads.",
            },
            expireEntities: {
                system: expireEntities,
                description:
                    "Counts each entity's lifetime down, and takes it away once it runs out.",
            },
        },
    },
});
