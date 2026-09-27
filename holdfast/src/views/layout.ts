//  Where the circle's parts stand, in metres from its middle: what the
//  ground's paint, the stones and the hearth share with the map's paths.

/** The cobbled ring the map's `ring` path flattens. */
export const ringMetres = { radius: 14, halfWidth: 1.3 };
/** The flagstones round the hearth. */
export const hearthMetres = 4.5;
/** Each road's half width, as the map's roads hold it. */
export const roadHalfWidthMetres = 1.6;

/** Metres from the middle the standing stones stand. */
const stoneRingMetres = 19.5;
/** Standing stones round the circle. */
const stoneCount = 10;

/** A standing stone's place on the ground, and its turn to face the
 *  middle: its runes are on its local positive z. */
export interface StonePlace {
    x: number;
    z: number;
    yaw: number;
}

/** The stones, half a gap off each axis, so the roads run between them. */
export const standingStones: StonePlace[] = Array.from(
    { length: stoneCount },
    (_, index) => {
        const angle = ((index + 0.5) / stoneCount) * Math.PI * 2;
        return {
            x: Math.sin(angle) * stoneRingMetres,
            z: Math.cos(angle) * stoneRingMetres,
            yaw: angle + Math.PI,
        };
    },
);
