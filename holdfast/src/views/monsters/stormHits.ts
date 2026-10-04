import { Vector3 } from "three";

//  Where Storm struck on this page a moment ago, so a monster's view can
//  tell a Storm hit from any other: a monster Storm reaches keeps its colour
//  and flashes only its outline, so its body's white flash never outshines
//  the arc that reached it. The page's own record, filled as the page draws
//  each Storm hit and arc; the room keeps none of it.

/** Places a record holds: a Horde's worth of arcs over its window. */
const capacity = 48;
/** Seconds a strike counts for, and metres across the ground from it a
 *  monster's feet may stand: a body's reach round an arc's end, which
 *  lands on its chest. */
const windowSeconds = 0.5;
const reachMetres = 0.8;

const places = Array.from({ length: capacity }, () => new Vector3());
const times = new Float64Array(capacity).fill(-Infinity);
let next = 0;

/** Seconds on the page's own clock. */
function readNow() {
    return performance.now() / 1000;
}

/** Notes that Storm struck at `at` just now. */
export function noteStormHit(at: Vector3) {
    places[next].copy(at);
    times[next] = readNow();
    next = (next + 1) % capacity;
}

/** Whether Storm struck within reach of `at` a moment ago: the strike
 *  is spent as it answers, so it lights one monster's hit alone. */
export function takeStormHit(at: Vector3) {
    const now = readNow();
    for (let index = 0; index < capacity; index++)
        if (
            now - times[index] <= windowSeconds &&
            (places[index].x - at.x) ** 2 + (places[index].z - at.z) ** 2 <=
                reachMetres * reachMetres
        ) {
            times[index] = -Infinity;
            return true;
        }
    return false;
}
