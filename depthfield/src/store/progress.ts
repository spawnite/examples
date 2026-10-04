import { createStore, persist } from "@spawnite/engine";
import { z } from "@spawnite/schema";
import { LookId, prismaticKills, WeaponId, zapRuns } from "../rules/data";
import { StageId } from "../rules/stages";

//  What a player keeps between runs, in the player's save: the kills toward
//  the Prismatic look, the runs toward Zap, the stages opened, the best
//  runs for the board, and the lobby's last picks, so a reload or another
//  device starts on them. A persisted store, since the lobby reads
//  it outside the world. A field added since the first save takes a
//  default, so a save written before it still loads.

/** One finished run on the board. */
const boardRowSchema = z.object({
    nickname: z.string(),
    className: z.string(),
    level: z.int().check(z.nonnegative()),
    seconds: z.int().check(z.nonnegative()),
    damage: z.int().check(z.nonnegative()),
    kills: z.int().check(z.nonnegative()),
    won: z.boolean(),
    //  A row from before the stages was played on the one field there was.
    stage: z._default(z.enum(StageId), StageId.Grid),
});

export type BoardRow = z.infer<typeof boardRowSchema>;

/** The lobby's picks: the nickname, the look, the starting weapon and the
 *  stage. */
const picksSchema = z.object({
    nickname: z.string(),
    look: z.nullable(z.enum(LookId)),
    starter: z.nullable(z.enum(WeaponId)),
    stage: z._default(z.enum(StageId), StageId.Grid),
});

export type Picks = z.infer<typeof picksSchema>;

const progressSchema = z.object({
    careerKills: z.int().check(z.nonnegative()),
    runsFinished: z.int().check(z.nonnegative()),
    board: z.array(boardRowSchema),
    /** The stages a run opened; the Neon Grid is open from the start. */
    unlockedStages: z._default(z.array(z.enum(StageId)), []),
    //  None until the player first picks in the lobby.
    picks: z.optional(picksSchema),
});

export type Progress = z.infer<typeof progressSchema>;

/** How many runs the board keeps, best first. */
const boardLength = 10;

/** The board's order: won runs first, the longest of them first, since an
 *  endless run outlasts the boss; then the most damage. */
function rankRuns(first: BoardRow, second: BoardRow) {
    return (
        Number(second.won) - Number(first.won) ||
        (first.won ? second.seconds - first.seconds : 0) ||
        second.damage - first.damage
    );
}

const emptyProgress: Progress = {
    careerKills: 0,
    runsFinished: 0,
    board: [],
    unlockedStages: [],
};

/** A stored state as the schema reads it; throws what it refuses, which
 *  refuses the save. */
function readStoredProgress(stored: unknown): Progress {
    const read = progressSchema.safeParse(stored);
    if (read.success) return read.data;
    const [issue] = read.error.issues;
    const path = issue.path.map(String).join(".");
    throw new Error(`${path ? `at ${path}, ` : ""}${issue.message}`);
}

/** The progress, kept in the player's save under the store "progress". The
 *  schema reads every stored state: one it refuses refuses the save, which
 *  stays as it was. A new field takes a default; a change to a field the
 *  save already holds raises `version` and adds a `migrate` step from the
 *  version before. */
export const useProgress = createStore<Progress>()(
    persist(() => emptyProgress, {
        name: "progress",
        version: 1,
        //  Nothing stored is a new player's.
        merge: (stored, current) =>
            stored === undefined
                ? current
                : { ...current, ...readStoredProgress(stored) },
    }),
);

export function readProgress(): Progress {
    return useProgress.getState();
}

function writeProgress(progress: Progress) {
    useProgress.setState(progress, true);
}

const noPicks: Picks = {
    nickname: "",
    look: null,
    starter: null,
    stage: StageId.Grid,
};

export function readPicks(): Picks {
    return readProgress().picks ?? noPicks;
}

/** Keeps the lobby's picks, when they changed. */
export function writePicks(picks: Picks) {
    const kept = readPicks();
    if (
        kept.nickname === picks.nickname &&
        kept.look === picks.look &&
        kept.starter === picks.starter &&
        kept.stage === picks.stage
    )
        return;
    writeProgress({ ...readProgress(), picks });
}

export function isPrismaticUnlocked(progress = readProgress()) {
    return progress.careerKills >= prismaticKills;
}

export function isZapUnlocked(progress = readProgress()) {
    return progress.runsFinished >= zapRuns;
}

export function isStageUnlocked(id: StageId, progress = readProgress()) {
    return id === StageId.Grid || progress.unlockedStages.includes(id);
}

/** Opens a stage; says whether it was locked before. */
export function unlockStage(id: StageId): boolean {
    const progress = readProgress();
    if (isStageUnlocked(id, progress)) return false;
    writeProgress({
        ...progress,
        unlockedStages: [...progress.unlockedStages, id],
    });
    return true;
}

/** What banking a run's kills and counting it finished unlocked. */
export interface Unlocked {
    prismatic: boolean;
    zap: boolean;
}

/** Adds kills to the career count; says whether it crossed the Prismatic
 *  line. */
export function bankKills(kills: number): boolean {
    if (kills <= 0) return false;
    const progress = readProgress();
    const before = isPrismaticUnlocked(progress);
    const next = { ...progress, careerKills: progress.careerKills + kills };
    writeProgress(next);
    return !before && isPrismaticUnlocked(next);
}

/** Counts a run finished, won or lost, and puts it on the board. A run
 *  that kept going after the boss puts its whole length in place of
 *  `replaces`, the row its boss put there, and counts no second run. Says
 *  whether it unlocked Zap. */
export function finishRun(row: BoardRow, replaces?: BoardRow): boolean {
    const progress = readProgress();
    const before = isZapUnlocked(progress);
    const board = [...progress.board.filter((kept) => kept !== replaces), row]
        .sort(rankRuns)
        .slice(0, boardLength);
    const next = {
        ...progress,
        runsFinished: progress.runsFinished + (replaces ? 0 : 1),
        board,
    };
    writeProgress(next);
    return !before && isZapUnlocked(next);
}

/** Locks the Prismatic look, Zap and the later stages again; the board
 *  stays. */
export function resetUnlocks() {
    writeProgress({
        ...readProgress(),
        careerKills: 0,
        runsFinished: 0,
        unlockedStages: [],
    });
}
