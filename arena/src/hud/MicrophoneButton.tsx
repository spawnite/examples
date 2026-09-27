import {
    Button,
    Hud,
    Icon,
    Panel,
    PanelVariant,
    Slot,
    useVoice,
} from "@spawnite/engine";

/** Her microphone's switch, once the room opens voice: on while she
 *  talks, which is how voice starts, and dimmed while off. A page whose
 *  microphone was refused has nothing to switch, and shows nothing. */
export function MicrophoneButton() {
    const microphone = useVoice((state) => state.microphone);
    const muted = useVoice((state) => state.muted);
    if (!microphone) return null;

    return (
        <Hud>
            <Panel slot={Slot.BottomRight} variant={PanelVariant.Bare}>
                <Button
                    label="Microphone"
                    pressed={!muted}
                    onPress={() => useVoice.setState({ muted: !muted })}
                >
                    <Icon name={muted ? "mic-off" : "mic"} className="size-7" />
                </Button>
            </Panel>
        </Hud>
    );
}
