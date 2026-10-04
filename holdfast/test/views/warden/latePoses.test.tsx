import { create } from "@react-three/test-renderer";
import { PerspectiveCamera } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addLatePose, LatePoses } from "../../../src/views/warden/latePoses";
import { keepThree } from "../readThree";

//  A frame draws the scene more than once, as the occlusion pass draws it
//  again for its transparency targets, and a pose gives the same bones for
//  the same frame and camera: it runs on the frame's first draw, and again
//  whenever the camera changes.

let release: () => void = () => undefined;

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
    release();
    vi.unstubAllGlobals();
});

it("poses once a frame, and again for each change of camera", async () => {
    const pose = vi.fn();
    release = addLatePose(pose);
    const { element: three, readThree } = keepThree();
    const renderer = await create(
        <>
            {three}
            <LatePoses />
        </>,
    );
    const { gl, scene, camera } = readThree();
    const other = new PerspectiveCamera();

    await renderer.advanceFrames(1, 1 / 60);
    gl.render(scene, camera);
    gl.render(scene, camera);
    gl.render(scene, camera);
    expect(pose).toHaveBeenCalledTimes(1);

    gl.render(scene, other);
    expect(pose).toHaveBeenCalledTimes(2);
    expect(pose).toHaveBeenLastCalledWith(other);

    //  Back to the first camera, whose pose the other overwrote.
    gl.render(scene, camera);
    expect(pose).toHaveBeenCalledTimes(3);
    expect(pose).toHaveBeenLastCalledWith(camera);

    await renderer.advanceFrames(1, 1 / 60);
    gl.render(scene, camera);
    expect(pose).toHaveBeenCalledTimes(4);
    await renderer.unmount();
});
