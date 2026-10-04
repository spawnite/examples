import { topTier } from "../siege/guns";

//  The mix's gate, kept apart from the Web Audio graph so it can be tested:
//  how many plays of one sound sound at once, how soon one may follow the
//  last, and how far the crowd's sounds duck under a moment. A Horde of 60
//  falling in a few seconds is three soft falls at a time, not sixty, and a
//  reaction or a capstone plays over a hush, as Deep Rock Galactic and
//  Diablo mix a crowd under their big moments.

/** Where a sound sits in the mix. */
export enum SoundTier {
    /** What a crowd makes many of: falls, hits, arcs, feet. It ducks under
     *  a moment. */
    Crowd = "crowd",
    /** Her own gun, her own news, and the wave's cues: never ducked. */
    Main = "main",
    /** A reaction, a capstone or a colossus falling: it ducks the crowd. */
    Moment = "moment",
}

/** The plays of each sound still sounding, and when each sound last
 *  started, in the audio clock's seconds. */
export interface MixState {
    ends: Map<string, number[]>;
    last: Map<string, number>;
}

export function createMixState(): MixState {
    return { ends: new Map(), last: new Map() };
}

interface Voice {
    key: string;
    /** Plays of the sound that may sound at once. */
    voices: number;
    /** Seconds a play must wait after the last one started. */
    gapSeconds: number;
    now: number;
    /** Seconds this play sounds. */
    seconds: number;
}

/** Whether a play of `key` may start `now`, and if so counts it: turned
 *  away while its voices are full or its last play started within its gap.
 *  Turning the newest away rather than cutting the oldest keeps each fall
 *  whole; with a crowd, one more is not missed. */
export function admitVoice(
    state: MixState,
    { key, voices, gapSeconds, now, seconds }: Voice,
) {
    const last = state.last.get(key);
    if (last !== undefined && now - last < gapSeconds) return false;
    const ends = (state.ends.get(key) ?? []).filter((end) => end > now);
    if (ends.length >= voices) {
        state.ends.set(key, ends);
        return false;
    }
    ends.push(now + seconds);
    state.ends.set(key, ends);
    state.last.set(key, now);
    return true;
}

/** The crowd's level under a moment: down at once, held through the
 *  moment's first beat, then back up. */
export const duckLevel = 0.35;
export const duckHoldSeconds = 0.25;
export const duckReleaseSeconds = 0.9;

/** The crowd's level `now`, where the last moment started at `momentAt`. */
export function readDuckLevel(now: number, momentAt: number | undefined) {
    if (momentAt === undefined) return 1;
    const since = now - momentAt - duckHoldSeconds;
    if (since <= 0) return duckLevel;
    if (since >= duckReleaseSeconds) return 1;
    return duckLevel + (1 - duckLevel) * (since / duckReleaseSeconds);
}

const allyGain = 0.5;
const allyVoices = 2;
const allyGapSeconds = 0.06;

/** How a teammate's shot plays: under a key of its own, so her gun never
 *  takes a voice from the player's own, in the crowd, which ducks under a
 *  moment, at half its level, and two at once at most. The player's own
 *  gun stays on top, as shooters weight the player's gun over a
 *  teammate's. */
export function readAllyPlay(
    key: string,
    { voices, gapSeconds }: { voices: number; gapSeconds: number },
) {
    return {
        key: `${key}:ally`,
        tier: SoundTier.Crowd,
        gain: allyGain,
        voices: Math.min(voices, allyVoices),
        gapSeconds: Math.max(gapSeconds, allyGapSeconds),
    };
}

/** How much higher each tier plays a shot: Pack-a-Punch's higher pitch, a
 *  step at a time, so the top tier plays about a minor third up. */
const tierPitchStep = 0.06;

/** The pitch a shot of a gun at `tier` plays at, as a ratio. */
export function readTierPitch(tier: number) {
    return 1 + tierPitchStep * clampTier(tier);
}

/** `tier` within a gun's tiers, 0 to the top. */
export function clampTier(tier: number) {
    return Math.min(Math.max(tier, 0), topTier);
}

/** The night's two moods for its sound bed: calm while the wardens gather
 *  and rest, and a fight while a wave stands. */
export enum AmbienceMood {
    Calm = "calm",
    Fight = "fight",
}

/** The night bed's layers. */
export enum AmbienceLayerName {
    Crickets = "crickets",
    Fire = "fire",
    Drone = "drone",
}

/** Each bed layer's level in a fight, as a share of its calm level: the
 *  crickets fall quiet as the Hollow come, and the low drone swells under
 *  the fight. */
const fightLevels: Partial<Record<AmbienceLayerName, number>> = {
    [AmbienceLayerName.Crickets]: 0.25,
    [AmbienceLayerName.Drone]: 2.2,
};

/** The share of its calm level the bed's `layer` plays at in `mood`. */
export function readAmbienceLevel(
    layer: AmbienceLayerName,
    mood: AmbienceMood,
) {
    return mood === AmbienceMood.Fight ? (fightLevels[layer] ?? 1) : 1;
}
