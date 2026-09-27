import { useFrame } from "@react-three/fiber";
import type { Entity } from "koota";
import { useMemo, useRef, useState } from "react";
import {
    AdditiveBlending,
    Color,
    MeshBasicMaterial,
    SphereGeometry,
    SpriteMaterial,
    Vector3,
    type Group,
} from "three";
import { useHeadless } from "@spawnite/engine";
import { boltRadius } from "../siege/attacks";
import { BoltTrait, MonsterKind } from "../siege/traits";
import { readGlowTexture } from "./glowTexture";
import { monsterLooks } from "./palette";

//  A spitter's bolt: a glowing ball in the spitter's eyes' colour, a soft
//  glow round it, and a short trail of fading glows where it just was.

/** Glows in the trail, each at a place the ball stood a frame before. */
const trailLength = 5;

const white = new Color("#ffffff");
/** Short of full saturation, and above 1 so the bloom takes it. */
const boltColor = new Color(monsterLooks[MonsterKind.Spitter].eyes)
    .lerp(white, 0.3)
    .multiplyScalar(1.8);
const ballGeometry = new SphereGeometry(1, 16, 12);
const ballMaterial = new MeshBasicMaterial({
    color: boltColor,
    toneMapped: false,
});

interface BoltSprites {
    glow: SpriteMaterial;
    trail: SpriteMaterial;
}

let sprites: BoltSprites | undefined;

/** The glow sprites, made on first use: their texture paints a canvas, which
 *  a module the room imports must not do as it loads. */
function readBoltSprites() {
    sprites ??= {
        glow: new SpriteMaterial({
            map: readGlowTexture(),
            color: boltColor,
            transparent: true,
            opacity: 0.7,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        }),
        trail: new SpriteMaterial({
            map: readGlowTexture(),
            color: boltColor,
            transparent: true,
            opacity: 0.35,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        }),
    };
    return sprites;
}

interface BoltViewProps {
    entity: Entity;
}

function BoltBody({ entity }: BoltViewProps) {
    //  Read once: a bolt never changes size in flight.
    const [size] = useState(() => entity.get(BoltTrait)?.size ?? boltRadius);
    const { glow, trail } = readBoltSprites();
    const ballRef = useRef<Group>(null);
    const trailRef = useRef<Group>(null);
    //  Where the ball stood each of the last frames, newest first, in the
    //  world.
    const history = useMemo(
        () => Array.from({ length: trailLength }, () => new Vector3()),
        [],
    );
    const filledRef = useRef(0);

    useFrame(() => {
        const ball = ballRef.current;
        const trailGroup = trailRef.current;
        if (!ball || !trailGroup) return;
        //  The oldest place becomes the newest, so no vector is made.
        const newest = history[trailLength - 1];
        for (let index = trailLength - 1; index > 0; index--)
            history[index] = history[index - 1];
        history[0] = ball.getWorldPosition(newest);
        filledRef.current = Math.min(trailLength, filledRef.current + 1);
        const glows = trailGroup.children;
        for (let index = 0; index < glows.length; index++) {
            const glowSprite = glows[index];
            //  A glow with no place yet stays on the ball.
            const place = history[Math.min(index + 1, filledRef.current - 1)];
            glowSprite.position.copy(place);
            ball.worldToLocal(glowSprite.position);
        }
    });

    return (
        <group ref={ballRef}>
            <mesh
                geometry={ballGeometry}
                material={ballMaterial}
                scale={size}
            />
            <sprite material={glow} scale={size * 4} />
            <group ref={trailRef}>
                {Array.from({ length: trailLength - 1 }, (_, index) => (
                    <sprite
                        key={`trail-${index}`}
                        material={trail}
                        scale={size * 2.6 * (1 - (index + 1) / trailLength)}
                    />
                ))}
            </group>
        </group>
    );
}

/** Nothing in the room: it draws nothing, and its glow paints a canvas. */
export function BoltView(props: BoltViewProps) {
    return useHeadless() ? null : <BoltBody {...props} />;
}
