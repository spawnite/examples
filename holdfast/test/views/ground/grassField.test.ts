import { QualityLevel } from "@spawnite/schema";
import { createGroundSurface, readMap, registerMaps } from "@spawnite/engine";
import { beforeAll, describe, expect, it } from "vitest";
import holdfastMap from "../../../src/maps/holdfast.json";
import {
    countDrawnBlades,
    type GrassPatch,
    plantGrass,
    readGrassShare,
} from "../../../src/views/ground/grassField";

registerMaps({ "maps/holdfast.json": { default: holdfastMap } });
const surface = createGroundSurface(readMap("holdfast"));

/** Every blade's root, as x, y, z. */
function readRoots(patches: GrassPatch[]) {
    const roots: [number, number, number][] = [];
    for (const patch of patches)
        for (let index = 0; index < patch.count; index++)
            roots.push([
                patch.roots[index * 4],
                patch.roots[index * 4 + 1],
                patch.roots[index * 4 + 2],
            ]);
    return roots;
}

describe("plantGrass", () => {
    let roots: [number, number, number][];
    beforeAll(() => {
        roots = readRoots(
            plantGrass({
                surface,
                share: readGrassShare(QualityLevel.Medium),
            }),
        );
    });

    it("plants a field of blades on the grass", () => {
        expect(roots.length).toBeGreaterThan(100_000);
    });

    it("roots every blade on the ground", () => {
        for (const [x, y, z] of roots.filter((_, index) => index % 97 === 0))
            expect(y).toBeCloseTo(surface.getHeightAt({ x, z }), 4);
    });

    it("plants nothing on the ring's cobbles or the hearth's flagstones", () => {
        //  The ring's cobbles run 14 m out, 1.3 m either side; the hearth's
        //  flagstones reach 4.5 m.
        const onStone = roots.filter(([x, , z]) => {
            const radius = Math.hypot(x, z);
            return Math.abs(radius - 14) < 1 || radius < 4;
        });
        expect(onStone).toEqual([]);
    });

    it("plants nothing down the middle of a road", () => {
        //  Every stretch of every dirt road in the map file, 1.6 m either
        //  side of its line, so a blade within 1 m of it is on the road.
        const roads = Object.values(holdfastMap.paths)
            .filter((path) => path.surface === "dirt")
            .flatMap((path) =>
                path.points
                    .slice(1)
                    .map(([toX, toZ], index) => [
                        ...path.points[index],
                        toX,
                        toZ,
                    ]),
            );
        const onRoad = roots.filter(([x, , z]) =>
            roads.some(([fromX, fromZ, toX, toZ]) => {
                const alongX = toX - fromX;
                const alongZ = toZ - fromZ;
                const share = Math.min(
                    1,
                    Math.max(
                        0,
                        ((x - fromX) * alongX + (z - fromZ) * alongZ) /
                            (alongX ** 2 + alongZ ** 2),
                    ),
                );
                return (
                    Math.hypot(
                        x - (fromX + alongX * share),
                        z - (fromZ + alongZ * share),
                    ) < 1
                );
            }),
        );
        expect(onRoad).toEqual([]);
    });
});

describe("the Graphics setting", () => {
    const countBlades = (level: QualityLevel) =>
        readRoots(plantGrass({ surface, share: readGrassShare(level) })).length;

    it("plants no grass at Minimum", () => {
        expect(countBlades(QualityLevel.Minimum)).toBe(0);
    });

    it("plants a sparse field at Low", () => {
        const low = countBlades(QualityLevel.Low);
        expect(low).toBeGreaterThan(0);
        expect(low).toBeLessThan(countBlades(QualityLevel.High) / 4);
    });

    it("plants Medium's field under Auto", () => {
        expect(countBlades(QualityLevel.Auto)).toBe(
            countBlades(QualityLevel.Medium),
        );
    });
});

describe("countDrawnBlades", () => {
    let patch: GrassPatch;
    beforeAll(() => {
        const found = plantGrass({ surface, share: 1 }).find(
            (each) => each.count > 0 && each.centerX > 20,
        );
        if (!found) throw new Error("No patch of grass east of the ring");
        patch = found;
    });

    it("draws every blade of the patch under the camera", () => {
        expect(
            countDrawnBlades(patch, { x: patch.centerX, z: patch.centerZ }),
        ).toBe(patch.count);
    });

    it("draws none of a patch far past the camera", () => {
        expect(
            countDrawnBlades(patch, {
                x: patch.centerX - 40,
                z: patch.centerZ,
            }),
        ).toBe(0);
    });

    it("draws part of a patch halfway out", () => {
        const drawn = countDrawnBlades(patch, {
            x: patch.centerX - 20,
            z: patch.centerZ,
        });
        expect(drawn).toBeGreaterThan(0);
        expect(drawn).toBeLessThan(patch.count);
    });
});
