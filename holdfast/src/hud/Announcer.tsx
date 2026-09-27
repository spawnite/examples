import type { Entity } from "koota";
import { useQuery, useQueryFirst, useTrait } from "koota/react";
import { useEffect, useRef } from "react";
import {
    createStore,
    Hud,
    isPlayerHero,
    Panel,
    PanelVariant,
    PlayerName,
    Slot,
    Text,
} from "@spawnite/engine";
import { playSound, Sound } from "../audio/sounds";
import { SiegePhase, SiegeTrait, WardenTrait } from "../siege/traits";
import { hudDisplay } from "./look";

//  The moments of a run, called out in the middle of the screen for a
//  couple of seconds: a wave rising, a wave held, a teammate falling and
//  getting up.

/** Seconds a call stays up. */
const callSeconds = 2.2;

/** One call: a big line, and a small one under it. */
interface Call {
    id: number;
    title: string;
    line: string;
    /** Red for bad news. */
    alarm: boolean;
}

interface CallsState {
    calls: Call[];
    nextId: number;
}

/** The calls on screen: the last two at most. */
const useCalls = createStore<CallsState>()(() => ({ calls: [], nextId: 0 }));

/** Puts `call` up, and takes it down once its seconds are over. */
function announce(call: Omit<Call, "id">) {
    const id = useCalls.getState().nextId;
    useCalls.setState(({ calls }) => ({
        calls: [...calls.slice(-1), { ...call, id }],
        nextId: id + 1,
    }));
    setTimeout(
        () =>
            useCalls.setState(({ calls }) => ({
                calls: calls.filter((kept) => kept.id !== id),
            })),
        callSeconds * 1000,
    );
}

interface WardenWatchProps {
    entity: Entity;
}

/** Calls out another warden going down and getting up. */
function WardenWatch({ entity }: WardenWatchProps) {
    const survivor = useTrait(entity, WardenTrait);
    const player = useTrait(entity, PlayerName);
    const down = survivor?.down ?? false;
    const wasDownRef = useRef(down);
    useEffect(() => {
        const was = wasDownRef.current;
        wasDownRef.current = down;
        if (was === down || isPlayerHero(entity)) return;
        const name = player?.name ?? "A warden";
        announce(
            down
                ? {
                      title: `${name} is down`,
                      line: "Stand by them to get them up",
                      alarm: true,
                  }
                : { title: `${name} is back up`, line: "", alarm: false },
        );
    }, [down, entity, player]);
    return null;
}

export function Announcer() {
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const wardens = useQuery(WardenTrait);
    const calls = useCalls((state) => state.calls);

    //  A wave rising and a wave held, as the phase turns.
    const phase = siege?.phase;
    const wave = siege?.wave ?? 0;
    const lastRef = useRef({ phase, wave });
    useEffect(() => {
        const last = lastRef.current;
        lastRef.current = { phase, wave };
        if (last.phase === phase) return;
        if (phase === SiegePhase.Fight) {
            announce({
                title: `Wave ${wave}`,
                line: "The Hollow rises",
                alarm: true,
            });
            playSound(Sound.WaveStart);
        } else if (phase === SiegePhase.Breather && wave > 0) {
            announce({
                title: `Wave ${wave} held`,
                line: "The fallen rise. Take a card",
                alarm: false,
            });
            playSound(Sound.WaveHeld);
        } else if (phase === SiegePhase.Over) playSound(Sound.RunOver);
    }, [phase, wave]);

    return (
        <>
            {wardens.map((entity) => (
                <WardenWatch key={entity} entity={entity} />
            ))}
            {calls.length > 0 && (
                <Hud>
                    {/*  Lifted above the screen's middle, so the call never
                        covers the aim. */}
                    <Panel
                        slot={Slot.Center}
                        variant={PanelVariant.Bare}
                        className="mb-[30vh] gap-4"
                    >
                        {calls.map((call) => (
                            <Text
                                as="div"
                                key={call.id}
                                className="flex flex-col items-center gap-1.5"
                            >
                                <Text
                                    className={
                                        call.alarm
                                            ? `${hudDisplay} animate-hud-slam text-7xl whitespace-nowrap text-red-400 uppercase [text-shadow:0_2px_0_rgb(60_0_0),0_0_24px_rgb(255_60_60/0.55)]`
                                            : `${hudDisplay} animate-hud-slam text-7xl whitespace-nowrap text-amber-200 uppercase [text-shadow:0_2px_0_rgb(70_35_0),0_0_24px_rgb(255_177_59/0.55)]`
                                    }
                                >
                                    {call.title}
                                </Text>
                                <Text
                                    as="div"
                                    className={
                                        call.alarm
                                            ? "h-0.5 w-72 animate-hud-sweep bg-linear-to-r from-transparent via-red-400 to-transparent"
                                            : "h-0.5 w-72 animate-hud-sweep bg-linear-to-r from-transparent via-amber-300 to-transparent"
                                    }
                                >
                                    {null}
                                </Text>
                                {call.line && (
                                    <Text className="animate-hud-rise text-base font-semibold tracking-wide text-white/90 uppercase [animation-delay:200ms]">
                                        {call.line}
                                    </Text>
                                )}
                            </Text>
                        ))}
                    </Panel>
                </Hud>
            )}
        </>
    );
}
