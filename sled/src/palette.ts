import { Color } from "three";

/** The colours every map shares; each map's own are in `maps.ts`.
 *  Written as sRGB hex: `rgb` turns one into the linear triple a vertex
 *  colour takes, which a hand-typed triple would get wrong. */
export const palette = {
    /** The sling's rubber band. */
    band: 0x8c1f24,
    /** The finish gate's posts; its banner is the band's red. */
    gatePost: 0x5a3d2b,
    /** A metal ride's paint: a shade darker than the snow's shadow, so its
     *  outline holds. */
    rideShade: 0x6f7680,
};

export function rgb(hex: number): [number, number, number] {
    return new Color(hex).toArray() as [number, number, number];
}
