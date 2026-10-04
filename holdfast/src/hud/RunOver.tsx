import type { Entity } from "koota";
import {
    useHas,
    useQuery,
    useQueryFirst,
    useTrait,
    useWorld,
} from "koota/react";
import { useState } from "react";
import {
    AuthorityTrait,
    Button,
    ButtonVariant,
    HeroTrait,
    Icon,
    Modal,
    ModalVariant,
    PlayerNameTrait,
    Text,
    WalletTrait,
} from "@spawnite/engine";
import { readCard } from "../siege/cards";
import { siegePlugin } from "../siege/siege.plugin";
import { EndCause, SiegeTrait, WardenTrait } from "../siege/traits";
import { readWardenTextClass } from "../views/palette";
import { sendSignal } from "../weapons/signal";
import { Awards } from "./Awards";
import { CareerLine } from "./CareerLine";
import { ElementBadges } from "./ElementArt";
import {
    hudBody,
    hudDisplay,
    hudLabel,
    hudPane,
    hudTag,
    hudNote,
} from "./look";
import { ReadinessMachine } from "../siege/life";
import { usePhase } from "../views/phase";

interface RunRowProps {
    entity: Entity;
}

/** One warden's run: her name in her colour, her coins, her kills, the
 *  cards she held besides her element cards, and whether she is ready to
 *  go again. */
export function RunRow({ entity }: RunRowProps) {
    const player = useTrait(entity, PlayerNameTrait);
    const wallet = useTrait(entity, WalletTrait);
    const survivor = useTrait(entity, WardenTrait);
    const ready = useHas(entity, ReadinessMachine.is.ready);
    const hue = survivor?.hue ?? 0;
    //  Her element cards show as her lines' levels on her badges.
    const statCards = (survivor?.cards ?? []).filter(
        (id) => !readCard(id)?.line,
    );

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
                    <ElementBadges entity={entity} levels className="size-4" />
                    {ready && (
                        <Text
                            className={`${hudTag} flex items-center gap-1 bg-emerald-400/20 text-emerald-300`}
                        >
                            <Icon name="check" className="size-3" />
                            Ready
                        </Text>
                    )}
                </Text>
                <Text className="truncate text-xs text-white/60">
                    {statCards.length > 0
                        ? statCards
                              .map((card) => readCard(card)?.title)
                              .join(", ")
                        : "No cards"}
                </Text>
            </Text>
            <Text
                className={`${hudDisplay} w-14 text-right text-2xl text-menu-accent`}
            >
                {wallet?.coins ?? 0}
            </Text>
            <Text className={`${hudDisplay} w-14 text-right text-2xl`}>
                {survivor?.kills ?? 0}
            </Text>
        </Text>
    );
}

/** An end screen's pane: as wide as its rows, and on a screen too short
 *  for it, shrunk to what is left over the buttons and scrolled. */
export const runEndPane =
    "flex min-h-0 w-[34rem] max-w-[92vw] animate-hud-rise flex-col items-stretch overflow-y-auto";

/** A shade over the foot of a pane that scrolls, so a pane cut by a short
 *  screen shows there is more under it; scrolled to its end, the shade
 *  covers only the pane's own gap and padding. */
export function RunEndShade() {
    return (
        <Text
            as="div"
            className="pointer-events-none sticky bottom-0 -mt-3 -mb-7 h-10 shrink-0 bg-linear-to-t from-slate-950 to-transparent"
        >
            {null}
        </Text>
    );
}

interface RunEndActionsProps {
    /** The way on: the next run, or Endless. */
    children: string;
    onBack: () => void;
    onGo: () => void;
}

/** An end screen's two buttons, in the modal's actions row under the pane,
 *  as wide as the pane: back to the circle, and the way on, which says she
 *  is ready as her key does. */
export function RunEndActions({ children, onBack, onGo }: RunEndActionsProps) {
    return (
        <Text as="div" className="flex w-[34rem] max-w-[92vw] gap-2">
            <Button
                onPress={onBack}
                variant={ButtonVariant.Pane}
                className="h-12 flex-1 rounded-lg border"
            >
                Back to the circle
            </Button>
            <Button
                onPress={onGo}
                variant={ButtonVariant.Accent}
                className="h-12 flex-1 rounded-lg border font-display text-xl font-bold tracking-widest uppercase font-stretch-condensed"
            >
                {children}
            </Button>
        </Text>
    );
}

/** Why the circle fell, by the cause the room kept as it ended the run. */
const endLines: Record<EndCause, string> = {
    [EndCause.EveryoneDown]:
        "Every warden was down at once, with nobody standing to get the others up.",
    [EndCause.FellAlone]:
        "You went down again before the next colossus fell, with your one self-revive spent.",
    [EndCause.None]: "",
};

/** The run's end: the wave the wardens reached, the best in this room,
 *  why the circle fell, her level and the XP the run added, each warden's
 *  coins and kills, and the way back to the circle, where the next run
 *  starts from the ring as the first did. Go again says she is ready on
 *  the way, as her key does. */
export function RunOver() {
    const world = useWorld();
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = usePhase();
    const wardens = useQuery(PlayerNameTrait, WardenTrait);
    const ready = useHas(
        useQueryFirst(HeroTrait, AuthorityTrait),
        ReadinessMachine.is.ready,
    );
    const over = phase === "over";
    //  Put aside once she leaves it, until the next run's end.
    const [dismissed, setDismissed] = useState(false);
    const [wasOver, setWasOver] = useState(over);
    if (over !== wasOver) {
        setWasOver(over);
        if (!over) setDismissed(false);
    }
    const showing = over && !dismissed;
    if (!siege || !showing) return null;

    const why = endLines[siege.cause];

    return (
        <Modal
            open
            title="The circle fell"
            variant={ModalVariant.Bare}
            dialogClassName="backdrop:bg-transparent backdrop:bg-[radial-gradient(ellipse_at_center,rgb(20_10_18/55%),rgb(8_4_10/88%))]"
            actions={
                <RunEndActions
                    onBack={() => setDismissed(true)}
                    onGo={() => {
                        if (!ready)
                            sendSignal(world, siegePlugin.messages.ready, {});
                        setDismissed(true);
                    }}
                >
                    Go again
                </RunEndActions>
            }
        >
            <Text
                as="div"
                className={`${runEndPane} gap-5 px-7 pt-6 pb-7 [@media(max-height:480px)]:gap-3 [@media(max-height:480px)]:pt-3 [@media(max-height:480px)]:pb-4 ${hudPane}`}
            >
                <Text as="div" className="flex flex-col items-center gap-1">
                    <Text
                        className={`${hudDisplay} animate-hud-slam text-5xl text-red-400 [@media(max-height:480px)]:text-4xl uppercase [text-shadow:0_2px_0_rgb(60_0_0),0_0_24px_rgb(255_60_60/0.45)]`}
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
                            className={`${hudDisplay} text-7xl [@media(max-height:480px)]:text-5xl text-amber-200 [text-shadow:0_0_24px_rgb(255_177_59/0.45)]`}
                        >
                            {siege.wave}
                        </Text>
                    </Text>
                    <Text
                        as="div"
                        className="h-16 w-px bg-amber-100/15 [@media(max-height:480px)]:h-12"
                    >
                        {null}
                    </Text>
                    <Text as="div" className="flex flex-col items-center">
                        <Text className={hudLabel}>Best in this room</Text>
                        <Text
                            className={`${hudDisplay} text-5xl text-white/85 [@media(max-height:480px)]:text-4xl`}
                        >
                            {siege.best}
                        </Text>
                    </Text>
                </Text>
                <Text as="div" className="flex flex-col items-center gap-1">
                    {why !== "" && (
                        <Text className={`text-center ${hudBody}`}>{why}</Text>
                    )}
                    <Text className={`text-center ${hudNote}`}>
                        {siege.endless
                            ? `You saw the dawn, and held Endless to wave ${siege.wave}.`
                            : siege.wave <= 1
                              ? "The Hollow broke through on the first wave."
                              : `You held ${siege.wave - 1} ${siege.wave === 2 ? "wave" : "waves"} before the circle fell.`}
                    </Text>
                </Text>
                <CareerLine />
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
                <Awards />
                <RunEndShade />
            </Text>
        </Modal>
    );
}
