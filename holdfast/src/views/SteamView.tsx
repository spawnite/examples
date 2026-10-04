import { useFrame } from "@react-three/fiber";
import type { Entity } from "koota";
import { useTrait } from "koota/react";
import { useRef } from "react";
import {
    AdditiveBlending,
    Color,
    MeshBasicMaterial,
    PlaneGeometry,
    SpriteMaterial,
    type Mesh,
    type Sprite,
} from "three";
import { FromWelcomeTrait } from "@spawnite/engine";
import { steamCloud } from "../siege/elements";
import { SteamTrait } from "../siege/traits";
import { readGlowTexture, readRingTexture } from "./glowTexture";

//  A steam cloud where a reaction raised it: billows of white steam turning
//  slowly over the ground it covers, lit orange from inside by the heat, and
//  a ring on the ground at its reach, so a warden sees what it holds. It
//  swells in as it mounts and thins out over its last second, and a
//  reaction inside it renews it at full.

/** Billows a cloud draws. */
const billowCount = 8;
/** Seconds it takes to swell in, and to thin out at its end. */
const swellSeconds = 0.5;
const thinSeconds = 1;

/** A cloud's materials: its billows, the heat inside it and the ring at
 *  its edge. */
interface SteamMaterials {
    billow: SpriteMaterial;
    heat: SpriteMaterial;
    edge: MeshBasicMaterial;
}

//  Shared by every cloud: made on the first page that draws one, since
//  their textures are drawn on a canvas.
let materials: SteamMaterials | undefined;

function readMaterials() {
    materials ??= {
        //  A soft round glow drawn over the scene, not added to it, so the
        //  billows read as steam rather than light.
        billow: new SpriteMaterial({
            map: readGlowTexture(),
            color: new Color("#e4ecef"),
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
        }),
        heat: new SpriteMaterial({
            map: readGlowTexture(),
            color: new Color("#ff7a36").multiplyScalar(0.9),
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        }),
        edge: new MeshBasicMaterial({
            map: readRingTexture(),
            color: new Color("#ffd2b0").multiplyScalar(0.8),
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        }),
    };
    return materials;
}

const edgeGeometry = new PlaneGeometry(1, 1);

/** Each billow's place on its turn, as a share of the reach: its angle,
 *  how far out, its height and its size. */
const billows = Array.from({ length: billowCount }, (_, index) => ({
    angle: (index / billowCount) * Math.PI * 2,
    out: 0.25 + 0.5 * ((index * 0.37) % 1),
    height: 0.35 + 0.5 * ((index * 0.61) % 1),
    size: 0.9 + 0.5 * ((index * 0.29) % 1),
}));

interface SteamViewProps {
    entity: Entity;
}

export function SteamView({ entity }: SteamViewProps) {
    const cloud = useTrait(entity, SteamTrait);
    const radius = cloud?.radius ?? steamCloud.metres;
    const renewals = cloud?.renewals ?? 0;
    const { billow, heat, edge } = readMaterials();
    const billowRefs = useRef<(Sprite | null)[]>([]);
    const heatRef = useRef<Sprite>(null);
    const edgeRef = useRef<Mesh>(null);
    const bornRef = useRef<number | null>(null);
    //  A renewal starts its seconds again, at full, with no swell.
    const renewedRef = useRef(renewals);

    useFrame(({ clock }) => {
        const now = clock.elapsedTime;
        if (renewedRef.current !== renewals) {
            renewedRef.current = renewals;
            bornRef.current = now - swellSeconds;
        }
        //  A cloud a welcome brings stands whole: its age is not streamed.
        bornRef.current ??= entity.has(FromWelcomeTrait)
            ? now - swellSeconds
            : now;
        const age = now - bornRef.current;
        //  Its whole life is known: it thins over its last second.
        const swell =
            Math.min(1, age / swellSeconds) *
            Math.min(1, Math.max(0, (steamCloud.seconds - age) / thinSeconds));
        billows.forEach((shape, index) => {
            const sprite = billowRefs.current[index];
            if (!sprite) return;
            const angle = shape.angle + now * 0.35;
            sprite.position.set(
                Math.sin(angle) * radius * shape.out,
                radius * 0.3 * shape.height + 0.15 * Math.sin(now + index),
                Math.cos(angle) * radius * shape.out,
            );
            sprite.scale.setScalar(radius * 0.9 * shape.size * swell);
        });
        const glow = heatRef.current;
        if (glow)
            glow.scale.setScalar(
                radius * 1.6 * swell * (0.9 + 0.1 * Math.sin(now * 9)),
            );
        const ring = edgeRef.current;
        if (ring) ring.scale.setScalar(radius * 2.1 * swell);
    });

    return (
        <group>
            {billows.map((shape, index) => (
                <sprite
                    key={shape.angle}
                    ref={(sprite) => {
                        billowRefs.current[index] = sprite;
                    }}
                    material={billow}
                    scale={0}
                />
            ))}
            <sprite
                ref={heatRef}
                material={heat}
                position-y={radius * 0.2}
                scale={0}
            />
            <mesh
                ref={edgeRef}
                geometry={edgeGeometry}
                material={edge}
                rotation-x={-Math.PI / 2}
                position-y={0.07}
                scale={0}
            />
        </group>
    );
}
