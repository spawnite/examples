import { Entity, Spin, type EntityProps } from "@spawnite/engine";

/** The ring at the end of the run, spinning to mark where it leads. The
 *  round ends on the coins, not on reaching the ring. */
export function Ring({ position }: Pick<EntityProps, "position">) {
    return (
        <Entity position={position}>
            <Spin speed={0.6} />
            {/*  Upright and lifted to stand on the ground. */}
            <mesh position={[0, 0.8, 0]}>
                <torusGeometry args={[0.8, 0.08, 16, 48]} />
                <meshStandardMaterial color="gold" />
            </mesh>
        </Entity>
    );
}
