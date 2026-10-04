import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useWorld } from "koota/react";
import {
    Anchor,
    createStore,
    findPlayerHero,
    Panel,
    PanelVariant,
    Text,
    TransformTrait,
} from "@spawnite/engine";
import type { Entity } from "koota";
import type { Mesh, MeshBasicMaterial } from "@spawnite/engine/three";

//  The way back to town from the wilds: a waystone near where she
//  arrives, a stone whose rune ring glows on the ground; stepping onto the
//  ring takes her home. The scene is left from the HUD, which watches for
//  it here, as the town's gate is left.

/** Metres from the stone within which she steps onto its ring. */
const ringReach = 1.3;

export const useTravel = createStore<{ home: boolean }>()(() => ({
    home: false,
}));

export function Waystone({ at }: { at: [number, number] }) {
    const world = useWorld();
    const hero = useRef<Entity | undefined>(undefined);
    const ring = useRef<Mesh>(null);
    const gone = useRef(false);

    useEffect(() => () => useTravel.setState({ home: false }), []);

    useFrame(({ clock }) => {
        const glow = ring.current;
        if (glow) {
            const pulse = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 2.5);
            (glow.material as MeshBasicMaterial).opacity = pulse;
            glow.rotation.z = clock.elapsedTime * 0.4;
        }
        if (gone.current) return;
        if (!hero.current?.isAlive()) hero.current = findPlayerHero(world);
        const heroAt = hero.current?.get(TransformTrait);
        if (
            heroAt &&
            Math.hypot(heroAt.x - at[0], heroAt.z - at[1]) < ringReach
        ) {
            gone.current = true;
            useTravel.setState({ home: true });
        }
    });

    return (
        <group position={[at[0], 0, at[1]]}>
            <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.04}>
                <ringGeometry args={[0.9, 1.25, 36]} />
                <meshBasicMaterial
                    color="#7fe0ff"
                    transparent
                    opacity={0.6}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position-y={0.035}>
                <circleGeometry args={[0.9, 36]} />
                <meshBasicMaterial
                    color="#1d3f55"
                    transparent
                    opacity={0.35}
                    depthWrite={false}
                />
            </mesh>
            <mesh position-y={0.6} castShadow>
                <cylinderGeometry args={[0.18, 0.28, 1.2, 6]} />
                <meshToonMaterial color="#8a9098" />
            </mesh>
            <mesh position-y={0.75}>
                <boxGeometry args={[0.1, 0.35, 0.33]} />
                <meshBasicMaterial color="#7fe0ff" toneMapped={false} />
            </mesh>
            <group position-y={1.5}>
                <Panel
                    anchor={Anchor.Above}
                    variant={PanelVariant.Bare}
                    maxDistance={25}
                >
                    <Text
                        size="xs"
                        className="font-semibold text-cyan-200 [text-shadow:0_1px_2px_black]"
                    >
                        To town
                    </Text>
                </Panel>
            </group>
        </group>
    );
}
