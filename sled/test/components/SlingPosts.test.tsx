import { create } from "@react-three/test-renderer";
import { createWorld } from "koota";
import { WorldProvider } from "koota/react";
import {
    BoxGeometry,
    Group,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    Vector3,
} from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Ref } from "@spawnite/engine";
import { SlingPosts } from "../../src/components/SlingPosts";
import { buildRun, levels, Track } from "../../src/levels";
import { spawnDistance } from "../../src/ride/rider";
import { pullMaximum, SlingTrait } from "../../src/ride/sling";

//  A post a metre tall about its middle, as the model is.
const post = new Mesh(new BoxGeometry(0.2, 1, 0.3), new MeshStandardMaterial());
const model = new Group().add(post);

vi.mock("@react-three/drei", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@react-three/drei")>()),
    useGLTF: Object.assign(() => ({ scene: model }), { preload: vi.fn() }),
}));

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

const { track } = buildRun(levels[Track.One].track.points);
const aimSpan = 2;
//  Where the band is tied, half a metre up each post.
const tips = [1, -1].map((side) => {
    const tip = track.pointAt(spawnDistance, side * (aimSpan + 0.5));
    tip.y += 0.5;
    return tip;
});

it("draws both posts in one instanced batch, each standing on the snow at the start", async () => {
    const world = createWorld();
    const renderer = await create(
        <WorldProvider world={world}>
            <SlingPosts track={track} aimSpan={aimSpan} />
        </WorldProvider>,
    );

    const batches = renderer.scene
        .findAll((node) => node.instance instanceof InstancedMesh)
        .map((node) => node.instance as InstancedMesh);
    expect(batches).toHaveLength(1);
    const [batch] = batches;
    expect(batch.geometry).toBe(post.geometry);
    expect(batch.count).toBe(2);
    expect(batch.castShadow && batch.receiveShadow).toBe(true);
    const matrix = new Matrix4();
    tips.forEach((tip, index) => {
        batch.getMatrixAt(index, matrix);
        const middle = new Vector3().applyMatrix4(matrix);
        expect(middle.distanceTo(tip)).toBeLessThan(1e-6);
    });

    await renderer.unmount();
    world.destroy();
});

it("strings the band back through the rider while the sling is drawn, and straight in one piece once it fires", async () => {
    const world = createWorld();
    const object = new Object3D();
    object.position.copy(track.pointAt(spawnDistance, 0));
    const rider = world.spawn(SlingTrait({ charge: 0.5 }), Ref({ object }));
    const renderer = await create(
        <WorldProvider world={world}>
            <SlingPosts track={track} aimSpan={aimSpan} />
        </WorldProvider>,
    );
    const readBands = () =>
        renderer.scene
            .findAll(
                (node) =>
                    node.instance instanceof Mesh &&
                    !(node.instance instanceof InstancedMesh) &&
                    node.instance.visible,
            )
            .map((node) => node.instance as Mesh);
    //  Every query in these frames would be the band's own.
    const query = vi.spyOn(world, "query");

    await renderer.advanceFrames(1, 1 / 60);
    //  The rider faces negative z, so its pull is back along positive z.
    const anchor = object.position.clone();
    anchor.z += 0.5 * pullMaximum;
    const drawn = readBands();
    expect(drawn).toHaveLength(2);
    drawn.forEach((band, index) => {
        const end = band.position.clone().multiplyScalar(2).sub(tips[index]);
        expect(end.distanceTo(anchor)).toBeLessThan(1e-6);
    });

    rider.set(SlingTrait, { enabled: false });
    await renderer.advanceFrames(1, 1 / 60);
    const straight = readBands();
    expect(straight).toHaveLength(1);
    const [band] = straight;
    expect(band.scale.z).toBeCloseTo(tips[0].distanceTo(tips[1]));
    const middle = tips[0].clone().add(tips[1]).multiplyScalar(0.5);
    expect(band.position.distanceTo(middle)).toBeLessThan(1e-6);
    expect(query).not.toHaveBeenCalled();

    await renderer.unmount();
    world.destroy();
});
