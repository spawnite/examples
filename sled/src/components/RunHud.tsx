import { useQueryFirst, useTrait } from "koota/react";
import { domAnimation, LazyMotion, m } from "motion/react";
import {
    Hud,
    Icon,
    LevelBanner,
    Panel,
    PanelVariant,
    RoundState,
    Slot,
    Text,
    TrackMoverTrait,
    useRound,
    useWallet,
} from "@spawnite/engine";
import { palette } from "@spawnite/ui";
import { springs } from "@spawnite/ui/motion";
import { RunTrait, stallSpeed } from "../ride/course";

/** The coins, the one number read at a glance: each pickup pops it. */
function Coins() {
    const coins = useWallet((state) => state.coins);
    return (
        <Panel slot={Slot.TopRight}>
            <LazyMotion features={domAnimation}>
                {/* A new key each coin mounts it again, so each one pulses. */}
                <m.div
                    key={coins}
                    initial={coins > 0 && { scale: 1.25 }}
                    animate={{ scale: 1 }}
                    transition={springs.snappy}
                    className="flex items-center gap-2"
                >
                    <Icon name="coins" label="Coins" className="size-7" />
                    <Text size="lg" tabular className="min-w-[2ch] text-right">
                        {coins}
                    </Text>
                </m.div>
            </LazyMotion>
        </Panel>
    );
}

/** The rider's speed down the run, in kilometres an hour, small under the
 *  coins; below the speed that stalls the run it turns red and pulses. Its
 *  own component, so the step's writes redraw this line and nothing else. */
function Speed() {
    const rider = useQueryFirst(RunTrait, TrackMoverTrait) ?? null;
    const speed = useTrait(rider, TrackMoverTrait)?.speed ?? 0;
    //  The stall counts only in play: on the sling the rider stands still.
    const playing = useRound().state === RoundState.Playing;
    const stalling = playing && speed < stallSpeed;
    return (
        <Panel slot={Slot.TopRight} variant={PanelVariant.Bare}>
            <Text
                size="xs"
                tabular
                className={
                    stalling
                        ? `min-w-[8ch] text-right ${palette.dangerText} motion-safe:animate-pulse`
                        : "min-w-[8ch] text-right"
                }
            >
                {`${Math.round(speed * 3.6)} km/h`}
            </Text>
        </Panel>
    );
}

/** The run's HUD in three tiers: the coins at a glance, the speed under
 *  them, and the track only on the sling. All of it keeps off the top left
 *  and the top, which the devtools cover in a debug build. */
export function RunHud() {
    return (
        <>
            <Hud>
                <Coins />
                <Speed />
            </Hud>
            <LevelBanner noun="Track" />
        </>
    );
}
