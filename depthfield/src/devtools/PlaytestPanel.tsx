import { useWorld } from "koota/react";
import {
    Button,
    findPlayerHero,
    InvulnerableTrait,
    Slider,
    Text,
    Toggle,
    useScenes,
} from "@spawnite/engine";
import { RunPhase, type RunState } from "../rules/traits";
import { useChoice } from "../store/choice";
import { resetUnlocks } from "../store/progress";
import { findRun } from "../views/findRun";
import { useRunView } from "../hud/useRunView";
import {
    queuePrismatic,
    quickStart,
    setNoDamage,
    setSpawning,
    spawnSmallWave,
    unlockStages,
} from "./playtestActions";

//  The source's playtest controls, in development only: the ground anchors,
//  no damage, the spawning, a wave on demand, the upgrade luck, a Prismatic
//  card on the next level, every stage unlocked, and the unlocks reset. Quick
//  start presses the lobby's Play on its last picks. Its steps are
//  playtestActions', which `spawnite play action` runs by name too. In the
//  lobby, with no run, only the steps that need none are on.

export function PlaytestPanel() {
    const world = useWorld();
    const { go } = useScenes();
    const anchors = useChoice((state) => state.anchors);
    const view = useRunView((run, runWorld) => ({
        phase: run.phase,
        spawning: run.spawning,
        luck: Math.round(run.luck * 100),
        prismatic: run.forcePrismatic,
        echo: run.hasTwin,
        god: findPlayerHero(runWorld)?.has(InvulnerableTrait) ?? false,
    }));
    const edit = (write: (run: RunState) => void) => {
        const run = findRun(world);
        if (run) write(run);
    };
    return (
        <Text as="div" className="flex flex-col gap-2 text-xs">
            <Button
                className="df-btn"
                disabled={view !== undefined}
                onPress={() => quickStart(world, { go })}
            >
                Quick start
            </Button>
            <Text as="label" className="flex justify-between gap-2">
                Show ground anchors
                <Toggle
                    label="Show ground anchors"
                    value={anchors}
                    onChange={(next) => useChoice.setState({ anchors: next })}
                />
            </Text>
            <Text as="label" className="flex justify-between gap-2">
                No damage
                <Toggle
                    label="No damage"
                    value={view?.god ?? false}
                    disabled={!view}
                    onChange={(next) => setNoDamage(world, next)}
                />
            </Text>
            <Text as="label" className="flex justify-between gap-2">
                Enemy spawning
                <Toggle
                    label="Enemy spawning"
                    value={view?.spawning ?? false}
                    disabled={!view}
                    onChange={(next) => setSpawning(world, next)}
                />
            </Text>
            <Button
                className="df-btn"
                disabled={view?.phase !== RunPhase.Playing}
                onPress={() => spawnSmallWave(world)}
            >
                Spawn a small wave
            </Button>
            <Text as="label" className="flex flex-col gap-1">
                Upgrade luck {view?.luck ? `${view.luck}%` : "Off"}
                <Slider
                    label="Upgrade luck"
                    min={0}
                    max={100}
                    value={view?.luck ?? 0}
                    disabled={!view}
                    onChange={(luck) => edit((run) => (run.luck = luck / 100))}
                />
            </Text>
            <Button
                className="df-btn"
                disabled={!view || view.echo || view.prismatic}
                onPress={() => queuePrismatic(world)}
            >
                {view?.echo
                    ? "Prismatic echo acquired"
                    : view?.prismatic
                      ? "Prismatic queued for next level"
                      : "Next level: Prismatic"}
            </Button>
            <Button className="df-btn" onPress={unlockStages}>
                Unlock stages
            </Button>
            <Button className="df-btn" onPress={resetUnlocks}>
                Reset unlocks
            </Button>
        </Text>
    );
}
