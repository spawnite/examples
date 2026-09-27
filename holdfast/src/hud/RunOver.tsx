import type { Entity } from "koota";
import { useQuery, useQueryFirst, useTrait, useWorld } from "koota/react";
import { useEffect } from "react";
import {
    Authority,
    Button,
    CameraTrait,
    Hero,
    Icon,
    leaveFirstPerson,
    Modal,
    PlayerName,
    Text,
    Wallet,
} from "@spawnite/engine";
import { readCard } from "../siege/cards";
import { readyWeapon } from "../siege/signals";
import { SiegePhase, SiegeTrait, WardenTrait } from "../siege/traits";
import { readWardenTextClass } from "../views/palette";
import { sendSignal } from "../weapons/signal";
import { hudDisplay, hudLabel, hudPane, hudTag } from "./look";

interface RunRowProps {
    entity: Entity;
}

/** One warden's run: her name in her colour, her coins, her kills, the
 *  cards she held, and whether she is ready to go again. */
function RunRow({ entity }: RunRowProps) {
    const player = useTrait(entity, PlayerName);
    const wallet = useTrait(entity, Wallet);
    const survivor = useTrait(entity, WardenTrait);
    const hue = survivor?.hue ?? 0;

    return (
        <Text
            as="div"
            className="flex items-center gap-3 rounded-lg bg-white/5 py-2 pr-3 pl-2"
        >
            <Text
                as="div"
                className={`h-9 w-1 shrink-0 rounded-full bg-current ${readWardenTextClass(hue)}`}
            >
                {null}
            </Text>
            <Text as="div" className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Text as="div" className="flex items-center gap-2">
                    <Text
                        className={`${hudDisplay} text-xl uppercase ${readWardenTextClass(hue)}`}
                    >
                        {player?.name ?? ""}
                    </Text>
                    {survivor?.ready && (
                        <Text
                            className={`${hudTag} flex items-center gap-1 bg-emerald-400/20 text-emerald-300`}
                        >
                            <Icon name="check" className="size-3" />
                            Ready
                        </Text>
                    )}
                </Text>
                <Text className="truncate text-xs text-white/60">
                    {survivor && survivor.cards.length > 0
                        ? survivor.cards
                              .map((card) => readCard(card)?.title)
                              .join(", ")
                        : "No cards"}
                </Text>
            </Text>
            <Text
                className={`${hudDisplay} w-14 text-right text-2xl text-amber-200`}
            >
                {wallet?.coins ?? 0}
            </Text>
            <Text className={`${hudDisplay} w-14 text-right text-2xl`}>
                {survivor?.kills ?? 0}
            </Text>
        </Text>
    );
}

/** Turns the camera's lock off while the run is over, so the engine lets
 *  the cursor go and the end screen's button takes a click, and back on
 *  once the next run starts, by Go again or by the lobby's timer: the
 *  engine's menu then shows Play, the one click that captures it. */
export function useRunEndCursor(over: boolean) {
    const world = useWorld();
    useEffect(() => {
        const camera = world.queryFirst(CameraTrait);
        if (!camera) return;
        if (over) {
            leaveFirstPerson(world);
            camera.set(CameraTrait, { locked: false });
        } else camera.set(CameraTrait, { locked: true });
    }, [world, over]);
}

/** The run's end: the wave the wardens reached, the best in this room,
 *  each warden's coins and kills, and the button to go again, which waits
 *  for every warden. */
export function RunOver() {
    const world = useWorld();
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const wardens = useQuery(PlayerName, WardenTrait);
    const own = useTrait(useQueryFirst(Hero, Authority), WardenTrait);
    const over = siege?.phase === SiegePhase.Over;
    useRunEndCursor(over);
    if (!siege || !over) return null;

    const ready = own?.ready === true;

    return (
        <Modal open title="The circle fell">
            {/*  The game stylesheet reads the run-over-pane class to put the
                modal's own pane aside for this one. */}
            <Text
                as="div"
                className={`run-over-pane flex w-[34rem] max-w-[92vw] animate-hud-rise flex-col items-stretch gap-5 px-7 pt-6 pb-7 ${hudPane}`}
            >
                <Text as="div" className="flex flex-col items-center gap-1">
                    <Text
                        className={`${hudDisplay} animate-hud-slam text-5xl text-red-400 uppercase [text-shadow:0_2px_0_rgb(60_0_0),0_0_24px_rgb(255_60_60/0.45)]`}
                    >
                        The circle fell
                    </Text>
                    <Text
                        as="div"
                        className="h-0.5 w-64 animate-hud-sweep bg-linear-to-r from-transparent via-red-400 to-transparent"
                    >
                        {null}
                    </Text>
                </Text>
                <Text
                    as="div"
                    className="flex items-center justify-center gap-8"
                >
                    <Text as="div" className="flex flex-col items-center">
                        <Text className={hudLabel}>Wave reached</Text>
                        <Text
                            className={`${hudDisplay} text-7xl text-amber-200 [text-shadow:0_0_24px_rgb(255_177_59/0.45)]`}
                        >
                            {siege.wave}
                        </Text>
                    </Text>
                    <Text as="div" className="h-16 w-px bg-amber-100/15">
                        {null}
                    </Text>
                    <Text as="div" className="flex flex-col items-center">
                        <Text className={hudLabel}>Best in this room</Text>
                        <Text
                            className={`${hudDisplay} text-5xl text-white/85`}
                        >
                            {siege.best}
                        </Text>
                    </Text>
                </Text>
                <Text className="text-center text-sm font-semibold text-white/80">
                    {siege.wave <= 1
                        ? "The Hollow broke through on the first wave."
                        : `You held ${siege.wave - 1} waves before the circle fell.`}
                </Text>
                <Text as="div" className="flex flex-col gap-1.5">
                    <Text
                        as="div"
                        className="flex items-center gap-3 pr-3 pl-5"
                    >
                        <Text className={`${hudLabel} flex-1`}>Warden</Text>
                        <Text className={`${hudLabel} w-14 text-right`}>
                            Coins
                        </Text>
                        <Text className={`${hudLabel} w-14 text-right`}>
                            Kills
                        </Text>
                    </Text>
                    {wardens.map((entity) => (
                        <RunRow key={entity} entity={entity} />
                    ))}
                </Text>
                <Button
                    pressed={ready}
                    onPress={() => sendSignal(world, readyWeapon)}
                    className={
                        ready
                            ? "h-12 w-full rounded-lg border border-menu-edge bg-menu-raised bg-none text-base font-semibold text-white/70 inset-shadow-none"
                            : "h-12 w-full rounded-lg border border-transparent bg-menu-accent bg-none font-display text-xl font-bold tracking-widest text-menu-accent-ink uppercase inset-shadow-none font-stretch-condensed hover:brightness-110"
                    }
                >
                    {ready ? "Waiting for the others" : "Go again"}
                </Button>
            </Text>
        </Modal>
    );
}
