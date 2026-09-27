import { baseSystems, type System } from "@spawnite/engine/core";
import { rideCourse } from "./ride/course";
import { leanIntoSteer } from "./ride/lean";
import { readRiderStats } from "./ride/rider";
import { drawSling } from "./ride/sling";

/** The engine's step with sled's own: the sling reads the input and the
 *  rider's stats reach the mover before the move rides them, the course
 *  acts on the triggers the move marked, and the lean follows the steer
 *  the move used. */
export const systems: System[] = [
    ...baseSystems.input,
    drawSling,
    readRiderStats,
    ...baseSystems.move,
    rideCourse,
    ...baseSystems.behaviours,
    leanIntoSteer,
    ...baseSystems.resolve,
];
