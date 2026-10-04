import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { listenToAction } from "@spawnite/engine";
import { hudPlugin } from "../hud/hud.plugin";
import { Plane, Raycaster, Vector2, Vector3 } from "@spawnite/engine/three";
import {
    aim,
    askForDodge,
    askForPotion,
    pressAttack,
    releaseAttack,
} from "./aim";

/** Metres above her feet the aim is cast at: her middle, where she swings. */
const aimHeight = 0.7;

//  Written in place on each pointer move and frame.
const pointer = new Vector2();
const raycaster = new Raycaster();
const hit = new Vector3();
const aimPlane = new Plane(new Vector3(0, 1, 0), 0);

/** Reads the pointer, the attack button and the potion key into `aim`.
 *  Mounted inside the World, since it casts through the scene's camera. */
export function AimInput() {
    const readThree = useThree((state) => state.get);

    useEffect(() => {
        let over = false;
        const castAim = () => {
            if (!over) return;
            //  On the plane through her middle, wherever the ground puts her.
            aimPlane.constant = -(aim.heroY + aimHeight);
            raycaster.setFromCamera(pointer, readThree().camera);
            if (!raycaster.ray.intersectPlane(aimPlane, hit)) return;
            aim.x = hit.x;
            aim.z = hit.z;
            aim.known = true;
        };
        //  A finger is the touch controls', which aim by themselves.
        const move = (event: PointerEvent) => {
            if (event.pointerType === "touch") return;
            const { size } = readThree();
            pointer.set(
                ((event.clientX - size.left) / size.width) * 2 - 1,
                -((event.clientY - size.top) / size.height) * 2 + 1,
            );
            over = true;
            castAim();
        };
        //  A press counts from the canvas alone, not the HUD's buttons.
        const press = (event: PointerEvent) => {
            if (event.button !== 0 || event.pointerType === "touch") return;
            if (event.target !== readThree().gl.domElement) return;
            move(event);
            pressAttack();
        };
        const release = (event: PointerEvent) => {
            if (event.button === 0 && event.pointerType !== "touch")
                releaseAttack();
        };
        //  The fight's keys, which the engine binds: J held keeps
        //  attacking, Q drinks, Space dodges.
        const { attack, potion, dodge } = hudPlugin.actions;
        const stopKeys = [
            listenToAction(attack, {
                onPress: () => pressAttack(),
                onRelease: releaseAttack,
            }),
            listenToAction(potion, { onPress: () => askForPotion() }),
            listenToAction(dodge, { onPress: () => askForDodge() }),
        ];
        cast = castAim;
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerdown", press);
        window.addEventListener("pointerup", release);
        return () => {
            for (const stop of stopKeys) stop();
            cast = null;
            releaseAttack();
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerdown", press);
            window.removeEventListener("pointerup", release);
        };
    }, [readThree]);

    //  The camera follows the hero, so a still pointer lies over new ground
    //  each frame she moves.
    useFrame(() => cast?.());

    return null;
}

let cast: (() => void) | null = null;
