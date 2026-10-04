import { create } from "@react-three/test-renderer";
import { Color, InstancedMesh, Vector3, type Object3D } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EffectPools, emitGlow } from "../../../src/views/effects/EffectPools";
import { keepThree } from "../readThree";

//  A pool's quads face the camera from both sides and add their light, so
//  one draw of the scene draws a live pool once: three draws a transparent
//  material of both faces twice otherwise, back then front, and flips its
//  side between the two, which rebuilds its program's key on every draw.

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

it("draws a live glow once in a draw of the scene", async () => {
    const { element: three, readThree } = keepThree();
    const renderer = await create(
        <>
            {three}
            <EffectPools />
        </>,
    );
    emitGlow({
        position: new Vector3(0, 1, -3),
        color: new Color(1, 0.6, 0.2),
        seconds: 1,
        size: 0.5,
    });
    await renderer.advanceFrames(1, 1 / 60);
    const { gl, scene, camera } = readThree();
    const drawn: Object3D[] = [];
    const draw = vi
        .spyOn(gl, "renderBufferDirect")
        .mockImplementation((...args) => {
            drawn.push(args[4]);
        });

    gl.render(scene, camera);

    const live = drawn.filter((object) => object instanceof InstancedMesh);
    expect(live).toHaveLength(1);
    draw.mockRestore();
    await renderer.unmount();
});
