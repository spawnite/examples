//  Kicks the fight gives the camera: a shake and a zoom punch, each eased
//  out by the camera over the frames after. The step writes them and the
//  camera reads them, so one record for the page.

export const cameraFx = {
    /** Metres the view is shaken by, easing to nothing. */
    shake: 0,
    /** Share the view is zoomed in by, easing back to none. */
    punch: 0,
    /** The way the camera looks across the ground, as a yaw: 0 along +z,
     *  which the minimap turns by so the way ahead is up. */
    heading: Math.PI,
};

/** Shakes the view by `metres`, unless it already shakes harder. */
export function shakeCamera(metres: number) {
    cameraFx.shake = Math.max(cameraFx.shake, metres);
}

/** Punches the view in by `share` of its size, unless it already is. */
export function punchCamera(share: number) {
    cameraFx.punch = Math.max(cameraFx.punch, share);
}
