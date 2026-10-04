import { Html } from "@react-three/drei";
import type { Entity } from "koota";
import { useHas, useQueryFirst, useTrait } from "koota/react";
import { Bar, isPlayerHero, PlayerNameTrait, Text } from "@spawnite/engine";
import { reviveSeconds } from "../siege/downs";
import { EndCause, SiegeTrait } from "../siege/traits";
import { LifeMachine, LifeTrait } from "../siege/life";
import { usePhase } from "./phase";

interface DownedMarkerProps {
    entity: Entity;
}

/** Over a downed teammate while the run is on: her name, a call for help,
 *  and how far she is from getting up. Nothing over a warden on her feet,
 *  over the page's own, whose screen says it, or on the run's last fall,
 *  when nobody can get her up. */
export function DownedMarker({ entity }: DownedMarkerProps) {
    const down = useHas(entity, LifeMachine.is.down);
    const revived = useTrait(entity, LifeTrait)?.revived ?? 0;
    const player = useTrait(entity, PlayerNameTrait);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = usePhase();
    if (
        !down ||
        phase === "over" ||
        (siege?.cause ?? EndCause.None) !== EndCause.None ||
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
                value={revived}
                maximum={reviveSeconds}
            />
        </Html>
    );
}
