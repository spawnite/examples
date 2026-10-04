import type { Entity } from "koota";
import { useHas, useQuery, useQueryFirst, useTrait } from "koota/react";
import { useEffect, useState } from "react";
import {
    Counter,
    gameInsetLengths,
    DisconnectedTrait,
    Hud,
    Icon,
    isPlayerHero,
    listenToAction,
    useHeadless,
    useSettings,
    Panel,
    PanelVariant,
    PlayerNameTrait,
    Slot,
    Text,
    useSpeaking,
} from "@spawnite/engine";
import {
    type CardOffer,
    Rarity,
    SiegeTrait,
    WardenTrait,
} from "../siege/traits";
import { VoiceMode } from "@spawnite/schema";
import { isReadyAsked } from "../siege/gathering";
import { LifeMachine, ReadinessMachine } from "../siege/life";
import { usePhase } from "../views/phase";
import { readOfferKey } from "./cardReveal";
import { readWardenTextClass } from "../views/palette";
import { ElementBadges } from "./ElementArt";
import { siegePlugin } from "../siege/siege.plugin";
import { LevelChip, useLevel } from "./LevelChip";
import { useCoarsePointer } from "./coarse";
import { useHandShown } from "./hand";
import { hudDisplay, hudLabel, hudPane, hudTag, topOrder } from "./look";
import { useShownCoins } from "./purse";

/** The screen's width inside the HUD's margins and the device's safe
 *  area: the widest the touch screen's row may grow. */
const screenWidth = `calc(100vw - 2rem - ${gameInsetLengths.left} - ${gameInsetLengths.right})`;

/** What a row says of a warden beside her name, where anything. */
enum RowState {
    Away = "Away",
    Ready = "Ready",
    Choosing = "Choosing",
    Joining = "Joining",
    Down = "Down",
}

/** Each state's tag. Written whole, because Tailwind emits only the
 *  classes it reads. */
const stateTags: Record<RowState, string> = {
    [RowState.Away]: "bg-slate-500/85 text-white",
    [RowState.Ready]: "bg-emerald-400/20 text-emerald-300",
    [RowState.Choosing]: "bg-amber-400/15 text-menu-accent",
    [RowState.Joining]: "bg-sky-400/20 text-sky-200",
    [RowState.Down]: "bg-red-500/85 text-white",
};

/** Counts the times `value` changed since the row mounted, so each change
 *  keys a flash of its own and the first render flashes nothing. */
function useChanges<Value>(value: Value) {
    const [seen, setSeen] = useState({ value, changes: 0 });
    //  Adjusted while rendering, as useHits in Vitals.tsx is, so the flash
    //  lands in the frame the state does.
    if (seen.value !== value) setSeen({ value, changes: seen.changes + 1 });
    return seen.changes;
}

/** Whether the counts action is held, Tab: the engine keeps the browser
 *  from moving focus with it, and lets it go as the page loses focus. */
function useCountsHeld() {
    const [held, setHeld] = useState(false);
    //  The room mounts the scene with no page to listen on.
    const headless = useHeadless();
    useEffect(() => {
        if (headless) return;
        const { counts } = siegePlugin.actions;
        return listenToAction(counts, {
            onPress: () => {
                //  Where its key is her push-to-talk key, it is the
                //  voice's alone.
                const { voiceMode, pushToTalkKey } = useSettings.getState();
                if (
                    voiceMode === VoiceMode.PushToTalk &&
                    counts.keys.some((key) => key === pushToTalkKey)
                )
                    return;
                setHeld(true);
            },
            onRelease: () => setHeld(false),
        });
    }, [headless]);
    return held;
}

/** Counts the epics newly dealt in `offer`, from the offer the row mounted
 *  with, so each keys a flash of its own. */
function useEpicPulls(offer: readonly CardOffer[] | undefined) {
    const key = readOfferKey(offer ?? []);
    const epic = offer?.some(({ rarity }) => rarity === Rarity.Epic) ?? false;
    const [seen, setSeen] = useState({ key, pulls: 0 });
    //  Adjusted while rendering, as useChanges is.
    if (seen.key !== key)
        setSeen({ key, pulls: epic ? seen.pulls + 1 : seen.pulls });
    return seen.pulls;
}

interface CountProps {
    icon: "coins" | "skull";
    label: string;
    value: number;
    className: string;
}

/** A count with its icon, which swells as it changes. */
function Count({ icon, label, value, className }: CountProps) {
    return (
        <Counter
            icon={icon}
            label={label}
            value={value}
            classNames={{
                root: "w-11 justify-end gap-1",
                icon: `size-3.5 ${className}`,
                value: `${hudDisplay} text-base ${icon === "coins" ? "text-amber-100" : "text-white"}`,
            }}
        />
    );
}

interface ScoreRowProps {
    entity: Entity;
    /** Whether the wardens are gathering for a run or resting between
     *  waves, when her row says whether she is ready. */
    gathering: boolean;
    /** Whether the row shows her coins and kills. */
    counts: boolean;
    /** Whether the row is one chip of the touch screen's compact row,
     *  which leaves out "you": her own chip is the lit one. */
    compact: boolean;
}

/** One warden: her colour, her name, cut short only where the row runs
 *  out of room, her level, the page's own marked beside it and a
 *  microphone while she speaks, her elements, what she is doing where it
 *  matters, her coins and her kills. A row flashes as she goes down or
 *  gets up. A warden alone reads her self-revive on her health
 *  panel. */
function ScoreRow({ entity, gathering, counts, compact }: ScoreRowProps) {
    const player = useTrait(entity, PlayerNameTrait);
    const survivor = useTrait(entity, WardenTrait);
    const coins = useShownCoins(entity);
    const away = useHas(entity, DisconnectedTrait);
    const own = isPlayerHero(entity);
    const speaking = useSpeaking(entity);
    const down = useHas(entity, LifeMachine.is.down);
    const ready = useHas(entity, ReadinessMachine.is.ready);
    const sheltered = useHas(entity, LifeMachine.is.sheltered);
    const kills = survivor?.kills ?? 0;
    const level = useLevel(entity);
    const hue = readWardenTextClass(survivor?.hue ?? 0);
    const falls = useChanges(down);
    const name = player?.name ?? "";
    const state = away
        ? RowState.Away
        : gathering && ready
          ? RowState.Ready
          : sheltered
            ? RowState.Joining
            : down
              ? RowState.Down
              : null;
    //  A free pick she has still to make, which the next wave makes for
    //  her: whom a ready teammate waits on.
    const choosing =
        gathering &&
        !away &&
        survivor !== undefined &&
        survivor.catchUp === 0 &&
        survivor.offer.length > 0 &&
        survivor.taken === "";
    const pulls = useEpicPulls(own ? undefined : survivor?.offer);

    return (
        <Text
            as="li"
            aria-label={`${name}${own ? ", you" : ""}${level === undefined ? "" : `, level ${level}`}: ${state ? `${state.toLowerCase()}, ` : ""}${coins} coins, ${kills} kills`}
            className={`relative flex items-center gap-1.5 overflow-hidden ${compact ? "landscape:min-w-0" : ""} rounded-md py-1 pr-2 pl-1.5 transition-colors duration-300 ${down ? "bg-red-500/15" : own ? "bg-white/8" : "bg-transparent"}`}
        >
            {pulls > 0 && (
                <Text
                    as="div"
                    key={`pull${pulls}`}
                    className="score-pull pointer-events-none absolute inset-0 animate-hud-flash bg-[linear-gradient(90deg,rgb(162_28_175/0.75),rgb(251_191_36/0.5),transparent)]"
                >
                    {null}
                </Text>
            )}
            {falls > 0 && (
                <Text
                    as="div"
                    key={falls}
                    className={`pointer-events-none absolute inset-0 animate-hud-flash ${down ? "bg-red-500/50" : "bg-emerald-300/35"}`}
                >
                    {null}
                </Text>
            )}
            <Text
                as="div"
                className={`h-6 w-1 shrink-0 rounded-full bg-current transition-opacity duration-300 ${hue} ${down ? "opacity-40" : ""}`}
            >
                {null}
            </Text>
            {/*  Her name alone truncates, so the tags beside it stay. */}
            <Text
                className={`min-w-0 truncate font-bold transition-opacity duration-300 ${compact ? "max-w-32" : ""} ${hue} ${down ? "opacity-60" : ""}`}
            >
                {name}
            </Text>
            <LevelChip level={level} />
            <Text as="span" className="flex shrink-0 items-center gap-1">
                {own && !compact && (
                    <Text
                        className={`${hudLabel} tracking-[0.14em] text-white/50`}
                    >
                        you
                    </Text>
                )}
                {speaking && (
                    <Icon
                        name="mic"
                        label="Speaking"
                        className="size-3.5 text-emerald-300"
                    />
                )}
            </Text>
            <Text
                as="span"
                className="ml-auto flex shrink-0 items-center gap-1.5"
            >
                <ElementBadges entity={entity} className="size-3.5" />
                {state && (
                    <Text
                        key={state}
                        className={`${hudTag} animate-hud-rise ${stateTags[state]}`}
                    >
                        {state}
                    </Text>
                )}
                {choosing && (
                    <Text
                        className={`${hudTag} animate-hud-rise ${stateTags[RowState.Choosing]}`}
                    >
                        {RowState.Choosing}
                    </Text>
                )}
            </Text>
            {counts && (
                <>
                    {own ? (
                        //  Her own coins are her health panel's: the cell
                        //  stays, so the columns line up.
                        <Text as="span" className="w-11 shrink-0">
                            {null}
                        </Text>
                    ) : (
                        <Count
                            icon="coins"
                            label="Coins"
                            value={coins}
                            className="text-menu-accent"
                        />
                    )}
                    <Count
                        icon="skull"
                        label="Kills"
                        value={kills}
                        className="text-red-300"
                    />
                </>
            )}
        </Text>
    );
}

/** Every warden in the room, under the room's best wave: her name, her
 *  elements and her state, and between waves or while Tab is held the
 *  coins a teammate holds and the monsters each has killed, as the room
 *  counts them. Her own coins are her health panel's. The wave itself is
 *  the banner's. */
export function Scoreboard() {
    const wardens = useQuery(PlayerNameTrait, WardenTrait);
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = usePhase();
    //  Whether ready means something now, so each row says it.
    const gathering = isReadyAsked(phase, siege?.wave ?? 0);
    const held = useCountsHeld();
    const coarse = useCoarsePointer();
    const handShown = useHandShown();
    //  A touch screen has no Tab to hold, and no room for the counts.
    const counts = !coarse && (held || phase === "breather");
    const rows = wardens.map((entity) => (
        <ScoreRow
            key={entity}
            entity={entity}
            gathering={gathering}
            counts={counts}
            compact={coarse}
        />
    ));

    //  A phone's top has no room for the list beside the banner: the list
    //  joins the top's stack as one row under the banner, as narrow as the
    //  screen, and a phone held upright starts the stack under the
    //  corner's buttons, the 44 px tap targets the banner would cover.
    //  On a phone her open hand reaches the top, at its top held upright
    //  and right of her health panel on its side: the row comes back as
    //  she picks, hides the hand or readies. The corner's room stays.
    const yielding = handShown;
    if (coarse)
        return (
            <Hud>
                <Panel
                    slot={Slot.Top}
                    order={topOrder.banner - 1}
                    variant={PanelVariant.Bare}
                    className="hidden h-[44px] shrink-0 portrait:block"
                >
                    {null}
                </Panel>
                {!yielding && (
                    <Panel
                        slot={Slot.Top}
                        order={topOrder.wardens}
                        variant={PanelVariant.Bare}
                        className={`w-max px-1 py-1 ${hudPane}`}
                        style={{ maxWidth: screenWidth }}
                    >
                        {/*  Upright, the row wraps onto the screen's height;
                        on its side, the screen is too short for a second
                        line, so the names share one line and cut short. */}
                        <Text
                            as="ul"
                            className="flex flex-wrap justify-center gap-x-1 gap-y-0.5 landscape:w-full landscape:flex-nowrap"
                        >
                            {rows}
                        </Text>
                    </Panel>
                )}
            </Hud>
        );

    return (
        <Hud>
            <Panel
                slot={Slot.TopRight}
                variant={PanelVariant.Bare}
                className={`${counts ? "w-96" : "w-80"} items-stretch gap-1 px-2 pt-2 pb-2 ${hudPane}`}
            >
                <Text
                    as="div"
                    className="flex items-baseline justify-between px-1.5 pb-0.5"
                >
                    <Text className={hudLabel}>Wardens</Text>
                    {siege && siege.best > 0 && (
                        <Text className={hudLabel}>
                            Best wave{" "}
                            <Text
                                className={`${hudDisplay} text-sm text-menu-accent`}
                            >
                                {siege.best}
                            </Text>
                        </Text>
                    )}
                </Text>
                <Text as="ul" className="flex flex-col gap-1">
                    {rows}
                </Text>
            </Panel>
        </Hud>
    );
}
