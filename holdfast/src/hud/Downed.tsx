import { useQueryFirst, useTrait } from "koota/react";
import {
    Authority,
    Bar,
    Hero,
    Hud,
    Panel,
    PanelVariant,
    Slot,
    Text,
} from "@spawnite/engine";
import { reviveSeconds } from "../siege/downs";
import { SiegePhase, SiegeTrait, WardenTrait } from "../siege/traits";
import { hudDisplay, hudLabel, hudPane } from "./look";

/** While she is down and the run is on: what gets her up, and how far a
 *  teammate has got. She cannot aim while down, so it takes the middle. */
export function Downed() {
    const survivor = useTrait(useQueryFirst(Hero, Authority), WardenTrait);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    if (!survivor?.down || siege?.phase === SiegePhase.Over) return null;

    return (
        <Hud>
            <Panel
                slot={Slot.Center}
                variant={PanelVariant.Bare}
                className={`max-w-lg gap-3 px-8 pt-5 pb-6 ${hudPane} border-red-400/40`}
            >
                <Text
                    className={`${hudDisplay} animate-hud-slam text-5xl whitespace-nowrap text-red-400 uppercase [text-shadow:0_2px_0_rgb(60_0_0),0_0_24px_rgb(255_60_60/0.5)]`}
                >
                    You are down
                </Text>
                <Text className="text-center text-sm font-semibold text-white/85">
                    A warden standing by you gets you up, and so does holding
                    the wave.
                </Text>
                <Text as="div" className="flex w-72 flex-col gap-1.5 pt-1">
                    <Text className={hudLabel}>Getting up</Text>
                    <Text as="div" className="[--color-health-fill:#fcd34d]">
                        <Bar
                            label="Getting up"
                            value={survivor.reviveSeconds}
                            maximum={reviveSeconds}
                            className="h-4 w-full rounded-md bg-black/55 ring-1 ring-white/10"
                        />
                    </Text>
                </Text>
            </Panel>
        </Hud>
    );
}
