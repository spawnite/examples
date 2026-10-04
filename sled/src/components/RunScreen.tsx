import { useEffect, useState } from "react";
import { useWorld } from "koota/react";
import {
    RoundState,
    save,
    Sound,
    useLevels,
    useRound,
    useScenes,
} from "@spawnite/engine";
import crash from "@spawnite/assets/sounds/sled/crash.mp3?url";
import finish from "@spawnite/assets/sounds/sled/finish.mp3?url";
import { Track } from "../levels";
import { bankCoins, readBank } from "../bank";
import { RoundResult } from "./RoundResult";

/** The run's end: its sound, the round screen pictured for how it ended,
 *  and the coins banked into the save. Any end banks them: a crash keeps
 *  the loot. Its home button goes back to the lobby. A finish offers the
 *  next track, and level 1 after the last: the win has unlocked it by the
 *  time the screen opens. The world runs on behind it, so the rider slides
 *  to rest under it. */
export function RunScreen() {
    const { state, reason, score, restart } = useRound();
    const { next, play } = useLevels();
    const scenes = useScenes();
    const world = useWorld();
    //  Read once a run: a retry mounts the scene, and this, anew.
    const [banked] = useState(() => readBank(world));
    const won = state === RoundState.Won;
    const ended = won || state === RoundState.Lost;
    const total = banked + score;

    useEffect(() => {
        if (!ended) return;
        bankCoins(world, total);
        //  A run's end is the moment to keep: written within 2 seconds.
        save();
    }, [ended, total, world]);

    return (
        <>
            {won && <Sound url={finish} />}
            {state === RoundState.Lost && <Sound url={crash} />}
            {ended && (
                <RoundResult
                    //  The round keeps the state the run ended in as its
                    //  reason.
                    ending={
                        won
                            ? "finished"
                            : reason === "wiped"
                              ? "wiped"
                              : "crashed"
                    }
                    coins={score}
                    bank={total}
                    onHome={() => scenes.go("lobby")}
                    onRetry={restart}
                    onNext={() => play(next ?? Track.One)}
                />
            )}
        </>
    );
}
