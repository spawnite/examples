import { Color } from "three";

/** The snow zone's colours, measured off the dawn concept board and its
 *  sky plate. Written as sRGB hex: `rgb` turns one into the linear triple a
 *  vertex colour takes, which a hand-typed triple would get wrong. */
export const palette = {
    /** The lane's paint on snow, the bright baseline the run reads as. */
    snowSurface: 0xfcfcff,
    /** The lane's paint on ice, the fast line. */
    iceSurface: 0xedf5ff,
    /** What the snow is painted; the sun and the sky colour it. */
    snowAlbedo: 0xf7f4f2,
    /** Snow keeps a hair of glow so its shade never goes dead; ice none. */
    snowEmissive: 0x050506,
    /** The sky plate's lowest band, measured off the plate itself: the
     *  colour the far land fades into. */
    skyHorizon: 0xeeab8d,
    /** The land's steep faces, cool and grey so the snow on top reads as
     *  the warm half. */
    stone: 0x6b6a72,
    /** The sling's rubber band. */
    band: 0x8c1f24,
    /** The finish gate's posts; its banner is the band's red. */
    gatePost: 0x5a3d2b,
};

export function rgb(hex: number): [number, number, number] {
    return new Color(hex).toArray() as [number, number, number];
}
