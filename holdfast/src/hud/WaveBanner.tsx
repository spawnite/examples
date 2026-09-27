import { useQuery, useQueryFirst, useTrait } from "koota/react";
import {
    Bar,
    Hud,
    Panel,
    PanelVariant,
    RoomStatus,
    Slot,
    Text,
    useRoom,
} from "@spawnite/engine";
import {
    MonsterTrait,
    SiegePhase,
    SiegeTrait,
    WardenTrait,
} from "../siege/traits";
import { planWave } from "../siege/waves";
import { hudDisplay, hudLabel, hudPane } from "./look";

/** What the room's connection says while it has not taken her in. */
const statusLines: Record<Exclude<RoomStatus, RoomStatus.Joined>, string> = {
    [RoomStatus.Connecting]: "Connecting to the room",
    [RoomStatus.Reconnecting]: "The room went away. Rejoining it",
    [RoomStatus.Closed]: "No room. Start it and reload the page",
};

/** The banner's parts: a small label over a big title, and a line under. */
interface Headline {
    label: string;
    title: string;
    line?: string;
}

/** The run's headline at the top of the screen: the wave and how much of
 *  it is left, or the countdown to the next, or who the run waits for. */
export function WaveBanner() {
    const status = useRoom((state) => state.status);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const standing = useQuery(MonsterTrait).length;
    const wardens = useQuery(WardenTrait).length;
    const seconds = Math.ceil(siege?.secondsLeft ?? 0);
    const left = standing + (siege?.toSpawn ?? 0);

    let headline: Headline;
    if (status !== RoomStatus.Joined)
        headline = { label: "Holdfast", title: statusLines[status] };
    else if (!siege || siege.phase === SiegePhase.Waiting)
        headline =
            siege && siege.secondsLeft > 0
                ? {
                      label: "Waiting for the other wardens",
                      title: `${seconds}`,
                  }
                : { label: "Holdfast", title: "Press Play to take your place" };
    else if (siege.phase === SiegePhase.Over) return null;
    else if (siege.phase === SiegePhase.Fight)
        headline = { label: "Wave", title: `${siege.wave}` };
    else if (siege.wave === 0)
        headline = {
            label: "The Hollow wakes in",
            title: `${seconds}`,
            line: "Hold the circle together",
        };
    else
        headline = {
            label: `Wave ${siege.wave + 1} in`,
            title: `${seconds}`,
            line: "Rest by the fire, and take a card",
        };

    const fighting = siege?.phase === SiegePhase.Fight;
    //  A number is the big read; a sentence steps down a size.
    const numeric = /^\d+$/.test(headline.title);

    return (
        <Hud>
            <Panel
                slot={Slot.Top}
                variant={PanelVariant.Bare}
                className={`min-w-44 gap-1 px-6 pt-2 pb-3 ${hudPane}`}
            >
                <Text className={hudLabel}>{headline.label}</Text>
                <Text
                    //  Keyed by the title, so a new wave or each second of a
                    //  countdown lands with the entrance.
                    key={headline.title}
                    className={
                        numeric
                            ? `${hudDisplay} animate-hud-slam text-5xl ${fighting ? "text-red-300" : "text-amber-200"}`
                            : `${hudDisplay} animate-hud-rise text-2xl`
                    }
                >
                    {headline.title}
                </Text>
                {fighting && (
                    <Text
                        as="div"
                        className="flex w-56 flex-col items-center gap-1"
                    >
                        <Text
                            as="div"
                            className="[--color-health-fill:#f87171] w-full"
                        >
                            <Bar
                                label="The wave left"
                                value={left}
                                maximum={Math.max(
                                    planWave(siege.wave, wardens).count,
                                    left,
                                    1,
                                )}
                                className="h-2 w-full rounded-sm bg-black/55"
                            />
                        </Text>
                        <Text className="text-xs font-semibold text-white/80">
                            <Text
                                className={`${hudDisplay} text-sm text-red-200`}
                            >
                                {left}
                            </Text>{" "}
                            of the Hollow left
                        </Text>
                    </Text>
                )}
                {headline.line && (
                    <Text className="text-xs font-semibold text-white/80">
                        {headline.line}
                    </Text>
                )}
            </Panel>
        </Hud>
    );
}
