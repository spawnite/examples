import { create } from "@react-three/test-renderer";
import { Box3, BoxGeometry, Group, Mesh, Vector3 } from "three";
import { expect, it, vi } from "vitest";
import palmTrunk from "@spawnite/assets/models/sled/palm-trunk.glb?url";
import slab from "@spawnite/assets/models/sled/rock-slab.glb?url";
import type { LevelId } from "@spawnite/engine";
import { RockModel } from "../../src/components/Rock";
import { levelMaps, levels, Track } from "../../src/levels";
import { CourseKind, rockSizes } from "../../src/ride/course";

//  Each file as a stand-in of its own shape, centred across and along as
//  the files are but not standing on the ground, so the fit has to
//  stretch it and stand it on the snow.
const trunkGeometry = new BoxGeometry(5, 0.6, 0.8).translate(0, 0.5, 0);
const slabGeometry = new BoxGeometry(2, 1, 1.5).translate(0, -0.3, 0);
const models: Record<string, Group> = {
    [palmTrunk]: new Group().add(new Mesh(trunkGeometry)),
    [slab]: new Group().add(new Mesh(slabGeometry)),
};

vi.mock("@react-three/fiber", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useLoader: Object.assign(
        (_loader: unknown, url: string) => ({ scene: models[url] }),
        { preload: () => undefined },
    ),
}));

/** What a level's slab draws on the level's map: each mesh's geometry,
 *  and the bounds of them all. */
async function drawSlab(id: LevelId) {
    expect(levels[id].triggers.slabs?.length).toBeGreaterThan(0);
    const renderer = await create(
        <RockModel kind={CourseKind.Slab} map={levelMaps[id]} />,
    );
    const root = renderer.scene.instance;
    root.updateMatrixWorld(true);
    const geometries: unknown[] = [];
    root.traverse((object) => {
        if (object instanceof Mesh) geometries.push(object.geometry);
    });
    const bounds = new Box3().setFromObject(root);
    await renderer.unmount();
    return { geometries, bounds };
}

/** The slab's box, standing on the snow and centred on its spot. */
const [width, height, depth] = rockSizes[CourseKind.Slab];
const slabBox = new Box3(
    new Vector3(-width / 2, 0, -depth / 2),
    new Vector3(width / 2, height, depth / 2),
);

function expectSlabBox(bounds: Box3) {
    for (const corner of ["min", "max"] as const)
        for (const axis of ["x", "y", "z"] as const)
            expect(bounds[corner][axis], `${corner}.${axis}`).toBeCloseTo(
                slabBox[corner][axis],
            );
}

it("draws a desert track's slab as one fallen palm trunk filling the slab's box on the ground", async () => {
    const { geometries, bounds } = await drawSlab(Track.Ten);
    expect(geometries).toEqual([trunkGeometry]);
    expectSlabBox(bounds);
});

it("draws a snow track's slab as one slab rock filling the slab's box on the ground", async () => {
    const { geometries, bounds } = await drawSlab(Track.Two);
    expect(geometries).toEqual([slabGeometry]);
    expectSlabBox(bounds);
});
