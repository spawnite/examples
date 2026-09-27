import blasterModel from "@spawnite/assets/models/holdfast/blaster.glb?url";
import { Gltf, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
    AdditiveBlending,
    BoxGeometry,
    Color,
    CylinderGeometry,
    MeshBasicMaterial,
    PlaneGeometry,
    TorusGeometry,
    Vector3,
    type Group,
    type Object3D,
    type PointLight,
} from "three";
import { readStarTexture } from "../glowTexture";
import { holdMuzzle, measureSinceShot } from "./muzzles";

//  A warden's blaster in her hand, in its own frame: the grip at the
//  origin, the barrel toward negative z, up positive y. It kicks back at
//  each of her shots and flashes at its muzzle, its muzzle ring and the
//  vents along its sides glow in her colour and heat up while she fires,
//  and at rest it breathes in her hand.

/** The model's size in her hand: it is drawn as a long rifle. */
const modelScale = 0.85;
/** Where the model's grip and the end of its barrel sit, in its own
 *  units: measured off the file's vertices. */
const modelGrip = new Vector3(0, -0.09, 0.16);
const modelMuzzle = new Vector3(0, 0.057, -0.454);
/** Where the model stands and where its muzzle is, in the blaster's frame,
 *  the grip at the origin. */
const modelPlace = modelGrip.clone().multiplyScalar(-modelScale);
const muzzle = modelMuzzle.clone().sub(modelGrip).multiplyScalar(modelScale);
const flashPlace = muzzle.clone().add(new Vector3(0, 0, -0.08));
/** Seconds a shot's flash stands, and its kick takes to settle. */
const flashSeconds = 0.05;
const kickSeconds = 0.12;
/** Seconds the flash lights the ground round her. */
const lightSeconds = 0.08;

const flashGeometry = new PlaneGeometry(1, 1);

/** The glowing parts, in the model's own units, measured off its
 *  vertices: a ring round the barrel's end, a sleeve over the barrel's
 *  front, and a vent down each side of the body. */
const ringGeometry = new TorusGeometry(0.044, 0.009, 8, 24);
const sleeveGeometry = new CylinderGeometry(0.052, 0.05, 0.1, 16, 1, true);
sleeveGeometry.rotateX(Math.PI / 2);
const ventGeometry = new BoxGeometry(0.006, 0.014, 0.36);
const sleeveCentre = new Vector3(0, 0.057, -0.41);
const ventHeight = 0.12;
const ventCentre = -0.16;
const ventSide = 0.083;

/** How hot each shot makes the barrel, as a share of what is left to full,
 *  and the seconds it takes to cool from full. */
const heatPerShot = 0.3;
const coolSeconds = 0.5;
/** How bright the ring and the vents burn cold and at full heat: above 1
 *  blooms. */
const ringGlow = { cold: 1.3, hot: 4.5 };
const ventGlow = { cold: 0.45, hot: 4 };
/** The idle sway's reach: metres of bob and radians of tilt at the grip. */
const swayBob = 0.003;
const swayTilt = 0.012;

interface BlasterProps {
    hue: number;
    color: string;
    /** Whether its flash lights the ground round her: her own page's
     *  warden alone, so the scene holds one such light. */
    lit?: boolean;
}

export function Blaster({ hue, color, lit = false }: BlasterProps) {
    const lightRef = useRef<PointLight>(null);
    const kickRef = useRef<Group>(null);
    const flashRef = useRef<Group>(null);
    const muzzleRef = useRef<Object3D>(null);
    const swayRef = useRef<Group>(null);
    const heatRef = useRef({ heat: 0, since: Infinity });
    const glow = useMemo(() => {
        //  Short of her colour's full saturation, so the look's grade keeps
        //  every channel.
        const base = new Color(color).lerp(new Color("#fff0d8"), 0.25);
        const glowing = () =>
            new MeshBasicMaterial({ color: base.clone(), toneMapped: false });
        return {
            base,
            ring: glowing(),
            vent: glowing(),
            sleeve: new MeshBasicMaterial({
                color: base.clone(),
                transparent: true,
                opacity: 0,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        };
    }, [color]);
    useLayoutEffect(
        () => () => {
            glow.ring.dispose();
            glow.vent.dispose();
            glow.sleeve.dispose();
        },
        [glow],
    );
    const flash = useMemo(
        () =>
            new MeshBasicMaterial({
                map: readStarTexture(),
                color: new Color(color).lerp(new Color("#fff8e0"), 0.6),
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        [color],
    );
    useLayoutEffect(() => () => flash.dispose(), [flash]);
    useLayoutEffect(() => {
        const muzzle = muzzleRef.current;
        return muzzle ? holdMuzzle(hue, muzzle) : undefined;
    }, [hue]);

    useFrame(({ clock }, delta) => {
        const since = measureSinceShot(hue);
        const barrel = heatRef.current;
        barrel.heat = Math.max(0, barrel.heat - delta / coolSeconds);
        if (since < barrel.since)
            barrel.heat += (1 - barrel.heat) * heatPerShot;
        barrel.since = since;
        const heat = barrel.heat;
        glow.ring.color
            .copy(glow.base)
            .multiplyScalar(
                ringGlow.cold + (ringGlow.hot - ringGlow.cold) * heat,
            );
        glow.vent.color
            .copy(glow.base)
            .multiplyScalar(
                ventGlow.cold + (ventGlow.hot - ventGlow.cold) * heat,
            );
        glow.sleeve.opacity = heat * 0.8;
        const sway = swayRef.current;
        if (sway) {
            //  Stiller while she fires, so the kick reads alone.
            const reach = 1 - heat;
            const time = clock.elapsedTime + hue * 1.7;
            sway.position.y = Math.sin(time * 1.3) * swayBob * reach;
            sway.rotation.x = Math.sin(time * 1.1) * swayTilt * reach;
            sway.rotation.z = Math.sin(time * 0.7) * swayTilt * reach;
        }
        const kick = Math.max(0, 1 - since / kickSeconds);
        const group = kickRef.current;
        if (group) {
            group.position.z = kick * 0.07;
            group.rotation.x = kick * 0.25;
        }
        const flashGroup = flashRef.current;
        if (flashGroup) {
            const showing = since < flashSeconds;
            flashGroup.visible = showing;
            if (showing) {
                flashGroup.rotation.z = Math.random() * Math.PI;
                flashGroup.scale.setScalar(0.22 + Math.random() * 0.12);
                flash.opacity = 1 - since / flashSeconds;
            }
        }
        const light = lightRef.current;
        if (light) light.intensity = Math.max(0, 1 - since / lightSeconds) * 2;
    });

    return (
        <group ref={kickRef}>
            <group ref={swayRef}>
                <group scale={modelScale} position={modelPlace}>
                    <Gltf src={blasterModel} castShadow />
                    <mesh
                        geometry={ringGeometry}
                        material={glow.ring}
                        position={modelMuzzle}
                    />
                    <mesh
                        geometry={sleeveGeometry}
                        material={glow.sleeve}
                        position={sleeveCentre}
                    />
                    <mesh
                        geometry={ventGeometry}
                        material={glow.vent}
                        position={[ventSide, ventHeight, ventCentre]}
                    />
                    <mesh
                        geometry={ventGeometry}
                        material={glow.vent}
                        position={[-ventSide, ventHeight, ventCentre]}
                    />
                </group>
            </group>
            <object3D ref={muzzleRef} position={muzzle} />
            {lit && (
                <pointLight
                    ref={lightRef}
                    position={flashPlace}
                    color={color}
                    intensity={0}
                    distance={5}
                    decay={1.5}
                />
            )}
            <group ref={flashRef} position={flashPlace} visible={false}>
                {/*  Three crossed quads read as a star from any side. */}
                <mesh geometry={flashGeometry} material={flash} />
                <mesh
                    geometry={flashGeometry}
                    material={flash}
                    rotation-y={Math.PI / 2}
                />
                <mesh
                    geometry={flashGeometry}
                    material={flash}
                    rotation-x={Math.PI / 2}
                />
            </group>
        </group>
    );
}

useGLTF.preload(blasterModel);
