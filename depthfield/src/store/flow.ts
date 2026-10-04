import type { World } from "koota";
import type { ScenesState } from "@spawnite/engine";
import { findClass, prismaticKills, rollClass } from "../rules/data";
import { beginEndless } from "../rules/run";
import type { RunState } from "../rules/traits";
import { findRun } from "../views/findRun";
import { useChoice } from "./choice";
import {
    bankKills,
    finishRun,
    isZapUnlocked,
    readProgress,
    type BoardRow,
} from "./progress";

//  The page's moves between runs: play from the lobby, restart at once on
//  the same picks, leave for the lobby, the end of a run, which counts its
//  kills and puts it on the board, and keeping going after the boss. A run
//  starts as the field mounts, on the run these leave pending.

/** The scene the lobby is, where a run is picked and left for. */
export const lobbyScene = "lobby";
/** The scene the run plays on. */
export const fieldScene = "field";

/** A class for the next run, as the lobby rolls one. */
export function rollNextClass() {
    useChoice.setState({ classId: rollClass(Math.random()).id });
}

/** The kills of each run already counted toward the Prismatic look. */
const banked = new WeakMap<RunState, number>();

/** Counts the run's kills not yet counted; says whether that unlocked
 *  Prismatic. */
function bankRun(run: RunState | undefined) {
    if (!run) return false;
    const kills = run.kills - (banked.get(run) ?? 0);
    banked.set(run, run.kills);
    return bankKills(kills);
}

/** The runs that ended, and the row each put on the board, which the same
 *  run's endless end replaces. */
const ended = new WeakSet<RunState>();
const rows = new WeakMap<RunState, BoardRow>();

/** The name a run takes when the player typed none. */
export const defaultNickname = "Runner";

/** Leaves the run the picks make pending, for the field to start as it
 *  mounts; none while a look or a weapon is unpicked. */
function holdPickedRun() {
    const { nickname, look, starter, classId, stage } = useChoice.getState();
    if (!look || !starter) return;
    useChoice.setState({
        pending: {
            nickname: nickname || defaultNickname,
            look,
            starter,
            classId,
            stage,
            zapUnlocked: isZapUnlocked(),
        },
    });
}

/** Plays a run on the lobby's picks: the field starts it as it mounts. */
export function playFromLobby(scenes: Pick<ScenesState, "go">) {
    holdPickedRun();
    useChoice.setState({ board: false });
    scenes.go(fieldScene);
}

/** Starts a new run at once on the same picks and a new class. */
export function restartRun(world: World, scenes: Pick<ScenesState, "reload">) {
    //  Past the boss the run is won, as leaving it is.
    if (findRun(world)?.endless) endRun(world, true);
    bankRun(findRun(world));
    rollNextClass();
    holdPickedRun();
    useChoice.setState({ paused: false, notes: false });
    scenes.reload();
}

/** Leaves the run for the lobby, on the same picks. */
export function leaveRun(
    world: World,
    scenes: ScenesState,
    lastResult: string,
) {
    //  Past the boss the run is won: leaving puts its whole length on the
    //  board, and the lobby's line about it, as a fall would.
    const endless = findRun(world)?.endless;
    if (endless) endRun(world, true);
    bankRun(findRun(world));
    rollNextClass();
    useChoice.setState({
        lastResult: endless ? useChoice.getState().lastResult : lastResult,
        pending: null,
        paused: false,
        notes: false,
        board: false,
    });
    scenes.go(lobbyScene);
}

/** The line the lobby shows after a run. */
function describeRun(run: RunState, won: boolean, unlocks: string) {
    const clock = `${Math.floor(run.time / 60)}m ${Math.floor(run.time % 60)}s`;
    const opening = won ? "Boss down." : "Run over.";
    return `${opening} ${clock} · ${run.kills} defeated · level ${run.level}.${unlocks}`;
}

/** Ends the run once: counts its kills and the run, puts it on the board,
 *  and writes the lobby's line. */
export function endRun(world: World, won: boolean) {
    const run = findRun(world);
    if (!run || ended.has(run)) return;
    ended.add(run);
    const prismatic = bankRun(run);
    const row = {
        nickname: run.nickname || "Runner",
        className: findClass(run.classId).name,
        level: run.level,
        seconds: Math.floor(run.time),
        damage: Math.round(run.damageDealt),
        kills: run.kills,
        won,
        stage: run.stage,
    };
    const zap = finishRun(row, rows.get(run));
    rows.set(run, row);
    const kills = readProgress().careerKills;
    const skin = prismatic
        ? " Prismatic skin unlocked."
        : kills < prismaticKills
          ? ` Prismatic ${Math.min(prismaticKills, kills)}/${prismaticKills}.`
          : "";
    useChoice.setState({
        lastResult: describeRun(
            run,
            won,
            `${skin}${zap ? " Zap unlocked." : ""}`,
        ),
    });
}

/** Keeps going after the boss: the run plays on, endless, and ends again
 *  when the hero falls, its whole length in place of its row. */
export function keepGoing(world: World) {
    const run = findRun(world);
    if (run) ended.delete(run);
    beginEndless(world);
}
