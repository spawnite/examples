import { Hud, Panel, Slot, Text, useRoom } from "@spawnite/engine";

/** How to play, and the engine's notice about her connection until the
 *  room has joined her. */
export function Instructions() {
    const notice = useRoom((state) => state.notice);

    return (
        <Hud>
            <Panel slot={Slot.Bottom}>
                <Text>
                    WASD walks and the mouse looks. A click shoots, a right
                    click slings a stone. Grab the coins.
                </Text>
                {notice && <Text>{notice.text}</Text>}
            </Panel>
        </Hud>
    );
}
