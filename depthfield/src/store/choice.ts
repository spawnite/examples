import { create } from "zustand";
import { ClassId, LookId, WeaponId } from "../rules/data";
import type { RunStart } from "../rules/run";
import type { StageId } from "../rules/stages";
import { readPicks, useProgress, writePicks } from "./progress";

//  What the page keeps across its scenes: the lobby's picks for the next
//  run, the line about the last one, the run Play or a restart leaves for
//  the field to start as it mounts, and which of the page's own panels are
//  open. The picks
//  also go into the game's save, so the next page starts on them.

/** The most characters a nickname keeps. */
export const nicknameLength = 16;

export interface ChoiceState {
    nickname: string;
    look: LookId | null;
    starter: WeaponId | null;
    stage: StageId;
    /** The class the lobby rolled for the next run. */
    classId: ClassId;
    /** The line the lobby shows about the last run. */
    lastResult: string;
    /** Set by Play and by a restart: the field starts this run as it
     *  mounts. */
    pending: RunStart | null;
    /** The pause menu is open, and the world holds still. */
    paused: boolean;
    /** The field notes are open, and the world holds still. */
    notes: boolean;
    /** The board is open over the lobby or an end screen. */
    board: boolean;
    /** Development: each body's ground anchor is drawn. */
    anchors: boolean;
}

export const useChoice = create<ChoiceState>()((): ChoiceState => ({
    ...readPicks(),
    classId: ClassId.Soldier,
    lastResult: "",
    pending: null,
    paused: false,
    notes: false,
    board: false,
    anchors: false,
}));

useChoice.subscribe(({ nickname, look, starter, stage }) =>
    writePicks({ nickname, look, starter, stage }),
);

//  The save loads after this module runs: the lobby opens on its picks.
useProgress.persist.onFinishHydration(() => useChoice.setState(readPicks()));
