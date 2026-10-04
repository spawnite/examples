import { useThree, type RootState } from "@react-three/fiber";

interface ReadThreeProps {
    keep: (read: () => RootState) => void;
}

function ReadThree({ keep }: ReadThreeProps) {
    keep(useThree((state) => state.get));
    return null;
}

/** Fiber's state for a test scene: mount `element` in the scene, then
 *  `readThree` hands its clock, renderer, scene and camera, so a test moves
 *  the canvas's clock or draws the scene as the frame loop does. */
export function keepThree() {
    let read: (() => RootState) | null = null;
    return {
        element: <ReadThree keep={(reader) => (read = reader)} />,
        readThree: () => {
            if (!read)
                throw new Error("fiber's state is read once the scene mounts");
            return read();
        },
    };
}
