import { Hud, Panel, RoomStatus, Slot, Text, useRoom } from "@spawnite/engine";

/** What the bottom line says while the room has not taken her in. */
const statusLines: Record<Exclude<RoomStatus, RoomStatus.Joined>, string> = {
    [RoomStatus.Connecting]: "Connecting to the room.",
    [RoomStatus.Reconnecting]: "The room went away. Rejoining it.",
    [RoomStatus.Closed]: "No room. Start it and reload the page.",
};

/** How to play, and where the room stands until it has joined. */
export function Instructions() {
    const status = useRoom((state) => state.status);

    return (
        <Hud>
            <Panel slot={Slot.Bottom}>
                <Text>
                    WASD walks and the mouse looks. A click shoots, a right
                    click slings a stone. Grab the coins.
                </Text>
                {status !== RoomStatus.Joined && (
                    <Text>{statusLines[status]}</Text>
                )}
            </Panel>
        </Hud>
    );
}
