import type { CSSProperties } from "react";
import { Button, Icon, Text } from "@spawnite/engine";
import { HazardKind, stages } from "../rules/stages";
import { useChoice } from "../store/choice";
import { isStageUnlocked, useProgress } from "../store/progress";

//  The three stages as cards in their own colours: the name, what the
//  floor does, and for a locked one, what opens it.

const hazardLines: Record<HazardKind, string> = {
    [HazardKind.None]: "Open floor, no hazard",
    [HazardKind.Vents]: "Floor vents erupt in turn",
    [HazardKind.Beam]: "A beam sweeps wall to wall",
};

export function StagePicker() {
    const picked = useChoice((choice) => choice.stage);
    const progress = useProgress();
    return (
        <Text as="div" className="df-stagelist" aria-label="Stage">
            {stages.map((stage) => {
                const locked = !isStageUnlocked(stage.id, progress);
                const { palette } = stage;
                //  The stage's own colours, for its card's band. Cast,
                //  because React's style type names no custom property.
                const colours = {
                    "--df-card-sky": palette.skyTop,
                    "--df-card-floor": palette.floor,
                    "--df-card-line": palette.grid.alongMajor,
                    "--df-card-cross": palette.grid.acrossMajor,
                } as CSSProperties;
                return (
                    <Button
                        key={stage.id}
                        label={
                            locked && stage.unlock
                                ? `${stage.name}, locked: ${stage.unlock.label}`
                                : stage.name
                        }
                        disabled={locked}
                        className={`df-stagecard ${picked === stage.id ? "df-picked" : ""}`}
                        style={colours}
                        onPress={() => useChoice.setState({ stage: stage.id })}
                    >
                        <Text as="i" className="df-stageband">
                            {locked && <Icon name="lock" className="size-4" />}
                        </Text>
                        <Text as="span" className="df-stagetext">
                            <Text as="b">{stage.name}</Text>
                            <Text as="small">
                                {locked && stage.unlock
                                    ? `Locked: ${stage.unlock.label}`
                                    : hazardLines[stage.hazard.kind]}
                            </Text>
                        </Text>
                    </Button>
                );
            })}
        </Text>
    );
}
