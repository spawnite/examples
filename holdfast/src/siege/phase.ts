import { createQuery, type Entity, type World } from "koota";
import {
    defineBehaviour,
    findEntity,
    RunContext,
    states,
} from "@spawnite/engine/core";
import { UnattendedTrait } from "./traits";
import { countdownSeconds, waveClearSeconds } from "./waves";

//  Where a run stands, as one machine on the siege's entity: the phase
//  pages show is its top state, and the beats inside a phase, the
//  gathering countdown, the card deal and the last fall, are states of
//  their own that wait. The siege's step sends it what happens and does
//  the work each state asks for.

/** Seconds the last fall shows before the end screen opens, as Left 4
 *  Dead holds on its fallen team first: her body takes under half a second
 *  to reach the ground, and the rest lets every page read what ended the
 *  run. */
export const lastFallSeconds = 2;

/** The wardens gathering by the fire: counting down once every warden is
 *  ready, and stopped by anyone who is not. `counted` is the countdown run
 *  out, which the step starts the run on while they are still all ready. */
const gathering = {
    initial: "gathering",
    states: {
        gathering: { on: { COUNT: "counting" } },
        counting: {
            wait: { seconds: countdownSeconds, then: "counted" },
            on: { STOP: "gathering" },
        },
        counted: { on: { STOP: "gathering" } },
    },
} as const;

/** The beat on the last fall before the end screen, in which nothing of
 *  the run moves on; `fallen` is the beat run out, which the step ends the
 *  run on. */
const lastFall = {
    falling: { wait: { seconds: lastFallSeconds, then: "fallen" } },
    fallen: {},
} as const;

/** The run's phases. A breather opens `resting` for `restSeconds`, which
 *  every warden being ready cuts short; after a held wave it first waits
 *  out the beat before the deal, and `dealt` is the deal due. A fight
 *  opens its wave in `opening`. */
export const PhaseMachine = states({
    id: "phase",
    description:
        "The run's phase: gathering, a breather, a wave, the end screen or dawn, with its countdowns.",
    initial: "waiting",
    context: { restSeconds: 0 },
    heldBy: [UnattendedTrait],
    states: {
        waiting: gathering,
        breather: {
            initial: "resting",
            states: {
                dealing: { wait: { seconds: waveClearSeconds, then: "dealt" } },
                dealt: { on: { DEALT: "resting" } },
                resting: {
                    wait: {
                        seconds: ({ context }) => context.restSeconds,
                        then: "#phase.fight",
                    },
                },
                ...lastFall,
            },
            on: { FALL: ".falling" },
        },
        fight: {
            initial: "opening",
            states: {
                opening: { on: { OPENED: "fighting" } },
                fighting: {},
                ...lastFall,
            },
            on: { FALL: ".falling" },
        },
        over: gathering,
        dawn: gathering,
    },
    on: {
        START: ".breather",
        HOLD: ".breather.dealing",
        DAWN: ".dawn",
        END: ".over",
        EMPTY: ".waiting",
    },
});

/** The run's phase: the phase machine's snapshot, on the siege's entity. */
export const PhaseTrait = PhaseMachine.trait;

export const PhaseBehaviour = defineBehaviour({
    name: "phase",
    trait: PhaseTrait,
    source: "src/siege/phase.ts",
    description: "Runs the siege's phases and their countdowns.",
    runsOn: RunContext.Server,
});

const { is } = PhaseMachine;

/** Where a run stands: a top state of the phase machine. `waiting` has no
 *  run yet, the wardens gathering by the fire; `breather` is between
 *  waves; `fight` is a wave spawning or still standing; `over` is every
 *  warden down, the end screen; and `dawn` is the night's last wave held,
 *  from which Endless goes on. */
export type Phase = keyof typeof is;

const topPhases = Object.keys(is) as Phase[];

const phases = createQuery(PhaseTrait);

/** The siege's entity, which holds the phase machine: undefined before
 *  the room's first step. */
export function findSiege(world: World) {
    return findEntity(world, phases);
}

/** The phase `siege` is in, from its tags, which a page's copy follows
 *  as the stream moves the machine: undefined before the room's first
 *  step. */
export function readPhase(siege: Entity | undefined): Phase | undefined {
    return topPhases.find((phase) => siege?.has(is[phase]));
}

/** Whether the siege on `world` is in the state `tag` names, such as
 *  `PhaseMachine.is.fight`: false before the room's first step. */
export function isPhase(world: World, tag: (typeof is)[Phase]) {
    return findSiege(world)?.has(tag) ?? false;
}

/** Whether a run is on, on `siege`: a breather, a wave, or dawn, from
 *  which Endless goes on. */
export function isRunning(siege: Entity) {
    return siege.has(is.breather) || siege.has(is.fight) || siege.has(is.dawn);
}

/** Whether `siege` holds on its last fall, the beat run out among it. */
export function isLastFall(siege: Entity) {
    return (
        siege.has(is.breather.falling) ||
        siege.has(is.breather.fallen) ||
        siege.has(is.fight.falling) ||
        siege.has(is.fight.fallen)
    );
}

/** Whether `siege`'s last fall has run its beat. */
export function isFallen(siege: Entity) {
    return siege.has(is.breather.fallen) || siege.has(is.fight.fallen);
}

/** Seconds left of the countdown `siege` is in: the gathering's or the
 *  breather's, the breather's whole length while its cards wait for the
 *  deal, and 0 while none runs. */
export function readSecondsLeft(siege: Entity) {
    const { context, secondsLeft } = PhaseMachine.read(siege);
    if (siege.has(is.breather.dealing) || siege.has(is.breather.dealt))
        return context.restSeconds;
    return siege.has(is.breather.resting) ||
        siege.has(is.waiting.counting) ||
        siege.has(is.over.counting) ||
        siege.has(is.dawn.counting)
        ? (secondsLeft ?? 0)
        : 0;
}

/** Whether the gathering's countdown on `siege` has run out. */
export function isCounted(siege: Entity) {
    return (
        siege.has(is.waiting.counted) ||
        siege.has(is.over.counted) ||
        siege.has(is.dawn.counted)
    );
}
