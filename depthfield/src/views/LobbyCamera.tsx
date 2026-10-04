import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { MathUtils } from "three";
import { useCamera, useHeadless } from "@spawnite/engine";
import { usePhoneLayout } from "../hud/usePhoneLayout";

//  The lobby's held view of the soldier on its platform: a long lens a few
//  metres off, a little above its chest, with no drag, wheel or touch to
//  move it. On a desktop the soldier stands left of the middle, clear of
//  the picks on the right; on a phone it stands in the upper half, over the
//  sheet of picks. The field's camera holds its view the same way.

const none = CameraControlsImpl.ACTION.NONE;
/** Degrees the lens sees top to bottom: long, so the soldier is not
 *  stretched at the screen's edges. */
const lensDegrees = 30;
/** Metres the eye stands from the soldier's middle: near on a desktop,
 *  so it stands large, and further on a phone, so it fits the upper half.
 *  And the degrees it looks down. */
const desktopDistance = 4.7;
const phoneDistance = 7.4;
const pitch = 7;
const polar = MathUtils.degToRad(90 - pitch);
/** The metres up the platform's centre the eye aims at. */
const aimHeight = 1;
/** Metres the view slides off the soldier: right on a desktop, so it
 *  stands left of the middle, and down on a phone, so it stands high. The
 *  controls' focal offset counts its y downward. */
const desktopSlide = 0.56;
const phoneDrop = 0.62;

export function LobbyCamera() {
    const phone = usePhoneLayout();
    const distance = phone ? phoneDistance : desktopDistance;
    const rig = useCamera({
        through: LobbyCamera,
        follow: null,
        settle: false,
        distance,
        pitch,
        minDistance: distance,
        maxDistance: distance,
        minPolarAngle: polar,
        maxPolarAngle: polar,
        fov: lensDegrees,
    });
    const controlsRef = useRef<CameraControlsImpl>(null);
    useEffect(() => {
        const orbit = controlsRef.current;
        if (!orbit) return;
        void orbit.setTarget(0, aimHeight, 0, false);
        void orbit.setFocalOffset(
            phone ? 0 : desktopSlide,
            phone ? phoneDrop : 0,
            0,
            false,
        );
    }, [phone]);
    if (useHeadless()) return null;
    return (
        <CameraControls
            makeDefault
            {...rig}
            ref={(instance: CameraControlsImpl | null) => {
                rig.ref(instance);
                controlsRef.current = instance;
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
