import { useFrame } from "@react-three/fiber";
import { useWorld } from "koota/react";
import { useRef } from "react";
import type { PointLight } from "three";
import { findPlayerHero, useHeadless } from "@spawnite/engine";
import { WardenTrait } from "../../siege/traits";
import { readWardenColor } from "../palette";
import { findMuzzle, measureSinceShot } from "./muzzles";

//  Her blaster's flash lighting the ground round her, on her own page. One
//  light in the scene from its first frame, carried to her muzzle each
//  frame, rather than one her warden brings: a light that arrives changes
//  every lit shader, and hers arrived as the loading screen was ending.

/** Seconds her shot's light takes to fade. */
const lightSeconds = 0.08;

export function MuzzleLight() {
    const world = useWorld();
    const lightRef = useRef<PointLight>(null);
    const hueRef = useRef<number | null>(null);
    useFrame(() => {
        const light = lightRef.current;
        if (!light) return;
        const hue = findPlayerHero(world)?.get(WardenTrait)?.hue;
        if (hue === undefined || !findMuzzle(hue, light.position)) {
            light.intensity = 0;
            return;
        }
        if (hueRef.current !== hue) {
            hueRef.current = hue;
            light.color.set(readWardenColor(hue));
        }
        light.intensity =
            Math.max(0, 1 - measureSinceShot(hue) / lightSeconds) * 2;
    });
    if (useHeadless()) return null;
    return <pointLight ref={lightRef} intensity={0} distance={5} decay={1.5} />;
}
