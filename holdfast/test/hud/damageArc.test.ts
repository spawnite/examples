import { describe, expect, it } from "vitest";
import {
    didStrikeHer,
    fadeArc,
    findBlowSource,
    measureArcAngle,
} from "../../src/hud/DamageArc";

describe("measureArcAngle", () => {
    //  She faces along negative z, as the camera does at rest.
    const facing = { x: 0, z: -1 };
    const from = { x: 2, z: 3 };

    it("points up for a blow from ahead", () => {
        expect(
            measureArcAngle({ from, to: { x: 2, z: -5 }, facing }),
        ).toBeCloseTo(0);
    });

    it("points right for a blow from her right", () => {
        expect(
            measureArcAngle({ from, to: { x: 6, z: 3 }, facing }),
        ).toBeCloseTo(Math.PI / 2);
    });

    it("points left for a blow from her left", () => {
        expect(
            measureArcAngle({ from, to: { x: -1, z: 3 }, facing }),
        ).toBeCloseTo(-Math.PI / 2);
    });

    it("points down for a blow from behind", () => {
        expect(
            Math.abs(measureArcAngle({ from, to: { x: 2, z: 9 }, facing })),
        ).toBeCloseTo(Math.PI);
    });

    it("turns with her: a blow from the east is ahead once she faces east", () => {
        expect(
            measureArcAngle({
                from,
                to: { x: 9, z: 3 },
                facing: { x: 1, z: 0 },
            }),
        ).toBeCloseTo(0);
    });
});

describe("findBlowSource", () => {
    const hero = { x: 0, z: 0 };

    it("takes the monster that struck over a nearer one that did not", () => {
        const source = findBlowSource(hero, [
            { position: { x: 1, z: 0 }, struck: false },
            { position: { x: 0, z: 2 }, struck: true },
        ]);

        expect(source).toEqual({ x: 0, z: 2 });
    });

    it("takes the nearest of two that struck", () => {
        const source = findBlowSource(hero, [
            { position: { x: 3, z: 0 }, struck: true },
            { position: { x: 0, z: -1.5 }, struck: true },
        ]);

        expect(source).toEqual({ x: 0, z: -1.5 });
    });

    it("falls back to the nearest monster when none struck", () => {
        const source = findBlowSource(hero, [
            { position: { x: 8, z: 0 }, struck: false },
            { position: { x: -4, z: 0 }, struck: false },
        ]);

        expect(source).toEqual({ x: -4, z: 0 });
    });

    it("finds nothing with no monster", () => {
        expect(findBlowSource(hero, [])).toBeNull();
    });
});

describe("fadeArc", () => {
    it("holds full strength just after the blow", () => {
        expect(fadeArc(0.1)).toBe(1);
    });

    it("fades to nothing in about a second", () => {
        expect(fadeArc(0.6)).toBeGreaterThan(0);
        expect(fadeArc(0.6)).toBeLessThan(1);
        expect(fadeArc(1)).toBe(0);
    });
});

describe("didStrikeHer", () => {
    const hero = { x: 0, z: 0 };
    const still = { clawed: false, slammed: false, slam: null };

    it("counts a claw from a monster within its reach of her", () => {
        expect(
            didStrikeHer({
                ...still,
                hero,
                monster: { x: 1, z: 0 },
                clawReach: 1.1,
                clawed: true,
            }),
        ).toBe(true);
    });

    it("does not count a claw at a teammate beyond its reach of her", () => {
        expect(
            didStrikeHer({
                ...still,
                hero,
                monster: { x: 3, z: 0 },
                clawReach: 1.1,
                clawed: true,
            }),
        ).toBe(false);
    });

    it("counts a slam whose ring she stood in", () => {
        expect(
            didStrikeHer({
                ...still,
                hero,
                monster: { x: 6, z: 0 },
                clawReach: 2,
                slammed: true,
                slam: { x: 4, z: 0, radius: 5.5 },
            }),
        ).toBe(true);
    });

    it("does not count a slam whose ring she stood outside", () => {
        expect(
            didStrikeHer({
                ...still,
                hero,
                monster: { x: 12, z: 0 },
                clawReach: 2,
                slammed: true,
                slam: { x: 12, z: 0, radius: 5.5 },
            }),
        ).toBe(false);
    });
});
