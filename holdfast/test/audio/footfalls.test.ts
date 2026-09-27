import { describe, expect, it } from "vitest";
import {
    advanceFootWalk,
    createFootWalk,
    type FootGround,
    FootSurface,
    readFootSurface,
    strideMetres,
} from "../../src/audio/footfalls";

/** A ground with no road anywhere. */
const bareGround: FootGround = { getPathSurfaceAt: () => undefined };

/** A ground whose dirt road shows `weight` everywhere. */
function createRoadGround(weight: number): FootGround {
    return { getPathSurfaceAt: () => ({ surface: "dirt", weight }) };
}

describe("readFootSurface", () => {
    it("reads paving on the cobbled ring", () => {
        expect(readFootSurface({ x: 14, z: 0 }, bareGround)).toBe(
            FootSurface.Paving,
        );
        expect(readFootSurface({ x: 0, z: -15.2 }, bareGround)).toBe(
            FootSurface.Paving,
        );
    });

    it("reads paving on the hearth's flagstones", () => {
        expect(readFootSurface({ x: 1, z: -2 }, bareGround)).toBe(
            FootSurface.Paving,
        );
    });

    it("reads paving where a road crosses the ring", () => {
        expect(readFootSurface({ x: 0, z: 14 }, createRoadGround(1))).toBe(
            FootSurface.Paving,
        );
    });

    it("reads path on a dirt road", () => {
        expect(readFootSurface({ x: 0, z: 25 }, createRoadGround(0.9))).toBe(
            FootSurface.Path,
        );
    });

    it("reads grass at a road's faded edge", () => {
        expect(readFootSurface({ x: 0, z: 25 }, createRoadGround(0.3))).toBe(
            FootSurface.Grass,
        );
    });

    it("reads path on the ring's packed-earth verge", () => {
        expect(readFootSurface({ x: 0, z: 16 }, bareGround)).toBe(
            FootSurface.Path,
        );
        expect(readFootSurface({ x: -12, z: 0 }, bareGround)).toBe(
            FootSurface.Path,
        );
    });

    it("reads path on the earth round the hearth's rim", () => {
        expect(readFootSurface({ x: 4.8, z: 0 }, bareGround)).toBe(
            FootSurface.Path,
        );
    });

    it("reads grass between the hearth and the ring", () => {
        expect(readFootSurface({ x: 8, z: 0 }, bareGround)).toBe(
            FootSurface.Grass,
        );
    });

    it("reads grass past the ring off every road", () => {
        expect(readFootSurface({ x: 20, z: 20 }, bareGround)).toBe(
            FootSurface.Grass,
        );
    });

    it("reads the circle's paving before the ground has loaded", () => {
        expect(readFootSurface({ x: 14, z: 0 }, undefined)).toBe(
            FootSurface.Paving,
        );
        expect(readFootSurface({ x: 20, z: 20 }, undefined)).toBe(
            FootSurface.Grass,
        );
    });
});

/** Walks from the origin along x in steps of `step` metres until `metres`,
 *  and counts the footfalls. */
function countFootfalls(metres: number, step: number) {
    const walk = createFootWalk();
    advanceFootWalk(walk, { x: 0, z: 0 });
    let footfalls = 0;
    for (let x = step; x <= metres + 1e-9; x += step)
        if (advanceFootWalk(walk, { x, z: 0 })) footfalls++;
    return footfalls;
}

describe("advanceFootWalk", () => {
    it("takes no step on the frame that places her", () => {
        expect(advanceFootWalk(createFootWalk(), { x: 5, z: 5 })).toBe(false);
    });

    it("steps once per stride she covers", () => {
        expect(countFootfalls(strideMetres * 3 + 0.05, 0.05)).toBe(3);
        expect(countFootfalls(strideMetres * 3 - 0.05, 0.05)).toBe(2);
    });

    it("takes no step for a jump across the map", () => {
        const walk = createFootWalk();
        advanceFootWalk(walk, { x: 0, z: 0 });
        expect(advanceFootWalk(walk, { x: 20, z: 0 })).toBe(false);
        //  The jump counts toward no stride after it either.
        expect(
            advanceFootWalk(walk, { x: 20 + strideMetres * 0.5, z: 0 }),
        ).toBe(false);
    });

    it("walks on from where a jump put her", () => {
        const walk = createFootWalk();
        advanceFootWalk(walk, { x: 0, z: 0 });
        advanceFootWalk(walk, { x: 20, z: 0 });
        advanceFootWalk(walk, { x: 20 + strideMetres * 0.6, z: 0 });
        expect(
            advanceFootWalk(walk, { x: 20 + strideMetres * 1.1, z: 0 }),
        ).toBe(true);
    });
});
