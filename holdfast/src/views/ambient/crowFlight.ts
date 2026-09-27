//  The crow's flight off its stone, as a function of the seconds since it
//  took off: a spring up with fast beats, then a steady climb up and out,
//  above the treetops as seen from the circle, so it shows against the sky
//  until it is too far to see.

/** Where the crow is in its flight. */
export enum CrowStage {
    /** On its stone: no shot yet this run. */
    Perched = "perched",
    /** Springing up off the stone. */
    Rising = "rising",
    /** Climbing away over the forest. */
    Flying = "flying",
    /** Out of sight until the next run. */
    Gone = "gone",
}

/** Where the flight has the crow: metres out along its heading and up off
 *  its perch, and its wing beats a second. */
export interface CrowFlight {
    stage: CrowStage;
    distance: number;
    height: number;
    flapRate: number;
}

/** Seconds of the spring off the stone. */
const riseSeconds = 0.5;
/** Metres up and out the spring carries it. */
const riseHeight = 1.5;
const riseDistance = 0.6;
/** Its speed out at the end of the spring, which the flight carries on
 *  from, and how fast it gains on that. */
const flySpeed = (2 * riseDistance) / riseSeconds;
const flyGain = 0.4;
/** Metres a second it climbs once flying. */
const climbSpeed = 3.5;
/** Wing beats a second: hard off the stone, easier cruising. */
const takeoffFlapRate = 7;
const cruiseFlapRate = 4;
/** Seconds from takeoff until it is out of sight past the treeline. */
export const crowGoneSeconds = 6;

const perched: CrowFlight = {
    stage: CrowStage.Perched,
    distance: 0,
    height: 0,
    flapRate: 0,
};

/** The crow's flight `seconds` after it took off: perched for a crow that
 *  has not, which `Infinity` stands for. */
export function readCrowFlight(seconds: number): CrowFlight {
    if (!Number.isFinite(seconds) || seconds < 0) return perched;
    if (seconds < riseSeconds) {
        const share = seconds / riseSeconds;
        return {
            stage: CrowStage.Rising,
            distance: riseDistance * share * share,
            height: riseHeight * share * (2 - share),
            flapRate: takeoffFlapRate,
        };
    }
    const flying = seconds - riseSeconds;
    const settle = Math.min(flying, 1);
    return {
        stage: seconds < crowGoneSeconds ? CrowStage.Flying : CrowStage.Gone,
        distance: riseDistance + flySpeed * flying + flyGain * flying * flying,
        height: riseHeight + climbSpeed * flying,
        flapRate: takeoffFlapRate + (cruiseFlapRate - takeoffFlapRate) * settle,
    };
}
