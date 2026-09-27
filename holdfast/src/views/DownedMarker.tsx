import { Html } from "@react-three/drei";
import type { Entity } from "koota";
import { useQueryFirst, useTrait } from "koota/react";
import { Bar, isPlayerHero, PlayerName, Text } from "@spawnite/engine";
import { reviveSeconds } from "../siege/downs";
import { SiegePhase, SiegeTrait, WardenTrait } from "../siege/traits";

interface DownedMarkerProps {
    entity: Entity;
}

/** Over a downed teammate while the run is on: her name, a call for help,
 *  and how far she is from getting up. Nothing over a warden on her feet,
 *  or over the page's own, whose screen says it. */
export function DownedMarker({ entity }: DownedMarkerProps) {
    const survivor = useTrait(entity, WardenTrait);
    const player = useTrait(entity, PlayerName);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    if (
        !survivor?.down ||
        siege?.phase === SiegePhase.Over ||
        isPlayerHero(entity)
    )
        return null;

    return (
        <Html
            position={[0, 1.8, 0]}
            center
            distanceFactor={8}
            style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
        >
            <Text size="lg">Get {player?.name ?? "her"} up</Text>
            <Bar
                label={`${player?.name ?? "Her"} getting up`}
                value={survivor.reviveSeconds}
                maximum={reviveSeconds}
            />
        </Html>
    );
}
