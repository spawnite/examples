import type { World } from "koota";
import type { PlaytestAction } from "@spawnite/devtools";
import type { ScenesState } from "@spawnite/engine";
import { findPlayerHero, InvulnerableTrait } from "@spawnite/engine/core";
import { spawnWaveEnemy } from "../rules/enemies";
import { LookId, WeaponId } from "../rules/data";
import { RunPhase } from "../rules/traits";
import { useChoice } from "../store/choice";
import { playFromLobby } from "../store/flow";
import { StageId } from "../rules/stages";
import { resetUnlocks, unlockStage } from "../store/progress";
import { findRun } from "../views/findRun";

//  The Playtest panel's steps, which its buttons and `spawnite play action`
//  run alike. A step refuses, with why, where its button is disabled.

/** How many enemies a small wave calls. */
const smallWaveEnemyCount = 8;

/** Refuses `name` unless the run stands in `phase`. */
function requirePhase(
    world: World,
    phase: RunPhase,
    name: string,
    when: string,
) {
    const current = findRun(world)?.phase;
    if (current !== phase)
        throw new Error(
            `${name} runs ${when}: the run is ${current ?? "not spawned"}.`,
        );
}

/** Presses the lobby's Play on its last picks, or a tester's where it has
 *  none. */
export function quickStart(world: World, scenes: Pick<ScenesState, "go">) {
    const run = findRun(world);
    if (run)
        throw new Error(
            `Quick start runs in the lobby: the run is ${run.phase}.`,
        );
    const choice = useChoice.getState();
    useChoice.setState({
        nickname: choice.nickname || "Tester",
        look: choice.look ?? LookId.Grove,
        starter: choice.starter ?? WeaponId.Pulse,
    });
    playFromLobby(scenes);
}

export function hasNoDamage(world: World): boolean {
    return findPlayerHero(world)?.has(InvulnerableTrait) ?? false;
}

export function setNoDamage(world: World, on: boolean) {
    const hero = findPlayerHero(world);
    if (!hero)
        throw new Error(
            "No damage needs the soldier, and none is on the field.",
        );
    if (on) hero.add(InvulnerableTrait);
    else hero.remove(InvulnerableTrait);
}

export function setSpawning(world: World, on: boolean) {
    const run = findRun(world);
    if (run) run.spawning = on;
}

export function spawnSmallWave(world: World) {
    requirePhase(
        world,
        RunPhase.Playing,
        "Spawn a small wave",
        "while the run plays",
    );
    for (let enemy = 0; enemy < smallWaveEnemyCount; enemy++)
        spawnWaveEnemy(world);
}

export function queuePrismatic(world: World) {
    const run = findRun(world);
    if (run?.hasTwin)
        throw new Error(
            "Next level: Prismatic has nothing to queue: the Prismatic echo is acquired.",
        );
    if (run?.forcePrismatic)
        throw new Error(
            "Next level: Prismatic is queued already: the next level deals it.",
        );
    if (run) run.forcePrismatic = true;
}

/** Opens every stage in the lobby, as reaching and beating the boss
 *  would. */
export function unlockStages() {
    for (const id of Object.values(StageId)) unlockStage(id);
}

/** The steps by name, for <Devtools playtestActions>. */
export function listPlaytestActions(
    world: World,
    scenes: Pick<ScenesState, "go">,
): PlaytestAction[] {
    return [
        { name: "Quick start", run: () => quickStart(world, scenes) },
        {
            name: "No damage",
            run: () => {
                const on = !hasNoDamage(world);
                setNoDamage(world, on);
                return `No damage ${on ? "on" : "off"}.`;
            },
        },
        {
            name: "Enemy spawning",
            run: () => {
                const on = !(findRun(world)?.spawning ?? false);
                setSpawning(world, on);
                return `Enemy spawning ${on ? "on" : "off"}.`;
            },
        },
        {
            name: "Spawn a small wave",
            run: () => {
                spawnSmallWave(world);
                return `Spawned ${smallWaveEnemyCount} enemies.`;
            },
        },
        {
            name: "Next level: Prismatic",
            run: () => queuePrismatic(world),
        },
        { name: "Unlock stages", run: unlockStages },
        { name: "Reset unlocks", run: resetUnlocks },
    ];
}
