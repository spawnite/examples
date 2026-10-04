import { states } from "@spawnite/engine/core";
import { UnattendedTrait } from "./traits";
import { shelterSeconds } from "./waves";

//  A warden's life through the run, as two machines on her hero: her body,
//  standing, sheltered or down, and whether she is ready for what comes
//  next. They are two because a sheltered latecomer readies at the fire
//  like anyone else, so neither state waits on the other.

/** Her body: on her feet; sheltered while she catches up on the cards she
 *  missed, which `spent` ends once her shelter's seconds run out; or down,
 *  `reviving` while someone gets her up and `lying` while nobody does.
 *  `revived` is the seconds of getting up she has, which count up at the
 *  best reviver's rate and back down while nobody tends her. */
export const LifeMachine = states({
    id: "life",
    description:
        "A warden's body: standing, sheltered while she catches up, or down and getting up.",
    initial: "standing",
    context: { revived: 0 },
    heldBy: [UnattendedTrait],
    states: {
        standing: { on: { DOWN: "down", SHELTER: "sheltered" } },
        sheltered: {
            initial: "catchingUp",
            states: {
                catchingUp: {
                    wait: { seconds: shelterSeconds, then: "spent" },
                },
                spent: {},
            },
            on: { UNSHELTER: "standing" },
        },
        down: {
            initial: "lying",
            states: {
                lying: { on: { TEND: "reviving" } },
                reviving: { on: { LEAVE: "lying" } },
            },
            on: { RISE: "standing" },
        },
    },
});

/** Her body's machine, on her hero. */
export const LifeTrait = LifeMachine.trait;

/** Whether she is ready for the next run, the next wave, or Endless: by
 *  her key, which stands wherever she walks, or by stepping into the ring
 *  by the fire, which stepping out of it cancels. */
export const ReadinessMachine = states({
    id: "readiness",
    description:
        "Whether a warden is ready for what comes next, by her key or by the ring by the fire.",
    initial: "unready",
    states: {
        unready: { on: { RING: "ready.ring" } },
        ready: {
            initial: "key",
            states: {
                key: {},
                ring: { on: { LEFT: "#readiness.unready" } },
            },
        },
    },
    on: { READY: ".ready.key", UNREADY: ".unready" },
});

/** Her readiness's machine, on her hero. */
export const ReadinessTrait = ReadinessMachine.trait;
