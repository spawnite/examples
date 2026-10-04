import { useWorld } from "koota/react";
import {
    Button,
    ButtonVariant,
    Heading,
    Modal,
    Text,
    useScenes,
} from "@spawnite/engine";
import { dialogLook, paneLook, primaryLook } from "./classes";
import { findClass, weaponIds } from "../rules/data";
import { readHeroHealth } from "../rules/hero";
import { useChoice } from "../store/choice";
import { keepGoing, leaveRun } from "../store/flow";
import { Board } from "./Board";
import { readWidthClass } from "./fills";
import { useRunView } from "./useRunView";

//  The boss is down: the run's numbers, its damage by weapon, and the
//  board, and the choice to keep going, endless. An endless run that ends
//  shows it again, with no way on.

interface StatProps {
    label: string;
    value: string | number;
}

function Stat({ label, value }: StatProps) {
    return (
        <Text as="div">
            {label}
            <Text as="b">{value}</Text>
        </Text>
    );
}

export function VictoryScreen() {
    const world = useWorld();
    const scenes = useScenes();
    const view = useRunView((run, runWorld) => {
        const health = readHeroHealth(runWorld);
        return {
            clock: `${Math.floor(run.time / 60)}m ${Math.floor(run.time % 60)}s`,
            kills: run.kills,
            level: run.level,
            className: findClass(run.classId).name,
            damage: Math.round(run.damageDealt),
            health: `${Math.ceil(health.current)} / ${health.maximum}`,
            nickname: run.nickname,
            endless: run.endless,
            rows: weaponIds
                .filter((id) => run.weapons[id].owned || run.weaponDamage[id])
                .map((id) => ({
                    name: run.weapons[id].name,
                    damage: Math.round(run.weaponDamage[id] ?? 0),
                })),
        };
    });
    const board = useChoice((state) => state.board);
    if (!view) return null;
    const most = Math.max(1, ...view.rows.map((row) => row.damage));
    return (
        <Modal
            className={paneLook}
            dialogClassName={dialogLook}
            open={!board}
            pause
            title="Run completed"
            overline="RUN COMPLETED"
            actions={
                <>
                    {!view.endless && (
                        <Button
                            className={`${primaryLook} flex-1`}
                            variant={ButtonVariant.Accent}
                            onPress={() => keepGoing(world)}
                        >
                            Keep going
                        </Button>
                    )}
                    <Button
                        className={`${primaryLook} flex-1`}
                        variant={
                            view.endless ? ButtonVariant.Accent : undefined
                        }
                        onPress={() =>
                            leaveRun(
                                world,
                                scenes,
                                useChoice.getState().lastResult,
                            )
                        }
                    >
                        Main menu
                    </Button>
                </>
            }
        >
            <Text as="div" className="df-pane df-text df-victory">
                <Text as="div" className="df-statgrid">
                    <Stat label="Time" value={view.clock} />
                    <Stat label="Defeated" value={view.kills} />
                    <Stat label="Level" value={view.level} />
                    <Stat label="Class" value={view.className} />
                    <Stat label="Total damage" value={view.damage} />
                    <Stat label="Health left" value={view.health} />
                </Text>
                <Heading level={3} className="df-subhead">
                    Damage by weapon
                </Heading>
                <Text as="div" className="df-bars">
                    {view.rows.length === 0 && (
                        <Text as="p">No weapon damage recorded.</Text>
                    )}
                    {view.rows.map((row) => (
                        <Text key={row.name} as="div" className="df-barline">
                            <Text>{row.name}</Text>
                            <Text
                                as="i"
                                className={readWidthClass(
                                    Math.max(0.02, row.damage / most),
                                )}
                            >
                                {null}
                            </Text>
                            <Text as="b">{row.damage}</Text>
                        </Text>
                    ))}
                </Text>
                <Heading level={3} className="df-subhead">
                    Leaderboard
                </Heading>
                <Board you={view.nickname} />
            </Text>
        </Modal>
    );
}
