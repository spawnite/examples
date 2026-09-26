import { Entity, Spin, type EntityProps } from "@spawnite/engine";

/** What Feature is in the world, in one line. */
export function Feature({ position }: Pick<EntityProps, "position">) {
    return (
        <Entity position={position}>
            <Spin speed={1} />
            <mesh>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial color="gold" />
            </mesh>
        </Entity>
    );
}
