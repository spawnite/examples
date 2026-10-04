// @vitest-environment node
import { PlaneGeometry, Vector3 } from "three";
import {
    createGroundSurface,
    raiseHeightfield,
    readMap,
    registerMaps,
} from "@spawnite/engine";
import { expect, it } from "vitest";
import holdfastMap from "../../../src/maps/holdfast.json";
import {
    placeThicket,
    placeTrees,
} from "../../../src/views/world/forest/forestPlaces";
import {
    isOnRoad,
    mapEdgeMetres,
    measureTrackDistance,
    readLandHeight,
} from "../../../src/views/world/land";
import { buildLand, matchEdgeNormals } from "../../../src/views/world/Outland";

//  The land past the map's edge, the tracks the roads run on as across it,
//  and the thicket that stands where the engine's walls stop a warden.

registerMaps({ "maps/holdfast.json": { default: holdfastMap } });
const surface = createGroundSurface(readMap("holdfast"));

it("carries the map's ground on past its edge with no step", () => {
    const edge = mapEdgeMetres;
    for (let along = -edge; along <= edge; along += 5) {
        //  A point on each side's edge, and one half a metre past it.
        for (const [onEdge, past] of [
            [
                { x: along, z: -edge },
                { x: along, z: -edge - 0.5 },
            ],
            [
                { x: edge, z: along },
                { x: edge + 0.5, z: along },
            ],
            [
                { x: along, z: edge },
                { x: along, z: edge + 0.5 },
            ],
            [
                { x: -edge, z: along },
                { x: -edge - 0.5, z: along },
            ],
        ]) {
            const step =
                readLandHeight(surface, past) - surface.getHeightAt(onEdge);
            expect(Math.abs(step)).toBeLessThan(0.2);
        }
    }
});

it("meets the map's ground on the ground's own vertices, so no crack opens along the edge", () => {
    const geometry = buildLand(surface);
    const positions = geometry.getAttribute("position");
    const triangles = geometry.getIndex()!;
    //  The height of every vertex a drawn triangle uses, by its place.
    const drawn = new Map<string, number>();
    for (let corner = 0; corner < triangles.count; corner++) {
        const vertex = triangles.getX(corner);
        drawn.set(
            `${positions.getX(vertex)},${positions.getZ(vertex)}`,
            positions.getY(vertex),
        );
    }
    for (let triangle = 0; triangle < triangles.count; triangle += 3) {
        let x = 0;
        let z = 0;
        for (let corner = 0; corner < 3; corner++) {
            x += positions.getX(triangles.getX(triangle + corner)) / 3;
            z += positions.getZ(triangles.getX(triangle + corner)) / 3;
        }
        //  None over the map's own ground.
        expect(Math.max(Math.abs(x), Math.abs(z))).toBeGreaterThan(
            mapEdgeMetres,
        );
    }
    //  The ground's cell is a metre: every one of its edge vertices is the
    //  land's too, at the ground's height.
    const edge = mapEdgeMetres;
    for (let along = -edge; along <= edge; along++) {
        for (const [x, z] of [
            [along, -edge],
            [edge, along],
            [along, edge],
            [-edge, along],
        ]) {
            expect(drawn.get(`${x},${z}`)).toBeCloseTo(
                surface.getHeightAt({ x, z }),
                4,
            );
        }
    }
    geometry.dispose();
});

it("runs each road on as a track that bends out of the road's line", () => {
    //  On each road's line at the rim, and well off it 40 m further out.
    for (const [x, z] of [
        [0, -mapEdgeMetres],
        [mapEdgeMetres, 0],
        [0, mapEdgeMetres],
        [-mapEdgeMetres, 0],
    ]) {
        expect(measureTrackDistance({ x, z })).toBeLessThan(1.5);
        expect(
            measureTrackDistance({ x: x * 1.8, z: z * 1.8 }),
        ).toBeGreaterThan(10);
    }
});

it("stands no tree on a road or its track", () => {
    const at = new Vector3();
    for (const place of placeTrees(surface)) {
        at.setFromMatrixPosition(place.matrix);
        expect(isOnRoad({ x: at.x, z: at.z })).toBe(false);
    }
});

it("dresses every side of the wall, each road's crossing among it", () => {
    const at = new Vector3();
    const sides = { north: 0, east: 0, south: 0, west: 0 };
    const crossings = { north: 0, east: 0, south: 0, west: 0 };
    for (const place of placeThicket(surface)) {
        at.setFromMatrixPosition(place.matrix);
        //  Everything stands on or just past the wall's line.
        const out = Math.max(Math.abs(at.x), Math.abs(at.z)) - mapEdgeMetres;
        expect(out).toBeGreaterThan(-0.5);
        expect(out).toBeLessThan(8);
        const side =
            Math.abs(at.z) > Math.abs(at.x)
                ? at.z < 0
                    ? "north"
                    : "south"
                : at.x > 0
                  ? "east"
                  : "west";
        sides[side]++;
        if (Math.abs(side === "north" || side === "south" ? at.x : at.z) < 3)
            crossings[side]++;
    }
    for (const count of Object.values(sides)) expect(count).toBeGreaterThan(60);
    for (const count of Object.values(crossings))
        expect(count).toBeGreaterThan(0);
});

it("lights the seam alike from both sides: the land's edge takes the ground's own normals", () => {
    const ground = new PlaneGeometry(
        surface.size,
        surface.size,
        surface.segments,
        surface.segments,
    );
    raiseHeightfield(ground, surface);
    ground.computeVertexNormals();
    const land = buildLand(surface);
    matchEdgeNormals(land, ground);

    //  The ground's normal at each edge vertex, turned up out of its plane.
    const groundNormals = new Map<string, Vector3>();
    const groundPositions = ground.getAttribute("position");
    const groundNormal = ground.getAttribute("normal");
    for (let index = 0; index < groundPositions.count; index++) {
        const x = groundPositions.getX(index);
        const z = -groundPositions.getY(index);
        if (Math.max(Math.abs(x), Math.abs(z)) < mapEdgeMetres) continue;
        groundNormals.set(
            `${x},${z}`,
            new Vector3(
                groundNormal.getX(index),
                groundNormal.getZ(index),
                -groundNormal.getY(index),
            ),
        );
    }
    const positions = land.getAttribute("position");
    const normals = land.getAttribute("normal");
    let seam = 0;
    for (let index = 0; index < positions.count; index++) {
        const expected = groundNormals.get(
            `${positions.getX(index)},${positions.getZ(index)}`,
        );
        if (!expected) continue;
        const normal = new Vector3().fromBufferAttribute(normals, index);
        expect(normal.angleTo(expected)).toBeLessThan(1e-4);
        seam++;
    }
    expect(seam).toBe(4 * 2 * mapEdgeMetres);
    ground.dispose();
    land.dispose();
});
