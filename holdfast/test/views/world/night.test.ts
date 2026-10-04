// @vitest-environment node
import { expect, it } from "vitest";
import { calculateDaylight } from "@spawnite/engine";

import type { Phase } from "../../../src/siege/phase";
import { nightWaves } from "../../../src/siege/waves";
import {
    createNightSky,
    measureNight,
    readNightSky,
    skyStops,
} from "../../../src/views/world/night";

//  The night's sky: where each moment of a run stands on it, and what the
//  sky and the light are there.

const run = (phase: Phase, wave: number, endless = false) => ({
    phase,
    wave,
    endless,
});

it("stands at dusk while the wardens gather and through the first wave", () => {
    expect(measureNight(run("waiting", 0))).toBe(0);
    expect(measureNight(run("breather", 0))).toBe(0);
    expect(measureNight(run("fight", 1))).toBe(0);
});

it("moves on a wave at each breather, toward the wave to come", () => {
    const shares = Array.from({ length: nightWaves }, (_, index) =>
        measureNight(run("fight", index + 1)),
    );
    for (let index = 1; index < shares.length; index++)
        expect(shares[index]).toBeGreaterThan(shares[index - 1]);
    expect(measureNight(run("breather", 6))).toBe(
        measureNight(run("fight", 7)),
    );
});

it("reaches sunrise at dawn, climbs through Endless to a morning, and keeps the fallen wave's sky on the end screen", () => {
    expect(measureNight(run("dawn", nightWaves))).toBe(1);
    const endless = measureNight(run("fight", 20, true));
    expect(endless).toBeGreaterThan(1);
    expect(measureNight(run("fight", 200, true))).toBe(skyStops.at(-1)?.at);
    expect(measureNight(run("over", 9))).toBe(measureNight(run("fight", 9)));
    expect(measureNight(run("over", 22, true))).toBe(
        measureNight(run("fight", 22, true)),
    );
});

it("has the sun under the horizon through the night and over it at dawn", () => {
    const sky = createNightSky();
    const elevation = (night: number) =>
        readNightSky(night, sky).sunDirection.y;

    expect(elevation(0)).toBeGreaterThan(0);
    expect(elevation(0.5)).toBeLessThan(0);
    expect(elevation(0.8)).toBeLessThan(0);
    expect(elevation(1)).toBeGreaterThan(0);
});

it("sets in the west and rises in the east", () => {
    const sky = createNightSky();
    const dusk = readNightSky(0, sky).sunDirection.clone().setY(0);
    const dawn = readNightSky(1, sky).sunDirection.clone().setY(0);

    expect(dusk.normalize().dot(dawn.normalize())).toBeLessThan(-0.5);
});

it("never lights the circle darker than two thirds of dusk's exposure", () => {
    const sky = createNightSky();
    for (let night = 0; night <= 1.3; night += 0.01) {
        const { exposure } = calculateDaylight(readNightSky(night, sky).hour);
        expect(exposure).toBeGreaterThan(0.66);
    }
});

it("grades dusk and dawn warm and midnight cool, and never boosts saturation", () => {
    const sky = createNightSky();
    const warmth = (night: number) => {
        const { tint } = readNightSky(night, sky);
        return tint.r - tint.b;
    };

    expect(warmth(0)).toBeGreaterThan(0);
    expect(warmth(0.5)).toBeLessThan(0);
    expect(warmth(1)).toBeGreaterThan(0);
    //  A boost turns a color the bloom pushed past white black.
    for (const stop of skyStops) expect(stop.saturation).toBeLessThanOrEqual(0);
});
