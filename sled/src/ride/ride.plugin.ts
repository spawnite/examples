import { definePlugin, engineSystems } from "@spawnite/engine/core";
import { letGoEndedRuns, rideCourse } from "./course";
import { leanIntoSteer } from "./lean";
import { poseRiders } from "./rig";
import { drawSling } from "./sling";
import { pullDownhill } from "./speed";

/** The rider's run down the course: the sling reads the input before the
 *  move, and an ended run lets go of it; the Speed step adds its pull down
 *  a slope before the move; the course acts on the triggers
 *  the track's move marked; and the lean and the pose follow the steer,
 *  the speed and the air the move left. */
export const ride = definePlugin({
    name: "ride",
    description:
        "The rider's run: the sling, the course's triggers, the lean into the steer and the rider's pose.",
    systems: {
        input: {
            drawSling: {
                system: drawSling,
                description:
                    "Draws, aims and fires the player's sling on the keys, or as a drag set it, while the rider aims.",
            },
            letGoEndedRuns: {
                system: letGoEndedRuns,
                description:
                    "Lets go of the steer and the jump of each rider whose run has ended, and brakes it to rest on the snow.",
            },
        },
        motion: {
            pullDownhill: {
                system: pullDownhill,
                before: [engineSystems.track.move],
                description:
                    "Pulls each riding rider down a slope harder by its Speed step, before the move.",
            },
            rideCourse: {
                system: rideCourse,
                after: [engineSystems.track.markTriggers],
                description:
                    "Acts on each course trigger a riding rider came into this step, and ends the run of one that has stalled.",
            },
        },
        rules: {
            leanIntoSteer: {
                system: leanIntoSteer,
                description: "Eases each rider's roll toward its steer.",
            },
            poseRiders: {
                system: poseRiders,
                description:
                    "Eases each rider's pose toward its speed and air, and seeds the squash of a takeoff, a landing and a hit.",
            },
        },
    },
});
