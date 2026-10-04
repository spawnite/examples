import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { MathUtils } from "three";
import { useCamera, useHeadless } from "@spawnite/engine";
import { useLook } from "../store/look";
import { readShake } from "./shake";

//  The source's angled view, held: the eye 24 metres off and 69 degrees
//  down, always from the south, with no drag, wheel or touch to turn or
//  zoom it, so the keys' up stays the screen's up. The engine's
//  SideCamera holds a view the same way for a platformer, with a lens of
//  its own; this one keeps the source's. The source's lens was 900 pixels
//  of focal length on a canvas about 925 wide, 54 degrees across, and the
//  player's own Field of view still lays over it.

const none = CameraControlsImpl.ACTION.NONE;
/** Degrees the camera looks down from the horizon. */
export const cameraPitch = 69.4;
const pitch = cameraPitch;
const polar = MathUtils.degToRad(90 - pitch);
const distance = 24;
const fieldOfView = { degrees: 54, min: 45, max: 120, fixed: false };

export function FieldCamera() {
    const rig = useCamera({
        through: FieldCamera,
        settle: false,
        distance,
        pitch,
        minDistance: distance,
        maxDistance: distance,
        minPolarAngle: polar,
        maxPolarAngle: polar,
        fieldOfView,
    });
    const controls = useRef<CameraControlsImpl>(null);
    //  A shake moves the view off its target without moving the target,
    //  so the controls' hold on the angle is untouched.
    useFrame((_, delta) => {
        const size = useLook.getState().shake ? readShake(delta) : 0;
        controls.current?.setFocalOffset(
            (Math.random() - 0.5) * size,
            (Math.random() - 0.5) * size,
            0,
            false,
        );
    });
    if (useHeadless()) return null;
    return (
        <CameraControls
            makeDefault
            {...rig}
            ref={(instance: CameraControlsImpl | null) => {
                rig.ref(instance);
                controls.current = instance;
            }}
            minAzimuthAngle={0}
            maxAzimuthAngle={0}
            mouseButtons={{
                left: none,
                middle: none,
                right: none,
                wheel: none,
            }}
            touches={{ one: none, two: none, three: none }}
        />
    );
}
