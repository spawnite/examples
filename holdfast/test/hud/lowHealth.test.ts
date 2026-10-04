import { describe, expect, it } from "vitest";
import {
    easeLowHealth,
    measureBeatSeconds,
    measureLowHealth,
} from "../../src/hud/LowHealth";

describe("measureLowHealth", () => {
    it("is nothing at or above 30% health", () => {
        expect(measureLowHealth(0.3)).toBe(0);
        expect(measureLowHealth(0.8)).toBe(0);
    });

    it("rises as her health falls under 30%", () => {
        expect(measureLowHealth(0.25)).toBeGreaterThan(0);
        expect(measureLowHealth(0.1)).toBeGreaterThan(measureLowHealth(0.25));
        expect(measureLowHealth(0)).toBe(1);
    });
});

describe("easeLowHealth", () => {
    it("moves toward the target over about half a second, never at once", () => {
        const after = easeLowHealth({ level: 0, target: 1, seconds: 1 / 60 });

        expect(after).toBeGreaterThan(0);
        expect(after).toBeLessThan(0.1);
    });

    it("reaches the target within a couple of seconds", () => {
        let level = 0;
        for (let frame = 0; frame < 120; frame++)
            level = easeLowHealth({ level, target: 1, seconds: 1 / 60 });

        expect(level).toBeGreaterThan(0.95);
    });
});

describe("measureBeatSeconds", () => {
    it("beats faster the lower she is", () => {
        expect(measureBeatSeconds(1)).toBeLessThan(measureBeatSeconds(0.2));
    });

    it("stays between 60 and 110 beats a minute", () => {
        for (const level of [0, 0.5, 1]) {
            expect(measureBeatSeconds(level)).toBeLessThanOrEqual(1);
            expect(measureBeatSeconds(level)).toBeGreaterThanOrEqual(60 / 110);
        }
    });
});
