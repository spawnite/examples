import { useHas, useQueryFirst, useTrait, useWorld } from "koota/react";
import {
    type RefObject,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import {
    AuthorityTrait,
    Button,
    HeroTrait,
    Hud,
    Icon,
    listenToAction,
    Panel,
    PanelVariant,
    Slot,
    Text,
    useMenu,
    WalletTrait,
} from "@spawnite/engine";
import { playSound, Sound } from "../audio/sounds";
import { isElementPick, readCard } from "../siege/cards";
import { readCardPrice, readRerollPrice } from "../siege/shop";
import { siegePlugin } from "../siege/siege.plugin";
import {
    type CardOffer,
    Rarity,
    SiegeTrait,
    WardenElementsTrait,
    WardenTrait,
} from "../siege/traits";
import { ReadinessMachine } from "../siege/life";
import { elementClasses } from "../views/palette";
import { usePhase } from "../views/phase";
import { sendSignal } from "../weapons/signal";
import { CardFace, rarityLooks, readCardIcon } from "./CardFace";
import {
    flashClasses,
    readOfferKey,
    readOfferPeak,
    readRevealSounds,
    readRevealTimes,
    RevealCue,
    settleClasses,
} from "./cardReveal";
import { ElementBadge } from "./ElementArt";
import {
    canSpend,
    chipSeconds,
    dealHand,
    foldBeat,
    foldHand,
    type HandPurse,
    readCheapest,
    readCardOffer,
    toggleHand,
    recordCardAffordability,
    useHand,
} from "./hand";
import {
    hudDisplay,
    hudKeyboardKey,
    hudLabel,
    hudPane,
    hudTapTarget,
    topOrder,
} from "./look";
import { usePhoneUpright } from "./coarse";
import { ShopBar } from "./ShopBar";

/** The actions that take the first, second and third card. */
const pickActions = [
    siegePlugin.actions.pickFirst,
    siegePlugin.actions.pickSecond,
    siegePlugin.actions.pickThird,
];

/** Milliseconds the hand takes to settle from the middle to the lower
 *  third: its card-hand animation in styles.css. */
const handMilliseconds = 480;

/** Milliseconds the cards a reroll replaces take to sweep away: their
 *  card-sweep animation in styles.css. */
const sweepMilliseconds = 320;

/** Milliseconds into a taken card's 560 ms flight that it reaches her
 *  panel and chimes, as styles.css lands its name in the hand's place. */
const flightTime = 480;

/** The keycap a control or the chip names, left out on a touch screen. */
const pillKey = hudKeyboardKey;

/** The key that folds the hand to its chip, as a small control in the
 *  corner over the cards that a tap presses. */
function HideButton() {
    return (
        <Button
            onPress={toggleHand}
            keyShortcuts="C"
            label="Hide the cards (C)"
            className={`h-8 min-w-0 ${hudTapTarget} rounded-lg border border-white/10 bg-slate-950/55 bg-none py-0 pr-2.5 pl-0.5 shadow-none inset-shadow-none hover:bg-slate-950/80`}
        >
            <Text as="span" className="flex items-center gap-1.5">
                <Text as="span" className={pillKey}>
                    C
                </Text>
                <Text className={`${hudLabel} tracking-[0.16em]`}>Hide</Text>
            </Text>
        </Button>
    );
}

/** Where her offer stands: whether the wardens gather, the cards she
 *  still has to catch up, how many elements she holds, and whether the
 *  offer is elements to pick. */
interface OfferState {
    gathering: boolean;
    catchUp: number;
    elements: number;
    picking: boolean;
    /** Whether she took her free card, so the rest are hers to buy. */
    taken: boolean;
}

/** The title over her offer: her element as the wardens gather, her
 *  second as the night deepens, the cards she missed, or a card. The keys
 *  beside it say the rest. */
function readOfferTitle({
    gathering,
    catchUp,
    elements,
    picking,
    taken,
}: OfferState) {
    if (gathering || (picking && elements === 0)) return "Pick your element";
    if (picking) return "Your second element";
    if (catchUp > 0) return `Catch up: ${catchUp} to take`;
    if (taken) return "Buy more";
    return "Take a card";
}

/** The sound each cue of the reveal plays. */
const revealSounds: Record<RevealCue, Sound> = {
    [RevealCue.Flip]: Sound.CardFlip,
    [RevealCue.Rare]: Sound.RareCard,
    [RevealCue.Charge]: Sound.EpicCharge,
    [RevealCue.Epic]: Sound.EpicCard,
};

/** Plays each card's turn as the offer is dealt: a flick for a common, a
 *  little higher each, a chime for a rare, and for an epic a climb while
 *  it gathers and a chord as it bursts. Taking a card stops the rest. */
function useRevealSound(offer: readonly CardOffer[], open: boolean) {
    const key = readOfferKey(offer);
    const offerRef = useRef(offer);
    offerRef.current = offer;
    useEffect(() => {
        if (!open) return;
        const timers = readRevealSounds(offerRef.current).map(
            ({ cue, at, pitch }) =>
                window.setTimeout(
                    () => playSound(revealSounds[cue], { pitch }),
                    at,
                ),
        );
        return () => {
            for (const timer of timers) window.clearTimeout(timer);
        };
    }, [key, open]);
}

interface TakenCardProps {
    id: string;
    rarity: Rarity;
    /** Its slot in the hand, and the cards the hand held, which place
     *  where it flies from. */
    slot: number;
    count: number;
    /** When, on the page's clock, the offer was dealt, and how long it
     *  took to settle: a card taken before then flies from the middle of
     *  the screen. */
    openedRef: RefObject<number>;
    settle: number;
}

/** The card she took, flying out of the hand into her panel in the bottom
 *  left with a rising chime, then its name in the hand's place. */
function TakenCard({
    id,
    rarity,
    slot,
    count,
    openedRef,
    settle,
}: TakenCardProps) {
    const [midDeal] = useState(
        () => performance.now() - openedRef.current < settle,
    );
    const taken = readCard(id);
    const element = taken?.element ?? taken?.line;
    const look = rarityLooks[rarity] ?? rarityLooks[Rarity.Common];
    useEffect(() => {
        const timer = window.setTimeout(
            () => playSound(Sound.CardLand),
            flightTime,
        );
        return () => window.clearTimeout(timer);
    }, []);
    return (
        <Hud>
            <Panel slot={Slot.Bottom} variant={PanelVariant.Bare}>
                <Text
                    as="span"
                    className={`card-flight ${readFlightStart(slot, count)} ${midDeal ? "card-from-middle" : ""} pointer-events-none fixed bottom-4 left-1/2 -ml-24 flex h-72 w-48 flex-col items-center justify-center gap-3 rounded-xl border-2 ${element ? `bg-menu-surface ${elementClasses[element].frame}` : `${look.face} ${look.frame}`}`}
                >
                    {element ? (
                        <ElementBadge
                            element={element}
                            className={`size-16 ${elementClasses[element].text}`}
                        />
                    ) : (
                        <Icon
                            name={readCardIcon(id)}
                            className="size-16 text-amber-200"
                        />
                    )}
                    <Text
                        className={`${hudDisplay} text-2xl text-amber-50 uppercase`}
                    >
                        {taken?.title}
                    </Text>
                </Text>
                <Text
                    as="span"
                    className={`card-landed flex items-center gap-3 py-2.5 pr-5 pl-3 ${hudPane}`}
                >
                    <Text
                        as="span"
                        className={`flex size-10 items-center justify-center rounded-full border ${element ? `${elementClasses[element].fill} ${elementClasses[element].text}` : "border-menu-accent/40 bg-amber-400/20"}`}
                    >
                        {element ? (
                            <ElementBadge
                                element={element}
                                className="size-5"
                            />
                        ) : (
                            <Icon
                                name={readCardIcon(id)}
                                className="size-5 text-menu-accent"
                            />
                        )}
                    </Text>
                    <Text as="span" className="flex flex-col gap-0.5">
                        <Text className={hudLabel}>You took</Text>
                        <Text
                            className={`${hudDisplay} text-xl uppercase ${element ? elementClasses[element].text : "text-amber-100"}`}
                        >
                            {taken?.title}
                        </Text>
                    </Text>
                </Text>
            </Panel>
        </Hud>
    );
}

/** Where a taken card flies from, by its slot in a hand of `count`:
 *  styles.css sets each start. */
function readFlightStart(slot: number, count: number) {
    if (count <= 1) return "card-from-1-0";
    if (count === 2) return slot === 0 ? "card-from-2-0" : "card-from-2-1";
    return ["card-from-3-0", "card-from-3-1", "card-from-3-2"][
        Math.min(2, Math.max(0, slot))
    ];
}

/** When, on the page's clock, the offer now open was dealt: a card taken
 *  before it settles flies from the middle of the screen. */
function useOpenedAt(offer: readonly CardOffer[], open: boolean) {
    const key = readOfferKey(offer);
    const openedRef = useRef(Number.NEGATIVE_INFINITY);
    useEffect(() => {
        if (open) openedRef.current = performance.now();
    }, [key, open]);
    return openedRef;
}

interface HandChipProps {
    /** Her element's card, while the wardens gather and she has picked
     *  one. */
    element?: string;
    /** Whether she still has a free pick to make. */
    free: boolean;
    gathering: boolean;
    /** The breather's last seconds, shown as they run out. */
    count?: number;
    pulses: number;
}

/** Her hand folded along the bottom: three card backs fanned beside its
 *  key, the top one lit gold while a free pick waits, and the breather's
 *  last seconds on it. While the wardens gather it is her element's badge.
 *  It lifts once as her coins come to meet a card. A tap opens it where the
 *  cursor is free. */
function HandChip({ element, free, gathering, count, pulses }: HandChipProps) {
    const picked = element ? readCard(element) : undefined;
    const line = picked?.element;
    const title = picked
        ? picked.title
        : gathering
          ? "Pick your element"
          : "Cards";
    const note = picked
        ? "Change it"
        : gathering
          ? "Before the run starts"
          : free
            ? "One is free"
            : undefined;
    const urgent = count !== undefined;
    //  Only a pulse that lands while the chip shows plays: folding it
    //  again later replays none.
    const [shownFrom] = useState(pulses);
    return (
        <Hud>
            <Panel slot={Slot.Bottom} variant={PanelVariant.Bare}>
                <Button
                    onPress={toggleHand}
                    keyShortcuts="C"
                    label={`${title}: open with C`}
                    className={`card-chip relative h-auto min-w-0 overflow-visible py-2 pr-2.5 pl-3 text-left shadow-none inset-shadow-none ${hudPane} ${urgent ? "border-danger/60" : free && !line ? "border-menu-accent/50" : ""}`}
                >
                    <Text as="span" className="flex items-center gap-3">
                        {pulses > shownFrom && (
                            <Text
                                as="span"
                                key={pulses}
                                className="card-chip-pulse pointer-events-none absolute -inset-px rounded-[inherit]"
                            >
                                {null}
                            </Text>
                        )}
                        {line ? (
                            <Text
                                as="span"
                                className={`flex size-9 items-center justify-center rounded-full border ${elementClasses[line].fill} ${elementClasses[line].text}`}
                            >
                                <ElementBadge
                                    element={line}
                                    className="size-5"
                                />
                            </Text>
                        ) : (
                            <Text
                                as="span"
                                className="card-chip-fan relative h-9 w-10"
                            >
                                {[0, 1, 2].map((index) => (
                                    <Text
                                        as="span"
                                        key={index}
                                        className={`card-chip-back absolute bottom-0 left-2.5 h-8 w-5.5 rounded-[3px] border ${index === 2 && free ? "border-amber-100 bg-[radial-gradient(circle_at_50%_35%,rgb(253_230_138),rgb(217_119_6)_55%,rgb(120_53_15))] shadow-[0_0_12px_rgb(251_191_36/0.75)]" : "border-amber-200/45 bg-[radial-gradient(circle_at_50%_40%,rgb(120_53_15),rgb(28_25_23))]"}`}
                                    >
                                        {null}
                                    </Text>
                                ))}
                            </Text>
                        )}
                        <Text
                            as="span"
                            className="flex flex-col items-start gap-1"
                        >
                            <Text
                                className={`${hudDisplay} text-lg whitespace-nowrap uppercase ${line ? elementClasses[line].text : "text-pane-ink"}`}
                            >
                                {title}
                            </Text>
                            {note && (
                                <Text
                                    className={`${hudLabel} whitespace-nowrap ${free && !gathering ? "text-menu-accent" : ""}`}
                                >
                                    {note}
                                </Text>
                            )}
                        </Text>
                        {urgent && (
                            <Text
                                key={count}
                                tabular
                                className={`card-chip-count ${hudDisplay} min-w-[1ch] animate-hud-slam text-center text-3xl text-red-300 [text-shadow:0_0_14px_rgb(248_113_113/0.7)]`}
                            >
                                {count}
                            </Text>
                        )}
                        <Text as="span" className={pillKey}>
                            C
                        </Text>
                    </Text>
                </Button>
            </Panel>
        </Hud>
    );
}

/** Milliseconds an open hand takes to sweep off the screen as the wave
 *  starts: its card-hand-leave animation in styles.css. */
const leaveMilliseconds = 420;

/** The hand she had open as the breather ended, drawn once more as it
 *  sweeps away. */
interface LeavingHand {
    offer: readonly CardOffer[];
    taken: string;
    bought: readonly string[];
    title: string;
}

/** The cards a reroll replaced, and what she had taken of them. */
interface SweptCards {
    rerolls: number;
    offer: readonly CardOffer[];
    taken: string;
    bought: readonly string[];
}

/** The cards a reroll the room granted swept away, held on the page for
 *  the sweep, so the new three deal into the same places as they leave. */
function useSweptCards(
    survivor:
        | {
              offer: readonly CardOffer[];
              taken: string;
              bought: readonly string[];
              rerolls: number;
          }
        | undefined,
) {
    const [swept, setSwept] = useState<SweptCards | null>(null);
    const rerolls = survivor?.rerolls ?? 0;
    const lastRef = useRef<SweptCards>({
        rerolls,
        offer: survivor?.offer ?? [],
        taken: survivor?.taken ?? "",
        bought: survivor?.bought ?? [],
    });
    useLayoutEffect(() => {
        const last = lastRef.current;
        lastRef.current = {
            rerolls,
            offer: survivor?.offer ?? [],
            taken: survivor?.taken ?? "",
            bought: survivor?.bought ?? [],
        };
        if (rerolls > last.rerolls && last.offer.length > 0)
            setSwept({ ...last, rerolls });
    }, [rerolls, survivor]);
    useEffect(() => {
        if (!swept) return;
        const timer = window.setTimeout(
            () => setSwept(null),
            sweepMilliseconds,
        );
        return () => window.clearTimeout(timer);
    }, [swept]);
    return swept;
}

interface HandRules {
    open: boolean;
    offerKey: string;
    /** Milliseconds the offer's deal takes to settle, for the wait after a
     *  reroll. */
    settle: number;
    gathering: boolean;
    shopping: boolean;
    taken: string;
    bought: number;
    ready: boolean;
    purse: HandPurse;
}

/** Folds the hand by the rules in hand.ts: open on a new deal, folded as
 *  she readies, and folded a beat after a pick, a purchase or a reroll
 *  where her purse meets nothing left. While the wardens gather, it folds
 *  to her element a beat after she picks it. Once the offer is gone the
 *  deal is forgotten, so the next one deals again. */
function useHandRules({
    open,
    offerKey,
    settle,
    gathering,
    shopping,
    taken,
    bought,
    ready,
    purse,
}: HandRules) {
    const takenRef = useRef(taken);
    takenRef.current = taken;
    const affordable = canSpend(purse);
    const affordableRef = useRef(affordable);
    affordableRef.current = affordable;
    const settleRef = useRef(settle);
    settleRef.current = settle;

    //  Before the page paints, so an element pick dealt picked already
    //  never shows open.
    useLayoutEffect(() => {
        if (!open) {
            useHand.setState(useHand.getInitialState(), true);
            return;
        }
        if (dealHand(offerKey) && gathering && takenRef.current !== "")
            foldHand();
    }, [open, offerKey, gathering]);

    const pickedRef = useRef(taken);
    useEffect(() => {
        const was = pickedRef.current;
        pickedRef.current = taken;
        if (!gathering || taken === "" || taken === was) return;
        const timer = window.setTimeout(foldHand, foldBeat);
        return () => window.clearTimeout(timer);
    }, [gathering, taken]);

    const spend = shopping ? `${offerKey}|${taken}|${bought}` : "";
    const spendRef = useRef({ spend: "", offerKey });
    const cheapest = purse.cheapest;
    const cardAffordable = cheapest !== undefined && purse.coins >= cheapest;
    useEffect(() => {
        const was = spendRef.current;
        spendRef.current = { spend, offerKey };
        if (spend === "" || spend === was.spend) return;
        //  A reroll deals a new hand in place: it turns before it can fold.
        const rerolled = was.spend !== "" && was.offerKey !== offerKey;
        const wait = rerolled ? settleRef.current + foldBeat : foldBeat;
        //  A fold or an open of her own before the beat ends is hers.
        const toggles = useHand.getState().toggles;
        const timer = window.setTimeout(() => {
            if (useHand.getState().toggles !== toggles) return;
            if (!affordableRef.current) foldHand();
        }, wait);
        return () => window.clearTimeout(timer);
    }, [spend, offerKey]);

    const readyRef = useRef(ready);
    useEffect(() => {
        const was = readyRef.current;
        readyRef.current = ready;
        //  The element pick stays in the middle until she picks.
        if (open && ready && !was && !gathering) foldHand();
    }, [open, ready, gathering]);

    useEffect(() => {
        if (open) recordCardAffordability(cardAffordable);
    }, [open, cardAffordable]);
}

interface SettledOptions {
    offerKey: string;
    open: boolean;
    /** How long the deal takes to settle into its place. */
    milliseconds: number;
}

/** Whether the hand dealt for `offerKey` stands settled in its place,
 *  so styles.css gives the crosshair back: `milliseconds` after its deal,
 *  or at once where the device asks for less motion, as styles.css then
 *  skips the deal. A closed hand forgets it, so the next deal of the same
 *  cards settles again. */
function useSettled({ offerKey, open, milliseconds }: SettledOptions) {
    const [settledKey, setSettledKey] = useState<string>();
    useEffect(() => {
        if (!open) {
            setSettledKey(undefined);
            return;
        }
        const timer = setTimeout(() => setSettledKey(offerKey), milliseconds);
        return () => clearTimeout(timer);
    }, [offerKey, open, milliseconds]);
    const still =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
    return still || settledKey === offerKey;
}

/** Between waves, her three cards, dealt in the middle and settled at full
 *  size in the lower third, the title over them and the shop's bar under them, which
 *  holds her coins, the reroll, and the clock with Ready; folded to a chip
 *  when she folds it, readies, or has nothing left to take. The one she
 *  took once she has, for an element. A warden who joined a running run
 *  takes the cards she missed the same way, one offer after another,
 *  whatever the phase. While the wardens gather, her element in the middle
 *  of the screen until she picks, then her element's badge, which opens
 *  again to change it until the run starts. The pick goes to the room,
 *  which gives it to her. */
export function CardPick() {
    const world = useWorld();
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const survivor = useTrait(hero, WardenTrait);
    const held = useTrait(hero, WardenElementsTrait);
    const coins = useTrait(hero, WalletTrait)?.coins ?? 0;
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const phase = usePhase();
    const ready = useHas(hero, ReadinessMachine.is.ready);
    const { gathering, catchingUp, shopping, open } = readCardOffer(
        phase,
        survivor,
    );
    const offer = survivor?.offer ?? [];
    const offerKey = readOfferKey(offer);
    useRevealSound(offer, open);
    const openedRef = useOpenedAt(offer, open);
    const folded = useHand((state) => state.folded);
    const back = useHand((state) => state.back);
    //  A phone held upright has no room for the hand beside her health
    //  panel along the bottom: it stands at the top, under the corner's
    //  buttons, where the banner and the wardens step aside for it.
    const upright = usePhoneUpright();
    const handSlot = upright ? Slot.Top : Slot.Bottom;
    const pulses = useHand((state) => state.pulses);
    const choiceRef = useRef({ survivor, coins, gathering });
    choiceRef.current = { survivor, coins, gathering };

    /** Takes the card in `slot` free, or once her free card is taken buys
     *  it where her purse meets its price, and buzzes where it does not. */
    const choose = useCallback(
        (slot: number) => {
            const {
                survivor: now,
                coins: purse,
                gathering: gather,
            } = choiceRef.current;
            if (!now) return;
            if (gather || now.taken === "") {
                sendSignal(world, siegePlugin.messages.pick, { slot });
                return;
            }
            const offered = now.offer[slot];
            if (
                !offered ||
                offered.card === now.taken ||
                now.bought.includes(offered.card)
            )
                return;
            if (purse < readCardPrice(offered.rarity)) {
                playSound(Sound.Refused);
                return;
            }
            sendSignal(world, siegePlugin.messages.buyCard, { slot });
        },
        [world],
    );
    //  An element's pick is never rerolled.
    const rerollable =
        open &&
        !gathering &&
        survivor !== undefined &&
        !survivor.offer.some(({ card }) => isElementPick(card));
    const rerollPrice = readRerollPrice(survivor?.rerolls ?? 0);
    const rerollRef = useRef({ rerollable, price: rerollPrice, coins });
    rerollRef.current = { rerollable, price: rerollPrice, coins };
    //  A reroll the room granted: the old hand is swept away.
    const rerolls = survivor?.rerolls ?? 0;
    const rerollsRef = useRef(rerolls);
    useEffect(() => {
        if (rerolls > rerollsRef.current) playSound(Sound.Reroll);
        rerollsRef.current = rerolls;
    }, [rerolls]);
    const { bursts, settle } = readRevealTimes(offer);
    //  A reroll deals in place: the new three turn where the old three
    //  stood, with no travel from the middle and no dim.
    const inPlace = phase === "breather" && rerolls > 0;
    const swept = useSweptCards(survivor);
    //  The hand she had open in the breather, swept away as the wave
    //  starts: its cards stay on the page for the sweep, so the pick made
    //  for her flies from its card.
    const shownRef = useRef<LeavingHand | null>(null);
    const leaving = phase === "fight" && !catchingUp ? shownRef.current : null;
    const [, forget] = useState(0);
    useEffect(() => {
        if (!leaving) return;
        const timer = window.setTimeout(() => {
            shownRef.current = null;
            forget((times) => times + 1);
        }, leaveMilliseconds);
        return () => window.clearTimeout(timer);
    }, [leaving]);
    if (phase === "breather" && !(open && !folded && !gathering))
        shownRef.current = null;
    const settled = useSettled({
        offerKey,
        open,
        milliseconds: inPlace ? settle : settle + handMilliseconds,
    });

    useHandRules({
        open,
        offerKey,
        settle,
        gathering,
        shopping,
        taken: survivor?.taken ?? "",
        bought: survivor?.bought.length ?? 0,
        ready,
        purse: {
            free: survivor?.taken === "",
            coins,
            cheapest: readCheapest(
                offer,
                survivor?.taken ?? "",
                survivor?.bought ?? [],
            ),
            reroll: rerollable ? rerollPrice : undefined,
        },
    });

    /** Asks the room for a reroll where her purse meets its price, and
     *  buzzes where it does not. */
    const askReroll = useCallback(() => {
        const { rerollable: can, price, coins: purse } = rerollRef.current;
        if (!can) return;
        if (purse < price) {
            playSound(Sound.Refused);
            return;
        }
        sendSignal(world, siegePlugin.messages.reroll, {});
    }, [world]);

    useEffect(() => {
        if (!open) return;
        //  Folded, the hand takes nothing: its key opens it first.
        const unfolded = (act: () => void) => () => {
            if (!useHand.getState().folded) act();
        };
        const stops = [
            listenToAction(siegePlugin.actions.foldHand, {
                onPress: () => {
                    if (!useMenu.getState().open) toggleHand();
                },
            }),
            ...pickActions.map((action, slot) =>
                listenToAction(action, {
                    onPress: unfolded(() => choose(slot)),
                }),
            ),
            listenToAction(siegePlugin.actions.reroll, {
                onPress: unfolded(askReroll),
            }),
        ];
        return () => {
            for (const stop of stops) stop();
        };
    }, [open, askReroll, choose]);

    if (!survivor) return null;
    if (leaving)
        return (
            <Hud>
                <Panel
                    slot={handSlot}
                    order={upright ? topOrder.hand : undefined}
                    variant={PanelVariant.Bare}
                >
                    <Text
                        as="span"
                        className="card-hand card-hand-back card-hand-leave pointer-events-none flex flex-col items-center gap-3"
                    >
                        <Text as="span" className="flex flex-col items-center">
                            <Text className={`${hudLabel} invisible`}>
                                Wave cleared
                            </Text>
                            <Text
                                className={`card-title-line ${hudDisplay} text-3xl whitespace-nowrap text-amber-100 uppercase`}
                            >
                                {leaving.title}
                            </Text>
                        </Text>
                        <Text
                            as="div"
                            className="card-row flex items-stretch gap-3"
                        >
                            {leaving.offer.map(({ card: id, rarity }, slot) => {
                                const card = readCard(id);
                                return (
                                    card && (
                                        <CardFace
                                            key={id}
                                            id={id}
                                            card={card}
                                            rarity={rarity}
                                            slot={slot}
                                            burst={0}
                                            held={0}
                                            taken={
                                                leaving.taken === id ||
                                                leaving.bought.includes(id)
                                            }
                                            bought={leaving.bought.includes(id)}
                                            passed={false}
                                            coins={coins}
                                            onPick={() => undefined}
                                        />
                                    )
                                );
                            })}
                        </Text>
                        <ShopBar coins={coins} breather={false} />
                    </Text>
                </Panel>
            </Hud>
        );
    if (phase !== "breather" && !open) return null;
    if (survivor.taken !== "" && !catchingUp && !gathering && !shopping) {
        const slot = survivor.offer.findIndex(
            ({ card }) => card === survivor.taken,
        );
        return (
            <TakenCard
                key={survivor.taken}
                id={survivor.taken}
                rarity={survivor.offer[slot]?.rarity ?? Rarity.Common}
                slot={slot}
                count={survivor.offer.length}
                openedRef={openedRef}
                settle={settle}
            />
        );
    }
    if (!open) return null;

    if (folded) {
        const seconds = Math.ceil(siege?.secondsLeft ?? 0);
        const counting =
            phase === "breather" && seconds > 0 && seconds <= chipSeconds;
        return (
            <HandChip
                element={
                    gathering && survivor.taken !== ""
                        ? survivor.taken
                        : undefined
                }
                free={survivor.taken === ""}
                gathering={gathering}
                count={counting ? seconds : undefined}
                pulses={pulses}
            />
        );
    }

    const picking = survivor.offer.every(
        ({ card }) => readCard(card)?.element !== undefined,
    );
    const title = readOfferTitle({
        gathering,
        catchUp: survivor.catchUp,
        elements: (held?.first ? 1 : 0) + (held?.second ? 1 : 0),
        picking,
        taken: shopping,
    });
    const peak = picking ? Rarity.Common : readOfferPeak(survivor.offer);
    const lastBurst = Math.max(...bursts);
    //  A hand the fold key opened again comes back in its place, with no
    //  deal, no dim and no flash.
    const dealt = !back;
    if (phase === "breather" && !gathering)
        shownRef.current = {
            offer: survivor.offer,
            taken: survivor.taken,
            bought: survivor.bought,
            title,
        };
    //  The wave just held, named over the title as the breather's first
    //  deal lands.
    const cleared =
        dealt &&
        !inPlace &&
        phase === "breather" &&
        !catchingUp &&
        survivor.taken === "" &&
        (siege?.wave ?? 0) > 0
            ? siege?.wave
            : undefined;

    return (
        <Hud>
            <Panel
                slot={gathering && !upright ? Slot.Center : handSlot}
                order={upright ? topOrder.hand : undefined}
                variant={PanelVariant.Bare}
                className="gap-3"
            >
                {dealt && !inPlace && (
                    <Text
                        key={`screen:${offerKey}`}
                        as="span"
                        className={`pointer-events-none fixed inset-0 -z-10 ${settleClasses[settle] ?? ""} ${flashClasses[lastBurst] ?? ""}`}
                    >
                        <Text
                            as="span"
                            className={`card-dim absolute inset-0 transition-opacity duration-500 ${shopping ? "opacity-0" : ""} ${peak === Rarity.Epic ? "bg-[radial-gradient(ellipse_at_50%_50%,rgb(46_16_101/0.45),rgb(2_6_23/0.82))]" : "bg-[radial-gradient(ellipse_at_50%_50%,rgb(2_6_23/0.35),rgb(2_6_23/0.72))]"}`}
                        >
                            {null}
                        </Text>
                        {peak === Rarity.Epic && (
                            <Text
                                as="span"
                                className="card-flash absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgb(255_251_235/0.75),rgb(251_191_36/0.35)_30%,rgb(217_70_239/0.2)_55%,transparent_80%)]"
                            >
                                {null}
                            </Text>
                        )}
                    </Text>
                )}
                {dealt && inPlace && peak === Rarity.Epic && (
                    <Text
                        key={`flash:${offerKey}`}
                        as="span"
                        className={`pointer-events-none fixed inset-0 -z-10 ${flashClasses[lastBurst] ?? ""}`}
                    >
                        <Text
                            as="span"
                            className="card-flash absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgb(255_251_235/0.75),rgb(251_191_36/0.35)_30%,rgb(217_70_239/0.2)_55%,transparent_80%)]"
                        >
                            {null}
                        </Text>
                    </Text>
                )}
                <Text
                    key={`hand:${inPlace ? "in-place" : offerKey}:${dealt}`}
                    as="span"
                    className={`card-hand flex flex-col items-center gap-3 ${gathering ? "card-hand-gathering card-hand-center" : ""} ${dealt ? (settleClasses[settle] ?? "") : "card-hand-back"} ${settled ? "card-hand-settled" : ""} ${inPlace ? "card-hand-in-place" : ""}`}
                >
                    <Text
                        as="div"
                        className="card-head grid w-full grid-cols-[1fr_auto_1fr] items-end gap-3"
                    >
                        <Text as="span">{null}</Text>
                        <Text as="span" className="flex flex-col items-center">
                            {!gathering && (
                                <Text
                                    key={`cleared:${offerKey}`}
                                    className={`card-cleared ${hudLabel} text-menu-accent [text-shadow:0_1px_8px_rgb(0_0_0/0.9)] ${cleared === undefined ? "invisible" : ""}`}
                                >
                                    {cleared === undefined
                                        ? "Wave cleared"
                                        : `Wave ${cleared} cleared`}
                                </Text>
                            )}
                            <Text
                                className={`card-title-line ${hudDisplay} text-3xl whitespace-nowrap text-amber-100 uppercase [text-shadow:0_2px_14px_rgb(0_0_0/0.95),0_1px_0_rgb(0_0_0/0.8)]`}
                            >
                                {title}
                            </Text>
                        </Text>
                        <Text as="span" className="justify-self-end">
                            <HideButton />
                        </Text>
                    </Text>
                    <Text as="div" className="relative">
                        {swept && (
                            <Text
                                key={`swept:${swept.rerolls}`}
                                as="div"
                                className="card-swept pointer-events-none absolute inset-0 z-10 flex items-stretch gap-3"
                            >
                                {swept.offer.map(
                                    ({ card: id, rarity }, slot) => {
                                        const card = readCard(id);
                                        return (
                                            card && (
                                                <CardFace
                                                    key={id}
                                                    id={id}
                                                    card={card}
                                                    rarity={rarity}
                                                    slot={slot}
                                                    burst={0}
                                                    held={0}
                                                    taken={
                                                        swept.taken === id ||
                                                        swept.bought.includes(
                                                            id,
                                                        )
                                                    }
                                                    bought={swept.bought.includes(
                                                        id,
                                                    )}
                                                    passed={false}
                                                    cost={
                                                        swept.taken === ""
                                                            ? 0
                                                            : readCardPrice(
                                                                  rarity,
                                                              )
                                                    }
                                                    coins={coins}
                                                    onPick={() => undefined}
                                                />
                                            )
                                        );
                                    },
                                )}
                            </Text>
                        )}
                        <Text
                            key={`row:${offerKey}`}
                            as="div"
                            className="card-row flex items-stretch gap-3"
                        >
                            {survivor.offer.map(
                                ({ card: id, rarity }, slot) => {
                                    const card = readCard(id);
                                    return (
                                        card && (
                                            <CardFace
                                                key={id}
                                                id={id}
                                                card={card}
                                                rarity={rarity}
                                                slot={slot}
                                                burst={bursts[slot]}
                                                held={
                                                    card.line
                                                        ? 0
                                                        : survivor.cards.filter(
                                                              (taken) =>
                                                                  taken === id,
                                                          ).length
                                                }
                                                taken={
                                                    survivor.taken === id ||
                                                    survivor.bought.includes(id)
                                                }
                                                bought={survivor.bought.includes(
                                                    id,
                                                )}
                                                passed={
                                                    gathering &&
                                                    survivor.taken !== "" &&
                                                    survivor.taken !== id
                                                }
                                                cost={
                                                    picking
                                                        ? undefined
                                                        : survivor.taken === ""
                                                          ? 0
                                                          : readCardPrice(
                                                                rarity,
                                                            )
                                                }
                                                coins={coins}
                                                onPick={choose}
                                            />
                                        )
                                    );
                                },
                            )}
                        </Text>
                    </Text>
                    {!gathering && (
                        <ShopBar
                            coins={coins}
                            breather={phase === "breather"}
                            reroll={
                                rerollable
                                    ? {
                                          price: rerollPrice,
                                          onReroll: askReroll,
                                      }
                                    : undefined
                            }
                        />
                    )}
                </Text>
            </Panel>
        </Hud>
    );
}
