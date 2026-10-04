import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
    MathUtils,
    Mesh,
    type BufferGeometry,
    type MeshStandardMaterial,
    type Vector3Tuple,
} from "three";
import { Billboard, EnergyOrbMaterial, useModel } from "@spawnite/engine";
import { wandUrl } from "../models";
import { arcaneColor } from "./abilities";

/** The middle of the orb the crescent cradles, in metres from the wand's
 *  pommel in the file's axes. */
export const wandOrb: Vector3Tuple = [0.005, 0.313, 0];
//  The crescent's lowest point up the wand: every triangle above it glows.
const crescentFoot = 0.28;
//  The EnergyOrbMaterial's orb fills the middle 62% of its plane: this
//  plane draws it a little wider than the model's 2.2 cm orb, which it
//  hides, with its glow round it.
const orbPlane = 0.045;
//  Past the model's orb's widest reach, 11.6 mm from its middle: the plane
//  stands this far toward the camera, so the orb it hides does not hide
//  its middle.
const orbRadius = 0.015;
//  How brightly the crescent glows at rest and while the charge plays,
//  above the look's bloom threshold in both, and how fast it eases between.
const restGlow = 1.8;
const chargeGlow = 6;
const glowEase = 8;

/** The crescent wand's model in the file's axes, its pommel at the origin:
 *  its crescent lit in the arcane blue for the look's bloom, softly at rest
 *  and brighter while `charging`, and a glowing EnergyOrbMaterial orb in
 *  place of the model's own. */
export function CrescentWand({ charging }: { charging: boolean }) {
    const { scene } = useModel(wandUrl);
    const { geometry, materials } = useMemo(() => {
        //  The Meshy file is one baked mesh on one textured material.
        const mesh = scene.getObjectByProperty("isMesh", true) as Mesh<
            BufferGeometry,
            MeshStandardMaterial
        >;
        const lit = mesh.material.clone();
        lit.emissive.set(arcaneColor);
        //  The texture's own light and dark: the silver edge glows, the
        //  crescent's dark faces stay dark.
        lit.emissiveMap = lit.map;
        lit.emissiveIntensity = restGlow;
        return {
            geometry: splitGeometryAtHeight(mesh.geometry, crescentFoot),
            materials: [mesh.material, lit],
        };
    }, [scene]);
    const [, lit] = materials;
    useEffect(
        () => () => {
            geometry.dispose();
            lit.dispose();
        },
        [geometry, lit],
    );
    useFrame((_state, deltaSeconds) => {
        lit.emissiveIntensity = MathUtils.damp(
            lit.emissiveIntensity,
            charging ? chargeGlow : restGlow,
            glowEase,
            deltaSeconds,
        );
    });
    return (
        <>
            <mesh
                geometry={geometry}
                material={materials}
                castShadow
                receiveShadow
            />
            <Billboard offset={wandOrb}>
                <mesh position={[0, 0, orbRadius]}>
                    <planeGeometry args={[orbPlane, orbPlane]} />
                    <EnergyOrbMaterial
                        color={arcaneColor}
                        intensity={charging ? 2.4 : 1.4}
                    />
                </mesh>
            </Billboard>
        </>
    );
}

/** A copy of `source` in two groups for two materials: the triangles below
 *  `height` draw with the first, those wholly above it with the second. */
function splitGeometryAtHeight(source: BufferGeometry, height: number) {
    const { index, attributes } = source;
    if (!index) throw new Error("The crescent wand's mesh has no index.");
    const below: number[] = [];
    const above: number[] = [];
    for (let at = 0; at < index.count; at += 3) {
        const corners = [
            index.getX(at),
            index.getX(at + 1),
            index.getX(at + 2),
        ];
        const lowest = Math.min(
            ...corners.map((corner) => attributes.position.getY(corner)),
        );
        (lowest >= height ? above : below).push(...corners);
    }
    const split = source.clone();
    split.setIndex([...below, ...above]);
    split.clearGroups();
    split.addGroup(0, below.length, 0);
    split.addGroup(below.length, above.length, 1);
    return split;
}
