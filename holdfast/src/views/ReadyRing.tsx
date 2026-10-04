import { useFrame } from "@react-three/fiber";
import { useQueryFirst, useTrait, useWorld } from "koota/react";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    Color,
    RingGeometry,
    type BufferGeometry,
    type MeshBasicMaterial,
} from "three";
import {
    AuthorityTrait,
    GroundTrait,
    HeroTrait,
    TransformTrait,
    useHeadless,
    useTime,
    useWorldEntity,
} from "@spawnite/engine";
import { SiegeTrait } from "../siege/traits";
import { isReadyAsked } from "../siege/gathering";
import { isInReadyRing, readyRingMetres } from "../siege/waves";
import { usePhase } from "./phase";

//  The ring by the fire a warden stands in to say she is ready, lit in
//  every phase the room readies by it and at no other time: not in the
//  first breather, which asks nothing. Its outer edge
//  is the ring's edge as the room measures it, so a warden whose feet are
//  on the band is in. A slow green breath while it waits, a faint floor
//  that says the ground inside it counts, a bright flare while her own
//  hero stands in it, and a quick pulse while the run counts down.

/** Metres of the band of light, inward from the ring's edge. */
const bandMetres = 0.3;
/** Metres the light floats over the ground under it, clear of the
 *  flagstones. */
const liftMetres = 0.08;
const waitColor = new Color("#5cf29a").multiplyScalar(1.4);
const insideColor = new Color("#b8ffd6").multiplyScalar(2.6);
const countColor = new Color("#e6ffef").multiplyScalar(2.4);
const floorColor = new Color("#5cf29a");

/** The ground's height where it stands, as the world's surface reads it. */
interface Heights {
    getHeightAt(point: { x: number; z: number }): number;
}

/** Lays a flat ring on the ground point by point, so no rise of the ground
 *  hides it. */
function layOnGround(
    ring: BufferGeometry,
    surface: Heights | undefined,
): BufferGeometry {
    ring.rotateX(-Math.PI / 2);
    const points = ring.getAttribute("position");
    for (let index = 0; index < points.count; index++) {
        const x = points.getX(index);
        const z = points.getZ(index);
        points.setY(index, (surface?.getHeightAt({ x, z }) ?? 0) + liftMetres);
    }
    return ring;
}

export function ReadyRing() {
    const world = useWorld();
    const headless = useHeadless();
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = usePhase();
    const surface = useWorldEntity().get(GroundTrait)?.surface;
    const bandRef = useRef<MeshBasicMaterial>(null);
    const floorRef = useRef<MeshBasicMaterial>(null);
    const open = isReadyAsked(phase, siege?.wave ?? 0);
    //  A breather's seconds count to the wave, not to a start.
    const counting =
        open && phase !== "breather" && (siege?.secondsLeft ?? 0) > 0;
    const band = useMemo(
        () =>
            layOnGround(
                new RingGeometry(
                    readyRingMetres - bandMetres,
                    readyRingMetres,
                    128,
                ),
                surface,
            ),
        [surface],
    );
    const floor = useMemo(
        () =>
            layOnGround(
                new RingGeometry(0.01, readyRingMetres - bandMetres, 96, 8),
                surface,
            ),
        [surface],
    );
    useLayoutEffect(() => () => band.dispose(), [band]);
    useLayoutEffect(() => () => floor.dispose(), [floor]);

    useFrame(() => {
        const bandMaterial = bandRef.current;
        const floorMaterial = floorRef.current;
        if (!bandMaterial || !floorMaterial) return;
        const seconds = useTime.getState().seconds;
        const feet = world
            .queryFirst(HeroTrait, AuthorityTrait)
            ?.get(TransformTrait);
        const inside = feet !== undefined && isInReadyRing(feet);
        const pulse = counting
            ? 0.7 + 0.3 * Math.sin(seconds * 9)
            : inside
              ? 0.9 + 0.1 * Math.sin(seconds * 4)
              : 0.55 + 0.25 * Math.sin(seconds * 1.6);
        bandMaterial.opacity = pulse;
        bandMaterial.color.copy(
            counting ? countColor : inside ? insideColor : waitColor,
        );
        floorMaterial.opacity = inside || counting ? 0.16 : 0.05;
    });

    if (headless || !open) return null;
    return (
        <group name="ready-ring">
            <mesh geometry={floor} renderOrder={1}>
                <meshBasicMaterial
                    ref={floorRef}
                    color={floorColor}
                    transparent
                    depthWrite={false}
                    blending={AdditiveBlending}
                    toneMapped={false}
                />
            </mesh>
            <mesh geometry={band} renderOrder={2}>
                <meshBasicMaterial
                    ref={bandRef}
                    transparent
                    depthWrite={false}
                    blending={AdditiveBlending}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
}
