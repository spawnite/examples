import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import type { Camera } from "three";

//  Poses laid over a body after the engine's clips, just before the scene
//  draws. The clips write the bones in the frame loop, and a view's own
//  frame callback may run before or after it, by when each mounted; the
//  scene's draw is after both, and before the renderer reads the bones.

/** A pose, handed the camera the scene is drawn through. */
type LatePose = (camera: Camera) => void;

const poses = new Set<LatePose>();

/** Runs `pose` before each draw of the scene until the returned function
 *  removes it. A pose must give the same bones for the same frame, since a
 *  frame may draw the scene more than once, through more than one camera:
 *  it runs on the frame's first draw, and again on each draw through a
 *  camera other than the draw before's, whose pose that camera overwrote. */
export function addLatePose(pose: LatePose) {
    poses.add(pose);
    return () => {
        poses.delete(pose);
    };
}

/** Hooks the late poses into the scene's draw, once for the game. */
export function LatePoses() {
    const scene = useThree((state) => state.scene);
    //  Counts the frames, so a draw knows whether its frame already posed.
    const frameRef = useRef(0);
    useFrame(() => {
        frameRef.current += 1;
    });
    useLayoutEffect(() => {
        const previous = scene.onBeforeRender;
        //  The occlusion pass draws the scene twice more each frame through
        //  the same camera, three poses a frame where one does.
        let posedFrame = -1;
        let posedCamera: Camera | null = null;
        scene.onBeforeRender = (...draw) => {
            previous.apply(scene, draw);
            const [, , camera] = draw;
            if (posedFrame === frameRef.current && posedCamera === camera)
                return;
            posedFrame = frameRef.current;
            posedCamera = camera;
            for (const pose of poses) pose(camera);
        };
        return () => {
            scene.onBeforeRender = previous;
        };
    }, [scene]);
    return null;
}
