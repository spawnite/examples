import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";

//  Poses laid over a body after the engine's clips, just before the scene
//  draws. The clips write the bones in the frame loop, and a view's own
//  frame callback may run before or after it, by when each mounted; the
//  scene's draw is after both, and before the renderer reads the bones.

type LatePose = () => void;

const poses = new Set<LatePose>();

/** Runs `pose` before each draw of the scene until the returned function
 *  removes it. A pose must give the same bones for the same frame, since a
 *  frame may draw the scene more than once. */
export function addLatePose(pose: LatePose) {
    poses.add(pose);
    return () => {
        poses.delete(pose);
    };
}

/** Hooks the late poses into the scene's draw, once for the game. */
export function LatePoses() {
    const scene = useThree((state) => state.scene);
    useLayoutEffect(() => {
        const previous = scene.onBeforeRender;
        scene.onBeforeRender = (...draw) => {
            previous.apply(scene, draw);
            for (const pose of poses) pose();
        };
        return () => {
            scene.onBeforeRender = previous;
        };
    }, [scene]);
    return null;
}
