import type { Entity } from "koota";
import { useQuery, useTrait } from "koota/react";
import {
    Hud,
    NetworkId,
    Panel,
    PlayerName,
    Slot,
    Text,
    useRoom,
    Wallet,
} from "@spawnite/engine";

interface ScoreRowProps {
    entity: Entity;
}

/** One heroine's name and coins, the page's own marked. */
function ScoreRow({ entity }: ScoreRowProps) {
    const player = useTrait(entity, PlayerName);
    const wallet = useTrait(entity, Wallet);
    const heroId = useRoom((state) => state.heroId);
    const own = heroId !== null && entity.get(NetworkId)?.id === heroId;
    const name = player?.name ?? "";

    return (
        <Text>
            {own ? `${name} (you)` : name}: {wallet?.coins ?? 0}
        </Text>
    );
}

/** Every heroine in the room and the coins she holds, as the room counts
 *  them. */
export function Scoreboard() {
    const heroes = useQuery(PlayerName, Wallet);

    return (
        <Hud>
            <Panel slot={Slot.TopRight}>
                <Text>Coins</Text>
                {heroes.map((entity) => (
                    <ScoreRow key={entity} entity={entity} />
                ))}
            </Panel>
        </Hud>
    );
}
