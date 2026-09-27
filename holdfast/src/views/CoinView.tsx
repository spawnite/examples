import { useFrame } from "@react-three/fiber";
import type { Entity } from "koota";
import { useTrait, useWorld } from "koota/react";
import { useEffect, useRef } from "react";
import {
    AdditiveBlending,
    Color,
    CylinderGeometry,
    MeshBasicMaterial,
    TorusGeometry,
    Vector3,
    type Group,
    type Sprite,
    type SpriteMaterial,
} from "three";
import { Hero, Transform } from "@spawnite/engine";
import { CoinTrait, SiegePhase, SiegeTrait } from "../siege/traits";
import { popCoin } from "./effects/coinPop";
import { readGlowTexture, readStarTexture } from "./glowTexture";

//  A coin: a gold disc on its edge that turns and bobs, bright enough to
//  glow at dusk, a star glinting off it now and then, blinking once it is
//  about to go, and popping into gold where a warden takes it.

const faceGeometry = new CylinderGeometry(0.2, 0.2, 0.05, 20);
const rimGeometry = new TorusGeometry(0.2, 0.025, 6, 20);
//  Lit from within rather than by the scene, and short of full saturation:
//  the dusk look's grading drew the lit, deep gold face black.
const gold = new MeshBasicMaterial({ color: "#ffd98a" });
const rim = new MeshBasicMaterial({
    color: new Color("#ffe39a").multiplyScalar(1.6),
    toneMapped: false,
});
/** A glint burns past white, so the bloom takes it. */
const glintColor = new Color("#fff6d8").multiplyScalar(3);
/** Seconds between two glints of one coin. */
const glintSeconds = 1.8;
/** Seconds a glint lasts. */
const glintLength = 0.22;
/** Metres from a warden's feet within which a coin that goes was taken
 *  rather than left to run out: the room takes it within 0.6 m of her
 *  middle, and a page draws both a little behind. */
const takenMetres = 1.6;

//  Written in place as a coin goes.
const heroFeet = new Vector3();

interface CoinViewProps {
    entity: Entity;
}

export function CoinView({ entity }: CoinViewProps) {
    const world = useWorld();
    const coin = useTrait(entity, CoinTrait);
    const spinRef = useRef<Group>(null);
    const glintRef = useRef<Sprite>(null);
    const glintMaterialRef = useRef<SpriteMaterial>(null);
    //  Where it was last drawn, and whether it had begun to fade: what
    //  tells a coin taken from one run out when the stream drops it.
    const placeRef = useRef(new Vector3());
    const fadingRef = useRef(false);
    fadingRef.current = coin?.fading ?? false;

    useEffect(
        () => () => {
            //  A run that ends or empties clears every coin at once, in the
            //  same delta that sets the phase: none of those was taken.
            const phase = world.queryFirst(SiegeTrait)?.get(SiegeTrait)?.phase;
            if (phase === SiegePhase.Over || phase === SiegePhase.Waiting)
                return;
            const place = placeRef.current;
            let taken = !fadingRef.current;
            if (!taken)
                for (const hero of world.query(Hero, Transform)) {
                    const feet = hero.get(Transform);
                    if (
                        feet &&
                        heroFeet.copy(feet).distanceTo(place) < takenMetres
                    )
                        taken = true;
                }
            //  A coin never drawn has no place to pop at.
            if (taken && place.lengthSq() > 0) popCoin(place);
        },
        [world],
    );

    useFrame(({ clock }) => {
        const spin = spinRef.current;
        if (!spin) return;
        const now = clock.elapsedTime;
        const offset = entity.id();
        spin.rotation.y = now * 3 + offset;
        spin.position.y = Math.sin(now * 2.5 + offset) * 0.06;
        spin.visible = !coin?.fading || Math.sin(now * 20) > 0;
        spin.getWorldPosition(placeRef.current);
        //  A glint: a star that flares and turns for a moment each cycle.
        const phase = ((now + offset * 0.37) % glintSeconds) / glintLength;
        const glint = phase < 1 ? Math.sin(phase * Math.PI) : 0;
        const star = glintRef.current;
        const starMaterial = glintMaterialRef.current;
        if (star && starMaterial) {
            star.visible = glint > 0;
            star.scale.setScalar(0.2 + glint * 0.75);
            starMaterial.rotation = phase * 0.8;
            starMaterial.opacity = glint;
        }
    });

    return (
        <group ref={spinRef}>
            <mesh
                geometry={faceGeometry}
                material={gold}
                rotation-x={Math.PI / 2}
                castShadow
            />
            <mesh geometry={rimGeometry} material={rim} />
            <sprite scale={0.9}>
                <spriteMaterial
                    map={readGlowTexture()}
                    color="#ffb52e"
                    transparent
                    opacity={0.55}
                    blending={AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                />
            </sprite>
            <sprite ref={glintRef} position={[0.08, 0.1, 0.06]}>
                <spriteMaterial
                    ref={glintMaterialRef}
                    map={readStarTexture()}
                    color={glintColor}
                    transparent
                    blending={AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                />
            </sprite>
        </group>
    );
}
