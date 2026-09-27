import { Vector3 } from "three";
import { calculateDaylight } from "@spawnite/engine";
import { dusk } from "@spawnite/engine/looks/dusk";

//  The dusk air: the colour the far forest fades into, and the metres from
//  the camera where the fade starts and where it hides all. A warden in the
//  middle sees a monster at 30 m still clear; the map's edge, 50 m out, is
//  half gone. The sky's horizon is the same colour, so the two meet with no
//  seam.
export const duskAir = { color: "#3a4163", near: 22, far: 92 };

/** The sun as the dusk look's rig stands it: the sky's disc and the
 *  skyline's warm side both sit where the shadows come from. */
export const duskSun = new Vector3().copy(
    calculateDaylight(dusk.hour).direction,
);
