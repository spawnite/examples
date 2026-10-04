import { act, create } from "@react-three/test-renderer";
import { WorldProvider } from "koota/react";
import {
    BufferGeometry,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshStandardMaterial,
    Texture,
} from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGameWorld, useModel } from "@spawnite/engine";
import { CrescentWand } from "../../src/mage/CrescentWand";

//  The wand's file: one baked mesh on one textured material, a triangle
//  on its shaft, vertices 0 to 2, and one in its crescent, 3 to 5.
vi.mock("@spawnite/engine", async (importOriginal) => {
    const engine = await importOriginal<typeof import("@spawnite/engine")>();
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        "position",
        new Float32BufferAttribute(
            [
                0, 0.1, 0, 0.01, 0.1, 0, 0, 0.12, 0, 0, 0.3, 0, 0.01, 0.3, 0, 0,
                0.32, 0,
            ],
            3,
        ),
    );
    geometry.setIndex([3, 4, 5, 0, 1, 2]);
    const scene = new Group().add(
        new Mesh(geometry, new MeshStandardMaterial({ map: new Texture() })),
    );
    return { ...engine, useModel: () => ({ scene }) };
});

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

function readWand(renderer: Awaited<ReturnType<typeof create>>) {
    const [wand] = renderer.scene.findAll(
        ({ instance }) =>
            instance instanceof Mesh && Array.isArray(instance.material),
    );
    const mesh = wand.instance as Mesh<BufferGeometry, MeshStandardMaterial[]>;
    return { mesh, lit: mesh.material[1] };
}

/** The material the triangle holding `vertex` draws with. */
function readTriangleMaterial(
    mesh: Mesh<BufferGeometry, MeshStandardMaterial[]>,
    vertex: number,
) {
    const indices = Array.from(mesh.geometry.index?.array ?? []);
    const at = indices.indexOf(vertex);
    const group = mesh.geometry.groups.find(
        ({ start, count }) => at >= start && at < start + count,
    );
    if (!group) throw new Error(`No group draws vertex ${vertex}.`);
    return mesh.material[group.materialIndex ?? 0];
}

it("lights the crescent's triangles from the file's texture and leaves the shaft's as the file draws them", async () => {
    const world = createGameWorld();
    const renderer = await create(
        <WorldProvider world={world}>
            <CrescentWand charging={false} />
        </WorldProvider>,
    );
    const { mesh } = readWand(renderer);
    const file = (useModel("wand").scene.children[0] as Mesh)
        .material as MeshStandardMaterial;

    expect(readTriangleMaterial(mesh, 0)).toBe(file);
    const crescent = readTriangleMaterial(mesh, 3);
    expect(crescent.emissive.getHex()).not.toBe(0);
    expect(crescent.emissiveMap).toBe(file.map);
    await renderer.unmount();
    world.destroy();
});

it("glows brighter while the charge plays, and softly again after it", async () => {
    const world = createGameWorld();
    const wand = (charging: boolean) => (
        <WorldProvider world={world}>
            <CrescentWand charging={charging} />
        </WorldProvider>
    );
    const renderer = await create(wand(false));
    const { lit } = readWand(renderer);
    await act(() => renderer.advanceFrames(60, 1 / 60));
    const resting = lit.emissiveIntensity;
    expect(resting).toBeGreaterThan(0.5);

    await renderer.update(wand(true));
    await act(() => renderer.advanceFrames(60, 1 / 60));
    expect(lit.emissiveIntensity).toBeGreaterThan(resting * 3);

    await renderer.update(wand(false));
    await act(() => renderer.advanceFrames(60, 1 / 60));
    expect(lit.emissiveIntensity).toBeCloseTo(resting, 2);
    await renderer.unmount();
    world.destroy();
});
