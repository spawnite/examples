import {
    Bob,
    BodyKind,
    ColliderShape,
    Entity,
    Pickup,
    sounds,
    Spin,
    type EntityProps,
} from "@spawnite/engine";

/** One coin: it turns, bobs, and goes into the wallet of whoever reaches it,
 *  with a chime.
 *  Its body follows the bob, so the ball bounces off it where it is drawn. */
export function Coin({ position }: Pick<EntityProps, "position">) {
    return (
        <Entity
            position={position}
            collider={{
                shape: ColliderShape.Box,
                kind: BodyKind.Kinematic,
                size: [0.8, 0.1, 0.8],
            }}
        >
            <Spin speed={2} />
            <Bob height={0.2} />
            <Pickup reward={1} sound={sounds.pickup} />
            <mesh>
                <cylinderGeometry args={[0.4, 0.4, 0.1, 24]} />
                <meshStandardMaterial color="gold" />
            </mesh>
        </Entity>
    );
}
