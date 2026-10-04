import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useQueryFirst, useTrait, useWorld } from "koota/react";
import { CameraControls } from "@react-three/drei";
import {
    CameraTarget,
    CameraTrait,
    findPlayerHero,
    FreeCamera,
    frameCamera,
    TransformTrait,
    useCamera,
    useDevtools,
    useHeadless,
    VelocityTrait,
} from "@spawnite/engine";
import { Vector2, Vector3 } from "@spawnite/engine/three";
import { aim } from "../combat/aim";
import { HeroCombatTrait } from "../combat/traits";
import { cameraFx } from "./cameraFx";

//  camera-controls' actions, by their numbers: the game reaches the
//  library only through drei.
const none = 0;
const rotate = 1;
const dolly = 16;

/** How far the view leads: a share of the way to the pointer, and never
 *  past `leadMost` metres. */
const aimLead = 0.25;
/** Metres the view leans the way a dodge carries her. */
const dodgeLead = 1.2;
const leadMost = 1.6;
/** How quickly the lead, the zoom, the shake and the punch settle: the
 *  share of the way they close each second, as a rate. */
const leadRate = 4;
const zoomRate = 2;
const shakeFade = 14;
const punchFade = 8;
/** How far out the view pulls while she runs, as a share of its size. */
const runZoom = 0.94;

//  Written in place each frame.
const toward = new Vector2();
const ahead = new Vector3();
const lead = new Vector3();
const right = new Vector3();
const up = new Vector3();

export type OrbitCameraProps = {
    /** Radians from straight up the camera starts at: 90° is level. */
    polar: number;
    /** Metres from her the camera starts at. */
    distance: number;
    /** The nearest and farthest the wheel or a pinch takes it. */
    minDistance: number;
    maxDistance: number;
    /** The highest and lowest the camera tilts, as radians from straight
     *  up. */
    minPolar: number;
    maxPolar: number;
    /** Degrees of the lens. */
    fov?: number;
    /** How far up the screen she stands from its middle, as a share of its
     *  height: 0.25 stands her halfway up the top half. */
    lift?: number;
    /** Whether the view moves with the fight: it leads toward the pointer,
     *  or the way she walks, pulls out while she runs, and takes the
     *  fight's shakes and punches. */
    dynamic?: boolean;
};

/** An MMO's camera: it follows her, and the player turns it round her and
 *  tilts it with the right mouse button, or two fingers, and zooms with
 *  the wheel or a pinch. The left button stays the attack's, and one
 *  finger stays the walk's. Walking goes the way the camera faces. The
 *  engine's following camera with the buttons moved; two fingers are the
 *  touch controls' to read, since one finger walks and taps.
 *
 *  Everything that moves the picture, the lift, the lead, the zoom and the
 *  shake, slides and scales the lens's window rather than the camera, so
 *  the follow stays the engine's and the pointer's aim stays true. */
export function OrbitCamera({
    polar,
    distance,
    minDistance,
    maxDistance,
    minPolar,
    maxPolar,
    fov = 45,
    lift = 0,
    dynamic = false,
}: OrbitCameraProps) {
    const world = useWorld();
    const rig = useCamera({
        follow: CameraTarget.Player,
        through: OrbitCamera,
        fov,
        minDistance,
        maxDistance,
        minPolarAngle: minPolar,
        maxPolarAngle: maxPolar,
    });
    const flying = useDevtools((state) => state.freeCamera);
    //  Once the orbit has mounted, where it starts: looking north over her.
    //  Before then there is no orbit to frame, and after, it stays where
    //  the player leaves it, not where the last scene left it.
    const orbit = useTrait(useQueryFirst(CameraTrait), CameraTrait)?.orbit;
    useEffect(() => {
        if (orbit && !flying)
            frameCamera(world, { azimuth: 0, polar, distance });
        // eslint-disable-next-line @eslint-react/exhaustive-deps
    }, [world, orbit, flying]);

    const camera = useThree((state) => state.camera);
    const size = useThree((state) => state.size);
    const leadNow = useRef(new Vector3());
    const zoom = useRef(1);

    useEffect(() => () => camera.clearViewOffset(), [camera]);

    //  Before the rest of the frame, so what draws after sees this view.
    useFrame(({ camera: looking }, delta) => {
        looking.getWorldDirection(ahead);
        if (Math.hypot(ahead.x, ahead.z) > 1e-3)
            cameraFx.heading = Math.atan2(ahead.x, ahead.z);
        const { width, height } = size;
        if (!dynamic && !lift) return;
        toward.set(0, 0);
        let moving = false;
        const hero = dynamic ? findPlayerHero(world) : undefined;
        const at = hero?.get(TransformTrait);
        const velocity = hero?.get(VelocityTrait);
        if (at && velocity) {
            moving = Math.hypot(velocity.x, velocity.z) > 0.3;
            //  It leans the way she dodges, and only then: walking, the
            //  view holds still round her. The pointer's lead is aim.
            const combat = hero?.get(HeroCombatTrait);
            if (combat && combat.dodge > 0)
                toward
                    .set(combat.dodgeX, combat.dodgeZ)
                    .multiplyScalar(dodgeLead);
            else if (aim.known && !aim.auto)
                toward.set(aim.x - at.x, aim.z - at.z).multiplyScalar(aimLead);
            if (toward.length() > leadMost) toward.setLength(leadMost);
        }
        lead.set(toward.x, 0, toward.y);
        leadNow.current.lerp(lead, 1 - Math.exp(-delta * leadRate));
        const zoomTo = dynamic && moving ? runZoom : 1;
        zoom.current +=
            (zoomTo - zoom.current) * (1 - Math.exp(-delta * zoomRate));

        let shakeX = 0;
        let shakeY = 0;
        let punch = 0;
        if (dynamic) {
            shakeX = (Math.random() * 2 - 1) * cameraFx.shake;
            shakeY = (Math.random() * 2 - 1) * cameraFx.shake;
            punch = cameraFx.punch;
            cameraFx.shake *= Math.exp(-delta * shakeFade);
            cameraFx.punch *= Math.exp(-delta * punchFade);
        }

        //  The lead on the screen, whichever way the camera faces: along
        //  its right and its up, in pixels a metre spans at her.
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        up.setFromMatrixColumn(camera.matrixWorld, 1);
        const away = at ? camera.position.distanceTo(at) : distance;
        const perMetre = height / (2 * away * Math.tan((fov * Math.PI) / 360));
        const across = leadNow.current.dot(right) + shakeX;
        const upward = leadNow.current.dot(up) + shakeY;
        const scale = zoom.current * (1 + punch);
        const w = width / scale;
        const h = height / scale;
        camera.setViewOffset(
            width,
            height,
            (width - w) / 2 + across * perMetre,
            (height - h) / 2 - upward * perMetre + height * lift,
            w,
            h,
        );
    }, -1);

    if (useHeadless()) return null;
    if (flying) return <FreeCamera />;
    return (
        <CameraControls
            makeDefault
            {...rig}
            mouseButtons={{
                left: none,
                middle: rotate,
                right: rotate,
                wheel: dolly,
            }}
            touches={{ one: none, two: none, three: none }}
        />
    );
}
