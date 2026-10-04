// @vitest-environment node
import { expect, it } from "vitest";
import { MonsterKind, WaveName } from "../../src/siege/traits";
import {
    bossEvery,
    drawMonsterKind,
    hordeCap,
    nameWave,
    nightWaves,
    planWave,
    standingCap,
} from "../../src/siege/waves";

//  The named waves: which of the night's waves carry a name, and what each
//  name sends. Pure numbers, read without a world.

const seeds = Array.from({ length: 200 }, (_, index) => index * 7919 + 13);
const waves = Array.from({ length: nightWaves }, (_, index) => index + 1);
const names = [
    WaveName.Swarm,
    WaveName.Brutes,
    WaveName.SpitterRain,
    WaveName.Horde,
];

it("names five of the night's fifteen waves, never the first two nor a colossus's", () => {
    for (const seed of seeds) {
        const named = waves.filter((wave) => nameWave(seed, wave) !== "");
        expect(named).toHaveLength(5);
        for (const wave of named) {
            expect(wave).toBeGreaterThan(2);
            expect(wave % bossEvery).not.toBe(0);
        }
    }
});

it("sends every name at least once a night, and never the same name twice running", () => {
    for (const seed of seeds) {
        const sent = waves
            .map((wave) => nameWave(seed, wave))
            .filter((name) => name !== "");
        for (const name of names) expect(sent).toContain(name);
        for (let index = 1; index < sent.length; index++)
            expect(sent[index]).not.toBe(sent[index - 1]);
    }
});

it("never sends two named waves back to back", () => {
    for (const seed of seeds)
        for (const wave of waves.slice(1))
            if (nameWave(seed, wave) !== "")
                expect(nameWave(seed, wave - 1)).toBe("");
});

it("keeps no Brutes wave before the first colossus", () => {
    for (const seed of seeds)
        for (const wave of waves.filter((wave) => wave < bossEvery))
            expect(nameWave(seed, wave)).not.toBe(WaveName.Brutes);
});

it("sends no Horde before wave 4, so the night's first flood follows a wave of learning", () => {
    for (const seed of seeds)
        for (const wave of [1, 2, 3])
            expect(nameWave(seed, wave)).not.toBe(WaveName.Horde);
});

it("names the same waves from the same seed, and other waves from another", () => {
    const night = (seed: number) => waves.map((wave) => nameWave(seed, wave));
    expect(night(seeds[0])).toEqual(night(seeds[0]));
    expect(
        new Set(seeds.map((seed) => night(seed).join())).size,
    ).toBeGreaterThan(20);
});

it("goes on naming about one wave in three in Endless", () => {
    for (const seed of seeds.slice(0, 20)) {
        const endless = Array.from({ length: 30 }, (_, index) => 16 + index);
        const named = endless.filter((wave) => nameWave(seed, wave) !== "");
        expect(named.length).toBeGreaterThanOrEqual(8);
        expect(named.length).toBeLessThanOrEqual(14);
        for (const wave of named) expect(wave % bossEvery).not.toBe(0);
    }
});

/** The kinds a plan sends, drawn many times. */
function drawKinds(wave: number, name: WaveName) {
    const plan = planWave(wave, 2, name);
    const seeded = { seed: 99 };
    const kinds = new Set<MonsterKind>();
    for (let draw = 0; draw < 400; draw++)
        kinds.add(drawMonsterKind(seeded, wave, plan.mix));
    return kinds;
}

it("sends only skitters in a Swarm, only brutes in Brutes, and only husks in a Horde", () => {
    expect([...drawKinds(7, WaveName.Swarm)]).toEqual([MonsterKind.Skitter]);
    expect([...drawKinds(7, WaveName.Brutes)]).toEqual([MonsterKind.Brute]);
    expect([...drawKinds(7, WaveName.Horde)]).toEqual([MonsterKind.Husk]);
});

it("sends mostly spitters in Spitter rain", () => {
    const plan = planWave(7, 2, WaveName.SpitterRain);
    const seeded = { seed: 5 };
    let spitters = 0;
    for (let draw = 0; draw < 1000; draw++)
        if (drawMonsterKind(seeded, 7, plan.mix) === MonsterKind.Spitter)
            spitters++;
    expect(spitters).toBeGreaterThan(550);
});

it("floods a Horde with more and weaker husks than the wave would send, up to its own cap", () => {
    const plain = planWave(9, 3);
    const horde = planWave(9, 3, WaveName.Horde);

    expect(horde.count).toBeGreaterThan(plain.count * 2);
    expect(horde.health).toBeLessThan(plain.health);
    expect(horde.elites).toBe(false);
    expect(plain.cap).toBe(standingCap);
    expect(horde.cap).toBe(hordeCap);
    expect(hordeCap).toBeGreaterThan(standingCap);
    //  One number for the room, whoever is in it.
    expect(planWave(9, 1, WaveName.Horde).cap).toBe(hordeCap);
});

it("sends fewer, tougher monsters in a Brutes wave and more in a Swarm", () => {
    const plain = planWave(8, 2);
    expect(planWave(8, 2, WaveName.Brutes).count).toBeLessThan(plain.count);
    expect(planWave(8, 2, WaveName.Swarm).count).toBeGreaterThan(plain.count);
});

it("sends a slightly smaller wave to a warden alone", () => {
    for (const wave of [1, 6, 12]) {
        const solo = planWave(wave, 1).count;
        expect(solo).toBeLessThan(8 + 4 * wave);
        expect(solo).toBeGreaterThanOrEqual(Math.round((8 + 4 * wave) * 0.75));
    }
});
