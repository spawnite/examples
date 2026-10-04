import { useThree } from "@react-three/fiber";
import { useQueryFirst } from "koota/react";
import { useEffect } from "react";
import { MathUtils, Vector2 } from "three";
import { useHeadless, useInput } from "@spawnite/engine";
import { trackPageHide } from "@spawnite/ui";
import { RunTrait } from "../ride/course";
import { aimSling, isAiming, SlingTrait, tapCharge } from "../ride/sling";

/** The share of the screen's shorter side a drag travels for a full pull,
 *  a full aim or a full steer. */
const dragSpan = 0.3;
/** Pixels a press may travel and still count as a tap. */
const tapDistance = 12;

const steering = new Vector2();

/** A press on the world: the pointer and where it went down. */
interface Press {
    pointerId: number;
    x: number;
    y: number;
}

/** Sled's controls beyond the engine's keys, for a finger, a mouse or a
 *  trackpad alike. On the sling, a drag anywhere on the world pulls the
 *  rider back as far as it goes down and aims it as far as it goes across,
 *  and the release fires it; a bare tap fires the half-pull. Riding, a drag
 *  across steers and a tap jumps. Enter fires as Space does, through
 *  `controls()` in the game's plugins. */
export function Controls() {
    const steer = useInput((state) => state.steer);
    const jump = useInput((state) => state.jump);
    const headless = useHeadless();
    const canvas = useThree((state) => state.gl.domElement);
    const rider = useQueryFirst(SlingTrait, RunTrait);

    //  The press on the canvas, so one on the HUD's buttons never reaches
    //  it; the drag and the release on the window, so a drag that leaves
    //  the canvas still ends, and so does a release that reaches the window
    //  alone, as ui's pointer grip hears its own.
    useEffect(() => {
        if (headless) return;
        const { ownerDocument } = canvas;
        let press: Press | null = null;
        let travelled = false;
        //  Fingers that went down while another drags: each is a tap to jump
        //  until it travels.
        const taps = new Map<number, Press>();
        const readDragSpan = () =>
            Math.min(window.innerWidth, window.innerHeight) * dragSpan;
        const startPress = (event: PointerEvent) => {
            if (event.button !== 0) return;
            if (press) {
                taps.set(event.pointerId, {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                });
                return;
            }
            press = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
            };
            travelled = false;
        };
        const dragPress = (event: PointerEvent) => {
            const tap = taps.get(event.pointerId);
            if (
                tap &&
                Math.hypot(event.clientX - tap.x, event.clientY - tap.y) >
                    tapDistance
            )
                taps.delete(event.pointerId);
            if (press?.pointerId !== event.pointerId) return;
            const across = event.clientX - press.x;
            const down = event.clientY - press.y;
            if (Math.hypot(across, down) > tapDistance) travelled = true;
            if (rider && isAiming(rider)) {
                aimSling(rider, down / readDragSpan(), across / readDragSpan());
                return;
            }
            steer(
                steering.set(
                    MathUtils.clamp(across / readDragSpan(), -1, 1),
                    0,
                ),
            );
        };
        //  Lets go without firing or jumping: the press is over, whatever
        //  ended it.
        const dropPress = () => {
            taps.clear();
            if (!press) return;
            press = null;
            steer(steering.set(0, 0));
        };
        const endPress = (event: PointerEvent) => {
            if (taps.delete(event.pointerId)) {
                if (rider && !isAiming(rider)) jump();
                return;
            }
            if (press?.pointerId !== event.pointerId) return;
            press = null;
            if (rider && isAiming(rider)) {
                //  A tap fires the half-pull, whatever a cancelled drag left.
                if (!travelled)
                    aimSling(
                        rider,
                        tapCharge,
                        rider.get(SlingTrait)?.targetSide,
                    );
                jump();
                return;
            }
            steer(steering.set(0, 0));
            if (!travelled) jump();
        };
        const cancelPress = (event: PointerEvent) => {
            taps.delete(event.pointerId);
            if (press?.pointerId === event.pointerId) dropPress();
        };
        const preventContextMenu = (event: Event) => {
            if (event.target === canvas) event.preventDefault();
        };
        //  A drag pulls and steers rather than scrolling or zooming the page,
        //  and a finger held on the sling opens no menu.
        const touchAction = canvas.style.touchAction;
        canvas.style.touchAction = "none";
        const listeners = new AbortController();
        const { signal } = listeners;
        ownerDocument.addEventListener("contextmenu", preventContextMenu, {
            signal,
        });
        canvas.addEventListener("pointerdown", startPress, { signal });
        window.addEventListener("pointermove", dragPress, { signal });
        window.addEventListener("pointerup", endPress, { signal });
        window.addEventListener("pointercancel", cancelPress, { signal });
        //  A release in another window never reaches this one: without these
        //  the press outlives the button, and every later move steers, as
        //  ui's pointer grip lets go of its own.
        window.addEventListener("blur", dropPress, { signal });
        const stopTrackingPageHide = trackPageHide(window, dropPress);
        return () => {
            listeners.abort();
            stopTrackingPageHide();
            dropPress();
            canvas.style.touchAction = touchAction;
        };
    }, [canvas, rider, steer, jump, headless]);

    return null;
}
