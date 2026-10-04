import { controls, round, track, type PluginList } from "@spawnite/engine/core";
import { ride } from "./ride/ride.plugin";

/** The plugins sled runs: Enter beside Space for the sling and the jump,
 *  the track the rider's mover rides, the round each run plays, and the
 *  ride's own systems. */
export const plugins: PluginList = [
    controls({ keys: { jump: ["Space", "Enter"] } }),
    track(),
    round(),
    ride,
];
