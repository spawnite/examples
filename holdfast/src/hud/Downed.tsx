import { Not } from "koota";
import { useHas, useQuery, useQueryFirst, useTrait } from "koota/react";
import { useState } from "react";
import {
    AuthorityTrait,
    Bar,
    DisconnectedTrait,
    HeroTrait,
    Hud,
    Icon,
    Panel,
    PanelVariant,
    Slot,
    Text,
} from "@spawnite/engine";
import { reviveSeconds } from "../siege/downs";
import { EndCause, SiegeTrait, WardenTrait } from "../siege/traits";
import { hudBody, hudDisplay, hudLabel, hudPane, hudNote } from "./look";
import { LifeMachine, LifeTrait } from "../siege/life";
import { usePhase } from "../views/phase";

/** While she is down and the run is on: what gets her up, what a second
 *  fall costs a warden alone, that she still fires at half her rate, and
 *  how far getting up has got, lit while a warden stands over her. Under
 *  the crosshair, which she still aims with. On the run's last fall,
 *  before the end screen, nothing gets her up, so it says why the run ends
 *  instead. */
export function Downed() {
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const survivor = useTrait(hero, WardenTrait);
    const down = useHas(hero, LifeMachine.is.down);
    const revived = useTrait(hero, LifeTrait)?.revived ?? 0;
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = usePhase();
    //  Alone as the room counts it: a dropped teammate leaves her alone. A
    //  query of its own, so a drop or a return renders the panel again.
    const alone = useQuery(WardenTrait, Not(DisconnectedTrait)).length === 1;
    if (!survivor || !down || phase === "over") return null;
    const selfRevive = alone && survivor.selfRevive;
    const cause = siege?.cause ?? EndCause.None;

    return (
        <Hud>
            <Panel
                slot={Slot.Bottom}
                variant={PanelVariant.Bare}
                className={`mb-16 max-w-md animate-hud-rise gap-2 px-7 pt-4 pb-5 ${hudPane} border-danger/40 shadow-[0_0_48px_rgb(220_38_38/0.25)]`}
            >
                <Text
                    as="div"
                    className="flex animate-hud-slam items-center gap-2.5"
                >
                    <Icon
                        name="heart"
                        className="size-7 animate-hud-heartbeat text-danger"
                    />
                    <Text
                        className={`${hudDisplay} text-4xl whitespace-nowrap text-red-400 uppercase [text-shadow:0_2px_0_rgb(60_0_0),0_0_24px_rgb(255_60_60/0.5)]`}
                    >
                        You are down
                    </Text>
                </Text>
                {cause === EndCause.None ? (
                    <GettingUp selfRevive={selfRevive} progress={revived} />
                ) : (
                    <Text className={`text-center ${hudBody}`}>
                        {lastFallLines[cause]}
                    </Text>
                )}
            </Panel>
        </Hud>
    );
}

/** What the last fall says, by why the run ends. */
const lastFallLines: Record<Exclude<EndCause, EndCause.None>, string> = {
    [EndCause.EveryoneDown]: "Every warden is down.",
    [EndCause.FellAlone]: "Your self-revive is spent.",
};

/** Whether `progress` rose at its last change: a warden stands over her
 *  while it climbs, and it drains once none does. */
function useClimbing(progress: number) {
    const [seen, setSeen] = useState({ progress, climbing: false });
    //  Adjusted while rendering, as useHits in Vitals.tsx is, so the label
    //  turns in the frame the bar does.
    if (seen.progress !== progress)
        setSeen({ progress, climbing: progress > seen.progress });
    return seen.climbing;
}

interface GettingUpProps {
    /** Whether she gets herself up, alone. */
    selfRevive: boolean;
    /** Seconds of getting up she has, of `reviveSeconds`. */
    progress: number;
}

/** What gets her up, that she still fires, and how far getting up has
 *  got: lit amber while it climbs, dim while she waits. */
function GettingUp({ selfRevive, progress }: GettingUpProps) {
    const climbing = useClimbing(progress) || selfRevive;
    return (
        <>
            <Text className={`text-center ${hudBody}`}>
                {selfRevive
                    ? "You get yourself up in a few seconds. That is your one self-revive until the next colossus falls: go down again before then and the run ends."
                    : "A warden standing over you gets you up. So does holding the wave."}
            </Text>
            <Text className={`text-center ${hudNote}`}>
                You still fire, at half your rate.
            </Text>
            <Text as="div" className="flex w-72 flex-col gap-1.5 pt-1">
                <Text
                    className={`${hudLabel} transition-colors duration-300 ${climbing ? "text-menu-accent" : "text-white/45"}`}
                >
                    {selfRevive
                        ? "Getting yourself up"
                        : climbing
                          ? "A warden is getting you up"
                          : "Waiting for a warden"}
                </Text>
                <Text
                    as="div"
                    className={`rounded-md transition-shadow duration-300 [--color-health-fill:#fcd34d] ${climbing ? "shadow-[0_0_14px_rgb(252_211_77/0.55)]" : ""}`}
                >
                    <Bar
                        label="Getting up"
                        value={progress}
                        maximum={reviveSeconds}
                        className="h-4 w-full rounded-md bg-black/55 ring-1 ring-white/10"
                    />
                </Text>
            </Text>
        </>
    );
}
