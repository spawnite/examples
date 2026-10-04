import { useEffect } from "react";
import { Sound, VolumeChannel } from "@spawnite/engine";
import bossTrack from "../assets/boss.mp3?url";
import fieldTrack from "../assets/field.mp3?url";
import { CuesTrait, RunPhase } from "../rules/traits";
import { useChoice } from "../store/choice";
import { useRunView } from "../hud/useRunView";
import { useEventRecords } from "../views/useEventRecords";
import { playChiptune, playDeathSong, stopDeathSong } from "./chiptune";

//  The run's music and its sounds: the field's track while the run plays,
//  the boss's once it lands, silent while paused, the death song under the
//  death screen, and each cue the step raised.

export function FieldAudio() {
    const view = useRunView((run) => ({
        phase: run.phase,
        boss: run.bossPhase && run.bossLand === 0,
    }));
    const paused = useChoice((state) => state.paused);
    useEventRecords(
        CuesTrait,
        (entity) => entity.get(CuesTrait)?.list,
        playChiptune,
    );
    const defeated = view?.phase === RunPhase.Defeated;
    useEffect(() => {
        if (!defeated) return;
        playDeathSong();
        return stopDeathSong;
    }, [defeated]);
    const playing =
        view?.phase === RunPhase.Playing || view?.phase === RunPhase.Upgrade;
    if (!playing) return null;
    const track = view.boss ? bossTrack : fieldTrack;
    return (
        <Sound
            key={track}
            url={track}
            loop
            volume={paused ? 0 : view.boss ? 0.26 : 0.2}
            channel={VolumeChannel.Music}
        />
    );
}
