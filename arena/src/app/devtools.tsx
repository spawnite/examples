import type { Entity } from "koota";
import { useQuery, useTrait } from "koota/react";
import { Devtools } from "@spawnite/devtools";
import {
    NetworkId,
    PlayerName,
    Text,
    useRoom,
    WireFormat,
} from "@spawnite/engine";
import { Button } from "@spawnite/ui";

//  Loaded only in development, through the lazy import in app.tsx, so a
//  production build never reaches this module or the devtools behind it.

interface PlayerRowProps {
    entity: Entity;
}

/** One player's name, read off her own trait the way the scoreboard does,
 *  so a late join shows without the panel re-querying. */
function PlayerRow({ entity }: PlayerRowProps) {
    const player = useTrait(entity, PlayerName);
    return <Text>{player?.name ?? ""}</Text>;
}

/** Reopens the page with the room sending `wire`, as `?wire=` asks: the
 *  page reads its room once, as it mounts. `reload` is the page's own; a
 *  test passes another, since jsdom will not let one be watched. */
export function reopenOnWire(
    wire: WireFormat,
    reload = () => window.location.reload(),
) {
    const query = new URLSearchParams(window.location.search);
    if (wire === WireFormat.Json) query.set("wire", wire);
    else query.delete("wire");
    window.history.replaceState(null, "", `?${query}`);
    reload();
}

/** The room as this page sees it: its status, who is in it, how often it
 *  speaks, what that weighs and on which wire, how long a step takes here, how far it has
 *  corrected her, the round trip, how far behind the room it draws
 *  the others, and how many of her shots it refused for their origin.
 *  Laid out as the inspector's own labelled rows, a term beside its
 *  value, rather than a row of bare stats. */
export function RoomPanel() {
    const {
        status,
        snapshotsPerSecond,
        bytesPerSecond,
        stepMilliseconds,
        corrections,
        correctionMetres,
        roundTripMilliseconds,
        interpolationMilliseconds,
        refusedShotOrigins,
    } = useRoom();
    const players = useQuery(NetworkId, PlayerName);
    const json =
        new URLSearchParams(window.location.search).get("wire") ===
        WireFormat.Json;

    return (
        <Text
            as="dl"
            className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 px-3"
        >
            <Text as="dt">status</Text>
            <Text as="dd">{status}</Text>

            <Text as="dt">players</Text>
            <Text as="dd" className="flex flex-wrap gap-1.5">
                {players.map((entity) => (
                    <PlayerRow key={entity} entity={entity} />
                ))}
            </Text>

            <Text as="dt">snapshots/s</Text>
            <Text as="dd">{Math.round(snapshotsPerSecond)}</Text>

            <Text as="dt">kB/s</Text>
            <Text as="dd">{(bytesPerSecond / 1000).toFixed(1)}</Text>

            <Text as="dt">wire</Text>
            <Text as="dd" className="flex items-center gap-2">
                {json ? "JSON" : "binary"}
                <Button
                    onPress={() =>
                        reopenOnWire(json ? WireFormat.Binary : WireFormat.Json)
                    }
                >
                    {json ? "binary" : "JSON"}
                </Button>
            </Text>

            <Text as="dt">step ms</Text>
            <Text as="dd">{stepMilliseconds.toFixed(2)}</Text>

            <Text as="dt">corrections/s</Text>
            <Text as="dd">{corrections}</Text>

            <Text as="dt">correction cm</Text>
            <Text as="dd">{Math.round(correctionMetres * 100)}</Text>

            <Text as="dt">round trip ms</Text>
            <Text as="dd">{Math.round(roundTripMilliseconds)}</Text>

            <Text as="dt">draw delay ms</Text>
            <Text as="dd">{Math.round(interpolationMilliseconds)}</Text>

            <Text as="dt">refused origins</Text>
            <Text as="dd">{refusedShotOrigins}</Text>
        </Text>
    );
}

const panels = [{ title: "Room", component: RoomPanel }];

export default function ArenaDevtools() {
    return <Devtools panels={panels} />;
}
