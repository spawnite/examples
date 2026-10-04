import type { World } from "koota";
import { useHas, useQueryFirst, useTrait, useWorld } from "koota/react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
    AuthorityTrait,
    Button,
    ButtonVariant,
    DisconnectedTrait,
    HeroTrait,
    Hud,
    listenToAction,
    Panel,
    PanelVariant,
    PlayerNameTrait,
    RoomStatus,
    Slot,
    Text,
    useMenu,
    useRoom,
} from "@spawnite/engine";
import { siegePlugin } from "../siege/siege.plugin";
import { isReadyAsked } from "../siege/gathering";
import { SiegeTrait, WardenTrait } from "../siege/traits";
import { nightWaves } from "../siege/waves";
import { sendSignal } from "../weapons/signal";
import { useCoarsePointer } from "./coarse";
import { useElementPickShown } from "./hand";
import { useInReadyRing } from "./inRing";
import { hudBody, hudDisplay, hudKey, hudLabel, hudPane } from "./look";
import { ReadinessMachine } from "../siege/life";
import { usePhase } from "../views/phase";

//  The wait for the next run, before the first, after each end, and at
//  dawn for Endless, at the top of the screen: what to do to be ready, whom
//  the run waits for, the countdown once everyone is ready, and the start
//  without whoever never comes. The scoreboard lists who is in the room and
//  who is ready. R readies her there and in a breather alike.

/** The names of the wardens the run waits for: those whose player is
 *  connected and who are not ready. */
function readWaitedFor(world: World) {
    const names: string[] = [];
    for (const entity of world.query(PlayerNameTrait, WardenTrait)) {
        if (
            entity.has(DisconnectedTrait) ||
            entity.has(ReadinessMachine.is.ready)
        )
            continue;
        names.push(entity.get(PlayerNameTrait)?.name ?? "a warden");
    }
    return names;
}

/** The names the run waits for, read again as any warden readies, joins,
 *  leaves, or drops. One line each, so the same names compare equal. */
function useWaitedFor(world: World) {
    const subscribe = useCallback(
        (notify: () => void) => {
            const removals = [
                world.onAdd(ReadinessMachine.is.ready, notify),
                world.onRemove(ReadinessMachine.is.ready, notify),
                world.onAdd(WardenTrait, notify),
                world.onRemove(WardenTrait, notify),
                world.onAdd(DisconnectedTrait, notify),
                world.onRemove(DisconnectedTrait, notify),
            ];
            return () => {
                for (const remove of removals) remove();
            };
        },
        [world],
    );
    const lines = useSyncExternalStore(subscribe, () =>
        readWaitedFor(world).join("\n"),
    );
    return lines === "" ? [] : lines.split("\n");
}

/** "Ada", "Ada and Bo", "Ada, Bo and Cy". */
function listNames(names: string[]) {
    if (names.length <= 1) return names.join("");
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** R readies her, or takes it back, wherever ready means something: while
 *  the wardens gather, at dawn, and in a breather. */
function ReadyKey() {
    const world = useWorld();
    const ready = useHas(
        useQueryFirst(HeroTrait, AuthorityTrait),
        ReadinessMachine.is.ready,
    );
    useEffect(
        () =>
            listenToAction(siegePlugin.actions.ready, {
                onPress: () => {
                    if (useMenu.getState().open) return;
                    sendSignal(
                        world,
                        ready
                            ? siegePlugin.messages.unready
                            : siegePlugin.messages.ready,
                        {},
                    );
                },
            }),
        [world, ready],
    );
    return null;
}

interface BannerProps {
    secondsLeft: number;
    startWithout: boolean;
    /** Whether the night was won, so the wait is for Endless. */
    dawn: boolean;
}

/** The banner while the wardens gather, and the key it names beside R. */
function GatheringBanner({ secondsLeft, startWithout, dawn }: BannerProps) {
    const world = useWorld();
    const own = useQueryFirst(HeroTrait, AuthorityTrait);
    const ready = useHas(own, ReadinessMachine.is.ready);
    const ringReady = useHas(own, ReadinessMachine.is.ready.ring);
    const waitedFor = useWaitedFor(world);
    const inRing = useInReadyRing();
    //  The way she readied is the way she cancels.
    const cancel = ringReady
        ? "Step out of the ring to cancel"
        : "Press R to cancel";
    const counting = secondsLeft > 0;
    const offered = startWithout && ready && !counting;

    useEffect(
        () =>
            listenToAction(siegePlugin.actions.startWithout, {
                onPress: () => {
                    //  Enter on the open menu plays; it starts nothing here.
                    if (useMenu.getState().open || !offered) return;
                    sendSignal(world, siegePlugin.messages.startWithout, {});
                },
            }),
        [world, offered],
    );

    return (
        <Hud>
            <Panel
                slot={Slot.Top}
                variant={PanelVariant.Bare}
                className={`min-w-72 gap-1.5 px-6 pt-2 pb-3 ${hudPane}`}
            >
                {counting ? (
                    <>
                        <Text className={hudLabel}>
                            {dawn ? "Endless in" : "Starting in"}
                        </Text>
                        <Text
                            key={secondsLeft}
                            className={`${hudDisplay} animate-hud-slam text-5xl text-menu-accent`}
                        >
                            {secondsLeft}
                        </Text>
                        <Text className={hudBody}>{cancel}</Text>
                    </>
                ) : ready ? (
                    <>
                        <Text className={hudLabel}>Waiting for</Text>
                        <Text className={`${hudDisplay} text-2xl`}>
                            {listNames(waitedFor)}
                        </Text>
                        <Text className={hudBody}>You are ready. {cancel}</Text>
                    </>
                ) : (
                    <>
                        <Text className={hudLabel}>
                            {dawn
                                ? "Dawn · Endless"
                                : `Hold the fire until dawn · ${nightWaves} waves`}
                        </Text>
                        <Text className={`${hudDisplay} text-2xl`}>
                            {inRing
                                ? "You are in the ring"
                                : "Step into the green ring by the fire"}
                        </Text>
                        <Text
                            className={`flex items-center gap-1.5 ${hudBody}`}
                        >
                            {inRing
                                ? "Step out and back in, or press"
                                : "or press"}
                            <Text
                                as="span"
                                className={`${hudKey} size-5 text-xs`}
                            >
                                R
                            </Text>
                            {inRing ? "to be ready" : "when you are ready"}
                        </Text>
                    </>
                )}
                {offered && (
                    <Button
                        keyShortcuts="Enter"
                        onPress={() =>
                            sendSignal(
                                world,
                                siegePlugin.messages.startWithout,
                                {},
                            )
                        }
                        variant={ButtonVariant.Accent}
                        className="mt-1 h-9 rounded-lg border px-4 font-display text-base font-bold tracking-widest uppercase font-stretch-condensed"
                    >
                        Start without {listNames(waitedFor)} (Enter)
                    </Button>
                )}
            </Panel>
        </Hud>
    );
}

export function Gathering() {
    const status = useRoom((state) => state.status);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const joined = status === RoomStatus.Joined && siege !== undefined;
    const phase = usePhase();
    const gathering =
        phase === "waiting" || phase === "over" || phase === "dawn";
    //  On a phone her element pick reaches up under the corner: the banner
    //  comes back as she picks, hides the pick or readies, which folds it.
    const coarse = useCoarsePointer();
    const picking = useElementPickShown();
    const yielding = coarse && picking;
    if (!joined) return null;
    return (
        <>
            {isReadyAsked(phase, siege.wave) && <ReadyKey />}
            {gathering && !yielding && (
                <GatheringBanner
                    secondsLeft={siege.secondsLeft}
                    startWithout={siege.startWithout}
                    dawn={phase === "dawn"}
                />
            )}
        </>
    );
}
