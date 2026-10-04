import { expect, it } from "vitest";
import {
    admitVoice,
    AmbienceLayerName,
    AmbienceMood,
    createMixState,
    readAllyPlay,
    readAmbienceLevel,
    readDuckLevel,
    readTierPitch,
    SoundTier,
} from "../../src/audio/mix";

//  The mix's gate: how many of one sound play at once, how soon one may
//  follow another, and how far the crowd's sounds duck under a moment.

const falls = { voices: 3, gapSeconds: 0.08 };

it("lets a sound play up to its voices at once, then turns the next away", () => {
    const mix = createMixState();

    const admitted = [0, 0.1, 0.2, 0.3].map((now) =>
        admitVoice(mix, { key: "fall", ...falls, now, seconds: 1 }),
    );

    expect(admitted).toEqual([true, true, true, false]);
});

it("frees a voice once its play has ended", () => {
    const mix = createMixState();
    for (const now of [0, 0.1, 0.2])
        admitVoice(mix, { key: "fall", ...falls, now, seconds: 0.5 });

    expect(
        admitVoice(mix, { key: "fall", ...falls, now: 0.55, seconds: 0.5 }),
    ).toBe(true);
});

it("turns away a play that follows the last one sooner than its gap", () => {
    const mix = createMixState();
    admitVoice(mix, { key: "fall", ...falls, now: 0, seconds: 0.2 });

    expect(
        admitVoice(mix, { key: "fall", ...falls, now: 0.05, seconds: 0.2 }),
    ).toBe(false);
    expect(
        admitVoice(mix, { key: "fall", ...falls, now: 0.09, seconds: 0.2 }),
    ).toBe(true);
});

it("counts each sound apart", () => {
    const mix = createMixState();
    for (const now of [0, 0.1, 0.2])
        admitVoice(mix, { key: "fall", ...falls, now, seconds: 1 });

    expect(
        admitVoice(mix, { key: "hit", ...falls, now: 0.3, seconds: 1 }),
    ).toBe(true);
});

it("ducks the crowd at once under a moment and lets it back up after", () => {
    expect(readDuckLevel(0, undefined)).toBe(1);
    expect(readDuckLevel(1, 1)).toBeCloseTo(0.35, 2);
    //  Held through the moment's first beat, then back to full.
    expect(readDuckLevel(1.2, 1)).toBeCloseTo(0.35, 2);
    expect(readDuckLevel(1.5, 1)).toBeGreaterThan(0.35);
    expect(readDuckLevel(1.5, 1)).toBeLessThan(1);
    expect(readDuckLevel(2.5, 1)).toBe(1);
});

it("plays a teammate's shot in the crowd, quieter, two at once at most, and never in place of her own gun", () => {
    const mix = createMixState();
    const ally = readAllyPlay("rail", { voices: 4, gapSeconds: 0 });
    const allies = [0, 0.1, 0.2].map((now) =>
        admitVoice(mix, { ...ally, now, seconds: 1 }),
    );
    const own = admitVoice(mix, {
        key: "rail",
        voices: 2,
        gapSeconds: 0,
        now: 0.2,
        seconds: 1,
    });

    expect(ally.tier).toBe(SoundTier.Crowd);
    expect(ally.gain).toBeLessThan(1);
    expect(allies).toEqual([true, true, false]);
    expect(own).toBe(true);
});

it("raises a shot's pitch a little with each tier of the gun, and no more past the top", () => {
    const pitches = [0, 1, 2, 3, 4].map(readTierPitch);

    expect(pitches[0]).toBe(1);
    expect(pitches[1]).toBeGreaterThan(pitches[0]);
    expect(pitches[3]).toBeGreaterThan(pitches[2]);
    expect(pitches[3]).toBeLessThan(1.2);
    expect(pitches[4]).toBe(pitches[3]);
});

it("hushes the crickets and swells the drone while a wave stands, and brings both back after", () => {
    const read = (mood: AmbienceMood) =>
        [
            AmbienceLayerName.Crickets,
            AmbienceLayerName.Drone,
            AmbienceLayerName.Fire,
        ].map((layer) => readAmbienceLevel(layer, mood));
    const [crickets, drone, fire] = read(AmbienceMood.Fight);

    expect(read(AmbienceMood.Calm)).toEqual([1, 1, 1]);
    expect(crickets).toBeLessThan(0.5);
    expect(drone).toBeGreaterThan(1);
    expect(fire).toBe(1);
});
