// @vitest-environment node
import { DoubleSide, Ray, Vector3, type BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { describe, expect, it } from "vitest";
import { buildRun, levels, Track, type LevelPoint } from "../../src/levels";
import { hillsideAt } from "../../src/track/hillside";
import {
    edges,
    shoulderWidth,
    snowDepthAt,
    tileMetres,
} from "../../src/track/profile";
import { buildSlopeSurface } from "../../src/track/surface";

const halfLane = 4; //  every straight fixture authors a lane 8 m wide

/** How many of the ground's vertices are the run's surface: the terrain's
 *  follow them, drawn by the last group. */
function surfaceVertices(geometry: BufferGeometry) {
    const index = geometry.getIndex()!.array;
    let least = Infinity;
    for (let at = geometry.groups.at(-1)!.start; at < index.length; at++)
        least = Math.min(least, index[at]);
    return least;
}

/** Three points 20 m apart on the level, each vertex read back with its
 *  lateral offset. Heights run along the frame's up, so only a flat track
 *  lets a test read them as world Y, and the ground under the ride surface
 *  is 0 there. */
function surface(surfaceName: "snow" | "ice" = "snow") {
    const points: LevelPoint[] = [0, 1, 2].map((index) => ({
        x: 0,
        y: 0,
        z: -20 * index,
        width: 8,
        zone: surfaceName,
    }));
    const geometry = buildSlopeSurface(buildRun(points));
    const positions = geometry.getAttribute("position").array;
    const uvs = geometry.getAttribute("uv").array;
    return Array.from({ length: surfaceVertices(geometry) }, (_, vertex) => ({
        //  Read back out of the uv the GPU is handed (u is lateral over the
        //  tile), so a test addresses a vertex by where it is.
        lateral: uvs[vertex * 2] * tileMetres,
        y: positions[vertex * 3 + 1],
    }));
}

//  The ride surface is the ground plus the loose snow, which the wind
//  carves down and never piles up.
describe("the snow layer", () => {
    function eachRideVertex(
        built: ReturnType<typeof surface>,
        visit: (lift: number, lateral: number) => void,
    ) {
        let seen = 0;
        for (const { lateral, y } of built) {
            if (Math.abs(lateral) > halfLane + shoulderWidth) continue;
            visit(y, lateral);
            seen++;
        }
        expect(seen).toBeGreaterThan(0);
    }

    it("never lets the drift cut through the snow to the ground", () => {
        eachRideVertex(surface(), (lift) => expect(lift).toBeGreaterThan(0));
    });

    it("never drifts the snow above its authored depth", () => {
        eachRideVertex(surface(), (lift, lateral) =>
            //  The slack is the float32 uv the lateral came back through.
            expect(lift).toBeLessThanOrEqual(
                snowDepthAt(lateral, { halfWidth: halfLane, ice: 0 }) + 1e-6,
            ),
        );
    });

    it("leaves an ice lane bare and its shoulders deep", () => {
        eachRideVertex(surface("ice"), (lift, lateral) => {
            const across = Math.abs(lateral);
            if (across <= halfLane) expect(lift).toBeCloseTo(0, 6);
            else if (Math.abs(across - halfLane - shoulderWidth) < 1e-3)
                expect(lift).toBeGreaterThan(0);
        });
    });
});

describe("the hillside", () => {
    it("stands the apron where the scenery will stand", () => {
        const points: LevelPoint[] = [
            { x: 0, y: 0, z: 0, width: 8 },
            { x: 0, y: -2, z: -20, width: 8 },
            { x: 10, y: -4, z: -40, width: 8 },
        ];
        const run = buildRun(points);
        const geometry = buildSlopeSurface(run);
        const positions = geometry.getAttribute("position").array;
        const uvs = geometry.getAttribute("uv").array;
        const { wall } = edges(halfLane);
        const lateralOf = (vertex: number) => uvs[vertex * 2] * tileMetres;
        const verts = surfaceVertices(geometry) / run.rings.length;
        const count = surfaceVertices(geometry) * 3;
        const rim = Math.max(
            ...Array.from({ length: count / 3 }, (_, vertex) =>
                Math.abs(lateralOf(vertex)),
            ),
        );
        let seen = 0;
        for (let at = 0; at < count; at += 3) {
            const lateral = lateralOf(at / 3);
            //  The float32 uv again: a fence top reads a hair inside it.
            if (Math.abs(lateral) < wall - 1e-3) continue;
            //  A side the bend's far end cuts short ends at that end's
            //  height, which the scenery there stands on.
            const first = Math.floor(at / 3 / verts) * verts;
            const end = lateralOf(lateral < 0 ? first : first + verts - 1);
            if (Math.abs(end) < rim - 1e-3 && Math.abs(lateral - end) < 1e-3)
                continue;
            expect(
                hillsideAt(run, positions[at], positions[at + 2]),
            ).toBeCloseTo(positions[at + 1], 4);
            seen++;
        }
        expect(seen).toBeGreaterThan(0);
    });

    //  On level 1 the inside of the last bend reaches the stretch 35 m
    //  along: the hillside ramps from one to the other, with no step.
    it("meets itself where two stretches of the run meet", () => {
        const run = buildRun(levels[Track.One].track.points);
        const geometry = buildSlopeSurface(run);
        const positions = geometry.getAttribute("position").array;
        const verts = surfaceVertices(geometry) / run.rings.length;
        const rimOf = (ring: number) =>
            new Vector3().fromArray(positions, ring * verts * 3);
        const stretch = rimOf(
            run.rings.findIndex(({ distance }) => distance >= 35.5),
        );
        const end = rimOf(run.rings.length - 1);
        const spot = new Vector3();
        let last = NaN;
        for (let step = 0; step <= 200; step++) {
            spot.lerpVectors(stretch, end, step / 200);
            const height = hillsideAt(run, spot.x, spot.z);
            if (step > 0)
                expect(Math.abs(height - last), `step ${step}`).toBeLessThan(
                    0.5,
                );
            last = height;
        }
    });

    //  Past level 1's finish, a cross-section of the stretch 43 m along
    //  starts to reach a spot at z = -52: it fades in from nothing.
    it("fades a cross-section in as its reach meets a spot", () => {
        const run = buildRun(levels[Track.One].track.points);
        let last = hillsideAt(run, -39, -52.5);
        for (let step = 1; step <= 100; step++) {
            const height = hillsideAt(run, -39, -52.5 + step / 100);
            expect(Math.abs(height - last), `step ${step}`).toBeLessThan(0.05);
            last = height;
        }
    });
});

describe("the terrain", () => {
    it("meets the hillside's rim without a step", () => {
        const run = buildRun(levels[Track.One].track.points);
        const geometry = buildSlopeSurface(run);
        //  One ray per rim vertex against every triangle times out alone.
        const ground = new MeshBVH(geometry, { indirect: true });
        const positions = geometry.getAttribute("position").array;
        const verts = surfaceVertices(geometry) / run.rings.length;
        const ray = new Ray();
        const down = new Vector3(0, -1, 0);
        const rim = new Vector3();
        const past = new Vector3();
        run.rings.forEach(({ position }, ring) => {
            for (const slot of [0, verts - 1]) {
                rim.fromArray(positions, (ring * verts + slot) * 3);
                //  A hand's width out from the rim.
                past.subVectors(rim, position).setY(0).setLength(0.1);
                ray.set(past.add(rim).setY(1000), down);
                //  The first hit is what shows there, the land or another
                //  stretch of the surface.
                const hit = ground.raycastFirst(ray, DoubleSide)!;
                expect(
                    Math.abs(hit.point.y - rim.y),
                    `${slot} of ${ring}`,
                ).toBeLessThan(0.3);
            }
        });
    });
});
