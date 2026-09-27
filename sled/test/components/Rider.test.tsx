import { create } from "@react-three/test-renderer";
import {
    Bone,
    BoxGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    Skeleton,
    SkinnedMesh,
} from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Penguin } from "../../src/components/Rider";

//  A rigged body at rest on its one bone, as the model is.
const body = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
const bone = new Bone();
body.add(bone);
body.bind(new Skeleton([bone]));
body.position.set(0.1, 0.2, 0.3);
const model = new Group().add(body);

vi.mock("@react-three/drei", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@react-three/drei")>()),
    useGLTF: Object.assign(() => ({ scene: model }), { preload: vi.fn() }),
}));

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

it("draws the penguin as a still mesh, with no skeleton to upload each frame", async () => {
    const renderer = await create(<Penguin />);

    const meshes = renderer.scene
        .findAll((node) => node.instance instanceof Mesh)
        .map((node) => node.instance as Mesh);
    expect(meshes).toHaveLength(1);
    const [drawn] = meshes;
    expect(drawn).not.toBeInstanceOf(SkinnedMesh);
    expect(drawn.geometry).toBe(body.geometry);
    expect(drawn.material).toBe(body.material);
    expect(drawn.position.toArray()).toEqual([0.1, 0.2, 0.3]);
    expect(drawn.castShadow && drawn.receiveShadow).toBe(true);

    await renderer.unmount();
});
