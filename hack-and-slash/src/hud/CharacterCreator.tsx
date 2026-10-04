import { useState, type ReactNode } from "react";
import { Button, Icon, Panel, Slider, Slot, Text } from "@spawnite/engine";
import {
    faceChoice,
    faceChosen,
    faces,
    hairStyles,
    ramps,
    rampGradient,
    randomLook,
} from "../hero/look";
import { finishCreation, setLook, useProgress } from "../hero/progress";

/** A row: its parts side by side, spread to the window's edges. */
function Row({ children }: { children: ReactNode }) {
    return (
        <Text as="div" className="flex items-center justify-between gap-3">
            {children}
        </Text>
    );
}

const small = "size-8 min-w-8 rounded-xl px-2 text-sm";

/** Steps through a list of named choices with a button either side. */
function Picker({
    label,
    names,
    index,
    onPick,
}: {
    label: string;
    names: readonly string[];
    index: number;
    onPick: (index: number) => void;
}) {
    const step = (by: number) =>
        onPick((index + by + names.length) % names.length);
    return (
        <Row>
            <Text size="xs" className="w-16">
                {label}
            </Text>
            <Button
                label={`Previous ${label.toLowerCase()}`}
                onPress={() => step(-1)}
                className={small}
            >
                <Icon name="arrow-big-left" className="size-4" />
            </Button>
            <Text className="w-20 text-center">{names[index]}</Text>
            <Button
                label={`Next ${label.toLowerCase()}`}
                onPress={() => step(1)}
                className={small}
            >
                <Icon name="arrow-big-right" className="size-4" />
            </Button>
        </Row>
    );
}

/** A slider along a colour ramp, its track painted with the ramp. */
function ColorSlider({
    label,
    stops,
    value,
    onChange,
}: {
    label: string;
    stops: readonly string[];
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <Text as="label" className="flex flex-col gap-1">
            <Text size="xs">{label}</Text>
            <Slider
                label={label}
                min={0}
                max={1}
                step={0.005}
                value={value}
                onChange={onChange}
                style={{ "--slider-track": rampGradient(stops) }}
                className="w-56"
            />
        </Text>
    );
}

/** The character creation window: her hairstyle and face, and a slider
 *  each for her hair, her skin, her eyes, one for both or one per eye, and
 *  her outfit. Her model in the town changes as each does. */
export function CharacterCreator({
    slot,
    onDone,
}: {
    slot: Slot;
    onDone: () => void;
}) {
    const look = useProgress((state) => state.look);
    const created = useProgress((state) => state.created);
    const [matched, setMatched] = useState(look.leftEye === look.rightEye);

    return (
        <Panel slot={slot}>
            <Text size="base">
                {created ? "Change your look" : "Create your hero"}
            </Text>
            <Picker
                label="Hair"
                names={hairStyles}
                index={look.hair}
                onPick={(hair) => setLook({ hair })}
            />
            <Picker
                label="Face"
                names={faces}
                index={faceChoice(look.face)}
                onPick={(choice) => setLook({ face: faceChosen(choice) })}
            />
            <ColorSlider
                label="Hair colour"
                stops={ramps.hair}
                value={look.hairColor}
                onChange={(hairColor) => setLook({ hairColor })}
            />
            <ColorSlider
                label="Skin"
                stops={ramps.skin}
                value={look.skin}
                onChange={(skin) => setLook({ skin })}
            />
            {matched ? (
                <ColorSlider
                    label="Eyes"
                    stops={ramps.eye}
                    value={look.leftEye}
                    onChange={(eye) => setLook({ leftEye: eye, rightEye: eye })}
                />
            ) : (
                <>
                    <ColorSlider
                        label="Left eye"
                        stops={ramps.eye}
                        value={look.leftEye}
                        onChange={(leftEye) => setLook({ leftEye })}
                    />
                    <ColorSlider
                        label="Right eye"
                        stops={ramps.eye}
                        value={look.rightEye}
                        onChange={(rightEye) => setLook({ rightEye })}
                    />
                </>
            )}
            <ColorSlider
                label="Outfit"
                stops={ramps.outfit}
                value={look.outfit}
                onChange={(outfit) => setLook({ outfit })}
            />
            <Button
                pressed={matched}
                onPress={() => {
                    if (!matched) setLook({ rightEye: look.leftEye });
                    setMatched(!matched);
                }}
                className="h-9 text-sm"
            >
                Same colour for both eyes
            </Button>
            <Row>
                <Button
                    onPress={() => {
                        const next = randomLook();
                        setLook(next);
                        setMatched(next.leftEye === next.rightEye);
                    }}
                    className="h-10 text-sm"
                >
                    Random
                </Button>
                <Button
                    onPress={() => {
                        finishCreation();
                        onDone();
                    }}
                    className="h-10 text-sm"
                >
                    Done
                </Button>
            </Row>
            <Text size="xs" className="opacity-70">
                Right-drag, or drag two fingers, to turn round her.
            </Text>
        </Panel>
    );
}
