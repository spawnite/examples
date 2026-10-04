import { useWorld } from "koota/react";
import {
    Button,
    ButtonVariant,
    Modal,
    Slider,
    Text,
    useScenes,
    useSettings,
} from "@spawnite/engine";
import { dialogLook, paneLook, primaryLook } from "./classes";
import { useChoice } from "../store/choice";
import { leaveRun } from "../store/flow";
import { usePhoneLayout } from "./usePhoneLayout";
import { KeyHelp } from "./KeyHelp";

//  P's pause: the world holds still, the music goes quiet, and the music and
//  effects volumes are at hand; they are the engine's own settings, the
//  ones its menu shows too.

const leftEarly = "Run left early.";

interface VolumeSliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
}

function VolumeSlider({ label, value, onChange }: VolumeSliderProps) {
    return (
        <Text as="div" className="df-control">
            <Text as="div" className="flex justify-between">
                {label}
                <Text as="output">{`${value}%`}</Text>
            </Text>
            <Slider
                label={label}
                min={0}
                max={100}
                value={value}
                valueText={`${value}%`}
                onChange={onChange}
            />
        </Text>
    );
}

export function PauseMenu() {
    const world = useWorld();
    const scenes = useScenes();
    const paused = useChoice((state) => state.paused);
    const musicVolume = useSettings((state) => state.musicVolume);
    const effectsVolume = useSettings((state) => state.effectsVolume);
    const resume = () => useChoice.setState({ paused: false });
    //  A phone has no keys to list.
    const phone = usePhoneLayout();
    return (
        <Modal
            className={paneLook}
            dialogClassName={dialogLook}
            open={paused}
            pause
            title="Run paused"
            overline="TAKE A BREATHER"
            onClose={resume}
            actions={
                <>
                    <Button
                        className={`${primaryLook} flex-1`}
                        variant={ButtonVariant.Accent}
                        onPress={resume}
                    >
                        Resume run
                    </Button>
                    <Button
                        className="df-btn"
                        onPress={() => leaveRun(world, scenes, leftEarly)}
                    >
                        Leave run
                    </Button>
                </>
            }
        >
            <Text as="div" className="df-pane df-text">
                <Text as="p">Your arena will be here when you’re ready.</Text>
                {!phone && <KeyHelp />}
                {/* In the pane, where a phone's narrow row of actions has no
                    room for a third. */}
                <Button
                    className="df-btn mt-1 mb-3"
                    onPress={() =>
                        useChoice.setState({ paused: false, notes: true })
                    }
                >
                    Field notes
                </Button>
                <VolumeSlider
                    label="Music"
                    value={musicVolume}
                    onChange={(value) =>
                        useSettings.setState({ musicVolume: value })
                    }
                />
                <VolumeSlider
                    label="Effects"
                    value={effectsVolume}
                    onChange={(value) =>
                        useSettings.setState({ effectsVolume: value })
                    }
                />
            </Text>
        </Modal>
    );
}
