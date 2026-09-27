import { Html } from "@react-three/drei";
import type { Entity } from "koota";
import { useTrait } from "koota/react";
import {
    Bar,
    Body,
    ChaseTrait,
    defaultWalkerBody,
    HealthTrait,
    PlayerName,
    Text,
    useEntity,
    useHeadless,
} from "@spawnite/engine";

//  Html scales the element by distanceFactor / (2 · tan(fov / 2) · distance).
//  This factor draws the house bar, 160 by 8 pixels, at 128 pixels wide from
//  where the camera starts: the size the mmorpg's own bar over a head is
//  tuned to.
const distanceFactor = 2.7;
/** Metres above a monster's origin: clear of the boulder drawn there, which
 *  stands 0.61 m tall on the ground. */
const monsterBarHeight = 0.7;

interface OverlayProps {
    entity: Entity;
}

/** Over a heroine's head, her name and her health; over a monster's, its
 *  health alone. A coin carries nothing, and nothing is drawn headless, as
 *  in the room. */
export function Overlay({ entity }: OverlayProps) {
    const player = useTrait(entity, PlayerName);
    const health = useTrait(entity, HealthTrait);
    const headless = useHeadless();
    //  Read once: the stream writes a new entity's traits in the delta that
    //  spawns it, before this draws.
    const monster = entity.has(ChaseTrait);
    if (headless || (!player && !monster)) return null;
    //  A heroine's placeholder body is drawn at her Body's height.
    const height = monster
        ? monsterBarHeight
        : (entity.get(Body) ?? defaultWalkerBody).height;

    return (
        <Html
            position={[0, height, 0]}
            distanceFactor={distanceFactor}
            //  Styled inline rather than with classes: the game's own sources
            //  are outside what Tailwind scans. The shift stands the label's
            //  bottom edge on the head, centred over it.
            style={{
                pointerEvents: "none",
                whiteSpace: "nowrap",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                paddingBottom: 6,
                transform: "translate(-50%, -100%)",
            }}
        >
            {player && <Text>{player.name}</Text>}
            {health && (
                <Bar
                    label={
                        player ? `${player.name}'s health` : "Monster health"
                    }
                    value={health.current}
                    maximum={health.maximum}
                />
            )}
        </Html>
    );
}

/** The overlay over the nearest Entity. */
export function EntityOverlay() {
    return <Overlay entity={useEntity()} />;
}
