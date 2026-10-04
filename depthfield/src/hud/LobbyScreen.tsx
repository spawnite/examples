import { useEffect, type CSSProperties } from "react";
import {
    Button,
    Heading,
    Hud,
    Icon,
    Text,
    usePlayer,
    useScenes,
} from "@spawnite/engine";
import { enableSound } from "../audio/chiptune";
import { LookId, WeaponId } from "../rules/data";
import { findStage, StageId } from "../rules/stages";
import { nicknameLength, useChoice } from "../store/choice";
import { playFromLobby, rollNextClass } from "../store/flow";
import {
    isPrismaticUnlocked,
    isStageUnlocked,
    isZapUnlocked,
    useProgress,
} from "../store/progress";
import { ClassCard } from "./ClassCard";
import { KeyHelp } from "./KeyHelp";
import { LobbyPicker } from "./LobbyPicker";
import { PlayBar } from "./PlayBar";
import { usePhoneLayout } from "./usePhoneLayout";

//  The lobby's screen over the soldier on its stage: the game's name, the
//  class rolled for the run and the keys at the top left, the board at the
//  top right, and the picks with Play below them on the right, or on a phone
//  in a sheet along the bottom, Play last and always in reach. The whole
//  screen takes the stage's neon as its accent, as the platform does.

export function LobbyScreen() {
    const scenes = useScenes();
    const phone = usePhoneLayout();
    const choice = useChoice();
    //  Read again whenever a run writes the save.
    const progress = useProgress();
    const prismatic = isPrismaticUnlocked(progress);
    const zap = isZapUnlocked(progress);
    const stageLocked = !isStageUnlocked(choice.stage, progress);
    const { name } = usePlayer();
    useEffect(() => {
        rollNextClass();
    }, []);
    //  The run is played under the name the player shows in the app.
    useEffect(() => {
        if (name)
            useChoice.setState({ nickname: name.slice(0, nicknameLength) });
    }, [name]);
    //  One click to a run: a look or a weapon never picked, or locked again
    //  by a reset, falls back to the first, and a locked stage to the
    //  Neon Grid.
    useEffect(() => {
        if (!choice.look || (choice.look === LookId.Prismatic && !prismatic))
            useChoice.setState({ look: LookId.Grove });
        if (!choice.starter || (choice.starter === WeaponId.Zap && !zap))
            useChoice.setState({ starter: WeaponId.Pulse });
        if (stageLocked) useChoice.setState({ stage: StageId.Grid });
    }, [choice.look, choice.starter, prismatic, zap, stageLocked]);
    const { palette } = findStage(choice.stage);
    //  The stage's neon, which every accent of the screen reads. Cast,
    //  because React's style type names no custom property.
    const accent = {
        "--df-accent": palette.ring,
        "--df-accent-deep": palette.grid.acrossMajor,
    } as CSSProperties;
    const play = () => {
        enableSound();
        playFromLobby(scenes);
    };
    return (
        <Hud>
            <Text as="div" className="df-lobby df-text" style={accent}>
                <Text as="header" className="df-lobby-head">
                    <Heading level={1} className="df-wordmark">
                        Depthfield
                    </Heading>
                    <ClassCard />
                    {!phone && (
                        <Text as="div" className="df-lobby-keys">
                            <KeyHelp />
                        </Text>
                    )}
                </Text>
                <Button
                    className="df-btn df-lobby-board"
                    label="Leaderboard"
                    onPress={() => useChoice.setState({ board: true })}
                >
                    <Icon name="trophy" className="size-4" />
                    {!phone && "Leaderboard"}
                </Button>
                <Text as="div" className="df-lobby-side">
                    {choice.lastResult && (
                        <Text as="p" className="df-lastrun">
                            {choice.lastResult}
                        </Text>
                    )}
                    <LobbyPicker />
                    <PlayBar onPlay={play} />
                </Text>
            </Text>
        </Hud>
    );
}
