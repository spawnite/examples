import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { createStore, Hud, steerFromStick } from "@spawnite/engine";
import { Vector2 } from "@spawnite/engine/three";
import { cameraFx } from "../view/cameraFx";
import { askForDodge, pressAttack, releaseAttack } from "./aim";

//  Dragalia Lost's controls, for a phone: a finger dragged anywhere is a
//  stick that walks her from where it landed, a tap attacks, and a finger
//  held still keeps attacking. Every attack from a finger aims itself. Two
//  fingers put down together turn the camera round her as they drag, and
//  zoom it as they pinch; a second finger while one walks still taps.

/** CSS pixels a finger moves before a touch is a drag, not a tap. */
const dragStart = 12;
/** CSS pixels from where it landed at which a drag walks at full speed. */
const stickReach = 56;
/** Milliseconds a still finger waits before it keeps attacking. */
const holdAfter = 250;
/** A swipe, which dodges on a phone held upright: a finger that moves at
 *  least this many pixels and lifts within this many milliseconds. */
const swipeLeast = 40;
const swipeWithin = 300;
/** Radians the camera turns for a pixel two fingers drag, and metres it
 *  moves in for a pixel they pinch closer. */
const turnPerPixel = Math.PI / 400;
const dollyPerPixel = 0.03;

/** What the camera controls the orbit camera made default offer the two
 *  fingers: camera-controls' own turn and dolly. */
type Orbit = {
    rotate: (azimuth: number, polar: number, smooth?: boolean) => unknown;
    dolly: (distance: number, smooth?: boolean) => unknown;
};

type Stick = { x: number; y: number; knobX: number; knobY: number };

const useStick = createStore<{ stick: Stick | null }>()(() => ({
    stick: null,
}));

const steer = new Vector2();
const still = new Vector2();

/** Reads the fingers on the canvas into the hero's steering and her
 *  attacks; `peaceful`, as in town, a tap or a held finger attacks
 *  nothing. Mounted inside the World, since it listens on the canvas. */
export function TouchControls({ peaceful = false }: { peaceful?: boolean }) {
    const canvas = useThree((state) => state.gl.domElement);
    const orbit = useThree((state) => state.controls) as Orbit | null;

    useEffect(() => {
        type Touch = {
            x: number;
            y: number;
            /** When it landed. */
            at: number;
            dragging: boolean;
            holding: boolean;
            timer: number;
            /** Part of a two-finger turn: it neither walks nor taps. */
            camera?: boolean;
        };
        const touches = new Map<number, Touch>();
        //  The finger that walks her, while one does.
        let walker: number | null = null;
        //  Two fingers turning the camera: where they stood last, and how
        //  far apart.
        let gesture: { x: number; y: number; apart: number } | null = null;
        const middle = () => {
            const [a, b] = [...touches.values()];
            return {
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2,
                apart: Math.hypot(a.x - b.x, a.y - b.y),
            };
        };

        const down = (event: PointerEvent) => {
            if (event.pointerType !== "touch" || event.target !== canvas)
                return;
            //  A second finger with the first not yet walking or attacking:
            //  the two turn the camera, and neither taps.
            const first = [...touches.values()][0];
            if (
                touches.size === 1 &&
                walker === null &&
                !first.holding &&
                !gesture
            ) {
                clearTimeout(first.timer);
                first.camera = true;
                touches.set(event.pointerId, {
                    x: event.clientX,
                    y: event.clientY,
                    at: performance.now(),
                    dragging: false,
                    holding: false,
                    timer: 0,
                    camera: true,
                });
                gesture = middle();
                return;
            }
            const touch: Touch = {
                x: event.clientX,
                y: event.clientY,
                at: performance.now(),
                dragging: false,
                holding: false,
                timer: window.setTimeout(() => {
                    if (touch.dragging) return;
                    touch.holding = true;
                    if (!peaceful) pressAttack(true);
                }, holdAfter),
            };
            touches.set(event.pointerId, touch);
        };
        const move = (event: PointerEvent) => {
            const touch = touches.get(event.pointerId);
            if (!touch || touch.holding) return;
            if (touch.camera && !gesture) return;
            if (gesture) {
                //  Where each finger is now, from which the pair turns and
                //  pinches.
                touch.x = event.clientX;
                touch.y = event.clientY;
                const now = middle();
                orbit?.rotate(
                    -(now.x - gesture.x) * turnPerPixel,
                    -(now.y - gesture.y) * turnPerPixel,
                    false,
                );
                orbit?.dolly(
                    (now.apart - gesture.apart) * dollyPerPixel,
                    false,
                );
                gesture = now;
                return;
            }
            const dx = event.clientX - touch.x;
            const dy = event.clientY - touch.y;
            const length = Math.hypot(dx, dy);
            if (!touch.dragging) {
                //  One finger walks at a time; another still taps.
                if (length < dragStart || walker !== null) return;
                touch.dragging = true;
                walker = event.pointerId;
                clearTimeout(touch.timer);
            }
            const reach = Math.min(length, stickReach);
            //  The stick's y runs up the screen, the page's down.
            steer
                .set(dx, -dy)
                .divideScalar(Math.max(length, 1))
                .multiplyScalar(reach / stickReach);
            steerFromStick(steer);
            useStick.setState({
                stick: {
                    x: touch.x,
                    y: touch.y,
                    knobX: touch.x + (dx / Math.max(length, 1)) * reach,
                    knobY: touch.y + (dy / Math.max(length, 1)) * reach,
                },
            });
        };
        const up = (event: PointerEvent) => {
            const touch = touches.get(event.pointerId);
            if (!touch) return;
            touches.delete(event.pointerId);
            clearTimeout(touch.timer);
            //  A gesture ends with its first finger up; the one left on the
            //  glass neither walks nor taps.
            if (touch.camera) {
                gesture = null;
                return;
            }
            if (walker === event.pointerId) {
                walker = null;
                steerFromStick(still);
                useStick.setState({ stick: null });
                //  Flicked rather than dragged: upright, a dodge that way.
                const dx = event.clientX - touch.x;
                const dy = event.clientY - touch.y;
                if (
                    window.matchMedia("(orientation: portrait)").matches &&
                    performance.now() - touch.at <= swipeWithin &&
                    Math.hypot(dx, dy) >= swipeLeast
                ) {
                    //  Up the screen is the way the camera looks.
                    const aheadX = Math.sin(cameraFx.heading);
                    const aheadZ = Math.cos(cameraFx.heading);
                    askForDodge(
                        -aheadZ * dx - aheadX * dy,
                        aheadX * dx - aheadZ * dy,
                    );
                }
            } else if (touch.holding) releaseAttack();
            else if (!touch.dragging) {
                //  A tap: one attack, which the step takes on its next beat.
                if (!peaceful) pressAttack(true);
                releaseAttack();
            }
        };
        //  A drag walks her rather than scrolling or zooming the page, and a
        //  finger held to keep attacking opens no menu.
        const touchAction = canvas.style.touchAction;
        canvas.style.touchAction = "none";
        const noMenu = (event: Event) => {
            if (event.target === canvas) event.preventDefault();
        };
        window.addEventListener("contextmenu", noMenu);
        window.addEventListener("pointerdown", down);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        return () => {
            touches.forEach((touch) => clearTimeout(touch.timer));
            steerFromStick(still);
            releaseAttack();
            useStick.setState({ stick: null });
            canvas.style.touchAction = touchAction;
            window.removeEventListener("contextmenu", noMenu);
            window.removeEventListener("pointerdown", down);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
        };
    }, [canvas, orbit, peaceful]);

    return (
        <Hud>
            <StickRing />
        </Hud>
    );
}

/** The ring where the walking finger landed and the knob under it. The
 *  engine's Joystick stands in a slot, and this one floats where the
 *  finger lands, so it is the page's own two circles. */
function StickRing() {
    const stick = useStick((state) => state.stick);
    if (!stick) return null;
    return (
        <>
            {/* eslint-disable-next-line no-restricted-syntax -- a stick that floats where the finger lands; the engine's Joystick stands in a slot: a gap in the pull request */}
            <div
                className="pointer-events-none fixed rounded-full border-2 border-white/70 bg-white/10"
                style={{
                    left: stick.x - stickReach,
                    top: stick.y - stickReach,
                    width: stickReach * 2,
                    height: stickReach * 2,
                }}
            />
            {/* eslint-disable-next-line no-restricted-syntax -- a stick that floats where the finger lands; the engine's Joystick stands in a slot: a gap in the pull request */}
            <div
                className="pointer-events-none fixed rounded-full bg-white/80 shadow"
                style={{
                    left: stick.knobX - 18,
                    top: stick.knobY - 18,
                    width: 36,
                    height: 36,
                }}
            />
        </>
    );
}
