import { useEffect, useState } from "react";
import {
    RoundScreen,
    RoundState,
    Sound,
    Text,
    useRound,
    useSaveStore,
} from "@spawnite/engine";
import crash from "@game/assets/sounds/sled/crash.mp3?url";
import finish from "@game/assets/sounds/sled/finish.mp3?url";
import { RunEnd } from "../ride/course";

const lostTitles: Record<string, string> = {
    [RunEnd.Crashed]: "Out of steam",
    [RunEnd.Wiped]: "Wiped out",
};

/** The run's end: its sound, the round screen titled for how it ended,
 *  and the coins banked into the save. Any end banks them: a crash keeps
 *  the loot. */
export function RunScreen() {
    const { state, reason, score } = useRound();
    const store = useSaveStore();
    //  Read once a run: a retry mounts the scene, and this, anew.
    const [banked] = useState(() => store.getState().save?.wallet?.coins ?? 0);
    const ended = state === RoundState.Won || state === RoundState.Lost;
    const total = banked + score;

    useEffect(() => {
        if (!ended) return;
        const { save, writeSave } = store.getState();
        writeSave({ ...save, wallet: { coins: total } });
    }, [ended, total, store]);

    return (
        <>
            {state === RoundState.Won && <Sound url={finish} />}
            {state === RoundState.Lost && <Sound url={crash} />}
            <RoundScreen
                wonTitle="Finish!"
                wonText={`${score} coins this run.`}
                lostTitle={lostTitles[reason]}
                lostText={`${score} coins this run, kept.`}
            >
                <Text>{`${total} coins banked`}</Text>
            </RoundScreen>
        </>
    );
}
