import { Bar, Button, Icon, Text, WarmHud } from "@spawnite/engine";
import { CardId, cards } from "../siege/cards";
import { Element } from "../siege/elements";
import { Rarity } from "../siege/traits";
import { numberClasses, readNumberLook } from "../views/DamageNumbers";
import { elementClasses } from "../views/palette";
import { CardFace, Glint, rarityLooks } from "./CardFace";
import { ElementBadge } from "./ElementArt";
import { tickLooks, tickShape } from "./HitMarker";
import {
    hudBody,
    hudDisplay,
    hudKey,
    hudKeyboardKey,
    hudLabel,
    hudPane,
    hudTag,
} from "./look";
import { RunEndShade } from "./RunOver";

//  A copy of each effect the HUD first shows after the loading screen
//  lifts, drawn under it in a WarmHud: Chrome builds a GPU program the
//  first time each effect draws, a 15 to 30 ms stall on a first visit, so
//  this has it built before play. Each copy carries its real element's
//  classes; a piece that reads the world or plays a sound has its classes
//  copied onto Text rather than being rendered.
//  ponytail: the list is kept by hand, so an effect the HUD adds later
//  builds its program in play until a copy of it is added here.

const ignore = () => undefined;

/** The card offer's faces, one per look whose effects differ: a free
 *  common, a rare her purse cannot meet, an epic, an element passed over,
 *  a bought card in a hand leaving the screen, and a card a reroll sweeps
 *  away. Along the bottom, where the offer stands. */
function CardSamples() {
    return (
        <Text
            as="div"
            className="fixed inset-0 flex flex-wrap content-end items-end gap-3 p-3"
        >
            <CardFace
                id={CardId.HeavyRounds}
                card={cards[CardId.HeavyRounds]}
                rarity={Rarity.Common}
                slot={0}
                burst={620}
                held={1}
                taken={false}
                passed={false}
                cost={0}
                coins={0}
                onPick={ignore}
            />
            <CardFace
                id={CardId.StormSurge}
                card={cards[CardId.StormSurge]}
                rarity={Rarity.Rare}
                slot={1}
                burst={860}
                held={0}
                taken={false}
                passed={false}
                cost={60}
                coins={10}
                onPick={ignore}
            />
            <CardFace
                id={CardId.HairTrigger}
                card={cards[CardId.HairTrigger]}
                rarity={Rarity.Epic}
                slot={2}
                burst={1660}
                held={0}
                taken={false}
                passed={false}
                cost={90}
                coins={200}
                onPick={ignore}
            />
            <CardFace
                id={CardId.Storm}
                card={cards[CardId.Storm]}
                rarity={Rarity.Common}
                slot={0}
                burst={620}
                held={0}
                taken={false}
                passed
                coins={0}
                onPick={ignore}
            />
            <Text as="span" className="card-hand-back card-hand-leave flex">
                <CardFace
                    id={CardId.MidasTouch}
                    card={cards[CardId.MidasTouch]}
                    rarity={Rarity.Rare}
                    slot={1}
                    burst={0}
                    held={0}
                    taken
                    bought
                    passed={false}
                    coins={0}
                    onPick={ignore}
                />
            </Text>
            <Text as="span" className="card-swept flex">
                <CardFace
                    id={CardId.FleetFoot}
                    card={cards[CardId.FleetFoot]}
                    rarity={Rarity.Common}
                    slot={2}
                    burst={0}
                    held={0}
                    taken={false}
                    passed={false}
                    cost={40}
                    coins={100}
                    onPick={ignore}
                />
            </Text>
        </Text>
    );
}

/** The rest of the offer, as CardPick.tsx draws it: the dimmed world and an
 *  epic's flash, the title, a taken card's flight and its name landing, the
 *  folded hand's chip, and the shop's bar. */
function OfferSamples() {
    const rare = rarityLooks[Rarity.Rare];
    return (
        <>
            <Text
                as="span"
                className="card-dim size-24 bg-[radial-gradient(ellipse_at_50%_50%,rgb(2_6_23/0.35),rgb(2_6_23/0.72))] transition-opacity duration-500"
            >
                {null}
            </Text>
            <Text
                as="span"
                className="card-dim size-24 bg-[radial-gradient(ellipse_at_50%_50%,rgb(46_16_101/0.45),rgb(2_6_23/0.82))] transition-opacity duration-500"
            >
                {null}
            </Text>
            <Text
                as="span"
                className="card-flash size-24 bg-[radial-gradient(ellipse_at_50%_50%,rgb(255_251_235/0.75),rgb(251_191_36/0.35)_30%,rgb(217_70_239/0.2)_55%,transparent_80%)]"
            >
                {null}
            </Text>
            <Text as="div" className="flex flex-col items-center">
                <Text
                    className={`card-cleared ${hudLabel} text-menu-accent [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]`}
                >
                    Wave 3 cleared
                </Text>
                <Text
                    className={`${hudDisplay} text-3xl whitespace-nowrap text-amber-100 uppercase [text-shadow:0_2px_14px_rgb(0_0_0/0.95),0_1px_0_rgb(0_0_0/0.8)]`}
                >
                    Take a card
                </Text>
            </Text>
            <Text
                as="span"
                className={`card-flight card-from-1-0 pointer-events-none flex h-44 w-32 flex-col items-center justify-center gap-3 rounded-xl border-2 ${rare.face} ${rare.frame}`}
            >
                <Icon name="zap" className="size-12 text-amber-200" />
                <Text
                    className={`${hudDisplay} text-lg text-amber-50 uppercase`}
                >
                    Hair Trigger
                </Text>
            </Text>
            <Text
                as="span"
                className={`card-landed flex items-center gap-3 py-2.5 pr-5 pl-3 ${hudPane}`}
            >
                <Text
                    as="span"
                    className="flex size-10 items-center justify-center rounded-full border border-menu-accent/40 bg-amber-400/20"
                >
                    <Icon name="zap" className="size-5 text-menu-accent" />
                </Text>
                <Text as="span" className="flex flex-col gap-0.5">
                    <Text className={hudLabel}>You took</Text>
                    <Text
                        className={`${hudDisplay} text-xl text-amber-100 uppercase`}
                    >
                        Hair Trigger
                    </Text>
                </Text>
            </Text>
            <Button
                onPress={ignore}
                label="Cards"
                className={`card-chip relative h-auto min-w-0 overflow-visible py-2 pr-2.5 pl-3 text-left shadow-none inset-shadow-none ${hudPane} border-danger/60`}
            >
                <Text as="span" className="flex items-center gap-3">
                    <Text
                        as="span"
                        className="card-chip-pulse pointer-events-none absolute -inset-px rounded-[inherit]"
                    >
                        {null}
                    </Text>
                    <Text as="span" className="relative h-9 w-10">
                        <Text
                            as="span"
                            className="card-chip-back absolute bottom-0 left-2.5 h-8 w-5.5 rounded-[3px] border border-amber-200/45 bg-[radial-gradient(circle_at_50%_40%,rgb(120_53_15),rgb(28_25_23))]"
                        >
                            {null}
                        </Text>
                        <Text
                            as="span"
                            className="card-chip-back absolute bottom-0 left-2.5 h-8 w-5.5 rounded-[3px] border border-amber-200/45 bg-[radial-gradient(circle_at_50%_40%,rgb(120_53_15),rgb(28_25_23))]"
                        >
                            {null}
                        </Text>
                        <Text
                            as="span"
                            className="card-chip-back absolute bottom-0 left-2.5 h-8 w-5.5 rounded-[3px] border border-amber-100 bg-[radial-gradient(circle_at_50%_35%,rgb(253_230_138),rgb(217_119_6)_55%,rgb(120_53_15))] shadow-[0_0_12px_rgb(251_191_36/0.75)]"
                        >
                            {null}
                        </Text>
                    </Text>
                    <Text
                        className={`${hudDisplay} text-lg whitespace-nowrap text-pane-ink uppercase`}
                    >
                        Cards
                    </Text>
                    <Text
                        tabular
                        className={`${hudDisplay} min-w-[1ch] animate-hud-slam text-center text-3xl text-red-300 [text-shadow:0_0_14px_rgb(248_113_113/0.7)]`}
                    >
                        5
                    </Text>
                    <Text as="span" className={hudKeyboardKey}>
                        C
                    </Text>
                </Text>
            </Button>
            <Text
                as="div"
                className={`grid min-w-max grid-cols-[1fr_auto_1fr] items-center gap-5 py-2 pr-2 pl-4 ${hudPane}`}
            >
                <Text as="span" className="flex items-center gap-2">
                    <Icon
                        name="coins"
                        className="size-7 text-amber-300 drop-shadow-[0_0_8px_rgb(251_191_36/0.55)]"
                    />
                    <Text
                        tabular
                        className={`${hudDisplay} inline-block animate-hud-bump text-4xl text-amber-100`}
                    >
                        120
                    </Text>
                </Text>
                <Button
                    onPress={ignore}
                    label="Reroll"
                    className="group h-10 min-w-0 rounded-lg border border-menu-accent/50 bg-amber-400/15 bg-none px-3 py-0 text-pane-ink shadow-none inset-shadow-none"
                >
                    <Text as="span" className="flex items-center gap-2">
                        <Icon
                            name="rotate-ccw"
                            className="size-5 text-menu-accent transition-transform duration-300"
                        />
                        <Text className={`${hudDisplay} text-lg uppercase`}>
                            Reroll
                        </Text>
                        <Text
                            tabular
                            className={`${hudDisplay} inline-block animate-hud-bump text-lg text-menu-accent`}
                        >
                            20
                        </Text>
                    </Text>
                </Button>
                <Text as="span" className="flex items-baseline gap-1.5">
                    <Text
                        className={`${hudDisplay} text-base whitespace-nowrap text-pane-ink/85 uppercase`}
                    >
                        Wave 4 in
                    </Text>
                    <Text
                        tabular
                        className={`${hudDisplay} min-w-[1.2ch] animate-hud-slam text-center text-3xl text-red-300 [text-shadow:0_0_14px_rgb(248_113_113/0.7)]`}
                    >
                        3
                    </Text>
                </Text>
            </Text>
        </>
    );
}

/** The run's calls and banners: Announcer.tsx's call and one leaving,
 *  WaveBanner.tsx's wave and countdown, EpicPulls.tsx's line, and
 *  ElementLines.tsx's level call and capstone. */
function CallSamples() {
    const storm = elementClasses[Element.Storm];
    return (
        <>
            <Text as="div" className="flex flex-col items-center gap-1">
                <Text
                    className={`${hudLabel} animate-hud-rise text-sm text-white/75`}
                >
                    Wave 5
                </Text>
                <Text
                    className={`${hudDisplay} animate-hud-slam text-5xl whitespace-nowrap text-red-400 uppercase [text-shadow:0_2px_0_rgb(60_0_0),0_0_24px_rgb(255_60_60/0.55)]`}
                >
                    Swarm
                </Text>
                <Text
                    as="div"
                    className="h-0.5 w-72 animate-hud-sweep bg-linear-to-r from-transparent via-red-400 to-transparent"
                >
                    {null}
                </Text>
                <Text className="animate-hud-rise text-base font-semibold tracking-wide text-white/90 uppercase [animation-delay:200ms]">
                    The Hollow rises
                </Text>
            </Text>
            <Text
                as="div"
                className="flex animate-hud-leave flex-col items-center gap-1"
            >
                <Text
                    className={`${hudDisplay} animate-hud-slam text-2xl whitespace-nowrap text-amber-200 uppercase [text-shadow:0_2px_0_rgb(70_35_0),0_0_24px_rgb(255_177_59/0.55)]`}
                >
                    Wave 4 held
                </Text>
            </Text>
            <Text
                as="div"
                className={`flex min-w-72 flex-col items-center gap-1.5 px-5 pt-2 pb-2.5 ${hudPane}`}
            >
                <Text as="div" className="flex items-center gap-1">
                    <Text
                        as="span"
                        className="size-1.5 rounded-full bg-amber-300/60"
                    >
                        {null}
                    </Text>
                    <Text
                        as="span"
                        className="size-1.5 animate-hud-pulse rounded-full bg-amber-200 shadow-[0_0_8px_rgb(253_230_138/0.9)]"
                    >
                        {null}
                    </Text>
                    <Text
                        as="span"
                        className="size-2.5 rounded-full bg-white/30 ring-1 ring-amber-200/40"
                    >
                        {null}
                    </Text>
                </Text>
                <Text as="div" className="flex items-center gap-3.5">
                    <Text
                        tabular
                        className={`${hudDisplay} min-w-[1.2ch] animate-hud-slam text-center text-5xl text-red-300`}
                    >
                        5
                    </Text>
                    <Text as="div" className="flex w-52 items-center gap-2.5">
                        <Text
                            as="div"
                            className="flex-1 [--color-health-fill:#f87171]"
                        >
                            <Bar
                                label="The wave left"
                                value={12}
                                maximum={30}
                                className="h-2 w-full rounded-sm bg-black/55"
                            />
                        </Text>
                        <Text
                            className={`flex items-baseline gap-1 ${hudBody}`}
                        >
                            <Text
                                tabular
                                className={`${hudDisplay} inline-block animate-hud-bump text-base text-red-200`}
                            >
                                12
                            </Text>
                            left
                        </Text>
                    </Text>
                </Text>
                <Text as="div" className="flex items-baseline gap-3">
                    <Text
                        className={`${hudDisplay} text-2xl whitespace-nowrap text-pane-ink uppercase`}
                    >
                        Wave 6 in
                    </Text>
                    <Text
                        tabular
                        className={`${hudDisplay} min-w-[1.2ch] animate-hud-slam text-center text-5xl text-red-300 [text-shadow:0_0_18px_rgb(248_113_113/0.7)]`}
                    >
                        3
                    </Text>
                </Text>
                <Text
                    as="div"
                    className="flex animate-hud-rise items-center gap-2"
                >
                    <Icon
                        name="zap"
                        className="size-5 shrink-0 text-lime-300"
                    />
                    <Text
                        className={`${hudDisplay} text-lg whitespace-nowrap text-lime-300 uppercase`}
                    >
                        Next: Swarm
                    </Text>
                </Text>
            </Text>
            <Text
                as="span"
                className="card-pull relative flex items-center gap-2 overflow-hidden rounded-full border border-amber-200/60 bg-[linear-gradient(90deg,rgb(88_28_135/0.95),rgb(162_28_175/0.9),rgb(124_58_237/0.95))] py-1.5 pr-4 pl-2 text-sm font-semibold text-white shadow-[0_0_24px_rgb(217_70_239/0.55)]"
            >
                <Glint className="size-5 text-amber-200" />
                <Text className="font-bold text-teal-300">Ada</Text>
                <Text
                    className={`${hudDisplay} text-base tracking-[0.2em] text-amber-200`}
                >
                    EPIC
                </Text>
                <Text className={`${hudDisplay} text-base`}>Thunderhead</Text>
            </Text>
            <Text
                as="div"
                className="flex animate-line-call flex-col items-center gap-1"
            >
                <Text className={`${hudLabel} text-sm text-white/80`}>
                    Storm II
                </Text>
                <Text
                    className={`${hudDisplay} text-5xl whitespace-nowrap uppercase ${storm.text} ${storm.glow}`}
                >
                    Forked Storm
                </Text>
            </Text>
            <Text
                as="span"
                className="size-40 animate-capstone-flash bg-[radial-gradient(ellipse_at_center,rgb(255_228_92/0.42),rgb(255_228_92/0.1)_45%,transparent_75%)]"
            >
                {null}
            </Text>
            <Text
                as="div"
                className="flex animate-capstone flex-col items-center gap-2"
            >
                <Text
                    as="div"
                    className={`relative flex size-24 items-center justify-center ${storm.text}`}
                >
                    <Text
                        as="span"
                        className="absolute -inset-24 animate-capstone-rays rounded-full bg-[repeating-conic-gradient(rgb(255_228_92/0.5)_0deg_6deg,transparent_6deg_22deg)] [mask-image:radial-gradient(circle,black_18%,transparent_68%)]"
                    >
                        {null}
                    </Text>
                    <ElementBadge
                        element={Element.Storm}
                        className="relative size-20 drop-shadow-[0_0_24px_currentColor]"
                    />
                </Text>
                <Text
                    className={`${hudDisplay} text-7xl whitespace-nowrap uppercase ${storm.text} ${storm.glow}`}
                >
                    Shatter
                </Text>
                <Text
                    as="div"
                    className={`h-0.5 w-80 animate-hud-sweep bg-linear-to-r from-transparent via-current to-transparent ${storm.text}`}
                >
                    {null}
                </Text>
            </Text>
        </>
    );
}

/** The fight's marks: HitMarker.tsx's hit, kill and weak-spot marks,
 *  DamageNumbers.tsx's numbers, ReactionWords.tsx's word and
 *  ElementLines.tsx's points landing on a line. */
function FightSamples() {
    const storm = elementClasses[Element.Storm];
    const tick = tickShape;
    const { hit, kill, critical } = tickLooks;
    const number = `block ${numberClasses}`;
    return (
        <>
            <Text as="div" className="relative size-10">
                <Text
                    as="div"
                    className="absolute top-1/2 left-1/2 size-0 animate-hit-mark"
                >
                    <Text
                        as="span"
                        className={`${tick} [transform:rotate(45deg)_translateX(7px)] ${hit}`}
                    >
                        {null}
                    </Text>
                    <Text
                        as="span"
                        className={`${tick} [transform:rotate(225deg)_translateX(7px)] ${hit}`}
                    >
                        {null}
                    </Text>
                </Text>
            </Text>
            <Text as="div" className="relative size-10">
                <Text
                    as="div"
                    className="absolute top-1/2 left-1/2 size-0 animate-kill-mark"
                >
                    <Text
                        as="span"
                        className="absolute -top-3.5 -left-3.5 block size-7 animate-kill-ring rounded-full border-2 border-red-500/90"
                    >
                        {null}
                    </Text>
                    <Text
                        as="span"
                        className={`${tick} [transform:rotate(45deg)_translateX(8px)] ${kill}`}
                    >
                        {null}
                    </Text>
                    <Text
                        as="span"
                        className={`${tick} [transform:rotate(225deg)_translateX(8px)] ${kill}`}
                    >
                        {null}
                    </Text>
                </Text>
            </Text>
            <Text as="div" className="relative size-10">
                <Text
                    as="div"
                    className="absolute top-1/2 left-1/2 size-0 animate-crit-mark"
                >
                    <Text
                        as="span"
                        className={`${tick} [transform:rotate(45deg)_translateX(8px)] ${critical}`}
                    >
                        {null}
                    </Text>
                    <Text
                        as="span"
                        className={`${tick} [transform:rotate(225deg)_translateX(8px)] ${critical}`}
                    >
                        {null}
                    </Text>
                </Text>
            </Text>
            <Text
                as="span"
                className={`${number} ${readNumberLook(12, false, false)}`}
            >
                12
            </Text>
            <Text
                as="span"
                className={`${number} ${readNumberLook(48, true, false)}`}
            >
                48
            </Text>
            <Text
                as="span"
                className={`${number} ${readNumberLook(4, false, true)}`}
            >
                4
            </Text>
            <Text
                as="div"
                className="flex animate-reaction-word flex-col items-center gap-1"
            >
                <Text
                    as="div"
                    className={`${hudDisplay} flex items-baseline gap-2 text-5xl whitespace-nowrap text-yellow-200 uppercase [text-shadow:0_0_14px_rgb(125_211_252/0.95),0_0_32px_rgb(253_224_71/0.7),0_3px_0_rgb(0_0_0/0.85)]`}
                >
                    Chain Shock
                    <Text as="span" className="text-3xl text-white">
                        ×3
                    </Text>
                </Text>
                <Text
                    as="div"
                    className="flex items-center gap-1.5 text-base font-bold whitespace-nowrap [text-shadow:0_2px_0_rgb(0_0_0/0.85),0_0_8px_rgb(0_0_0/0.7)]"
                >
                    <Text as="span" className="text-teal-300">
                        Ada
                    </Text>
                </Text>
            </Text>
            <Text
                as="div"
                className="relative w-48 [--color-health-fill:#ffe45c]"
            >
                <Bar
                    label="Line"
                    value={4}
                    maximum={9}
                    className="h-3 w-full rounded-sm bg-black/55 ring-1 ring-white/10"
                />
                <Text
                    as="span"
                    className="pointer-events-none absolute -inset-0.5 animate-line-gain rounded-sm bg-white/70 shadow-[0_0_14px_rgb(255_255_255/0.8)]"
                >
                    {null}
                </Text>
                <Text
                    className={`${hudDisplay} pointer-events-none absolute inset-x-0 -top-2 animate-line-added text-center text-2xl ${storm.text} ${storm.glow}`}
                >
                    +2
                </Text>
            </Text>
        </>
    );
}

/** Her own panels as a run turns: Controls.tsx's strip leaving,
 *  UsePrompt.tsx's prompt, Downed.tsx's panel, Vitals.tsx's hit flash and
 *  low health, a card landing on her panel as CardFlights.tsx lights it,
 *  Scoreboard.tsx's row flashes, and Dawn.tsx's and RunOver.tsx's end
 *  screens. */
function PanelSamples() {
    return (
        <>
            <Text
                as="div"
                className={`flex items-center pointer-coarse:hidden gap-5 px-4 py-2 ${hudBody} ${hudPane} animate-hud-leave`}
            >
                <Text
                    as="span"
                    className="flex items-center gap-2 opacity-45 transition-opacity duration-300"
                >
                    <Text as="span" className="flex items-center gap-0.5">
                        {["W", "A", "S", "D"].map((key) => (
                            <Text
                                as="span"
                                key={key}
                                className={`${hudKey} size-6 text-sm`}
                            >
                                {key}
                            </Text>
                        ))}
                    </Text>
                    Move
                    <Icon
                        name="check"
                        className="size-4 animate-hud-slam text-emerald-300"
                    />
                </Text>
                <Text
                    as="span"
                    className="flex items-center gap-2 transition-opacity duration-300"
                >
                    Hold to fire
                </Text>
            </Text>
            <Button
                onPress={ignore}
                label="Feed the fire"
                className={`flex animate-hud-rise items-center gap-3 py-2.5 pr-5 pl-3 text-left inset-shadow-none ${hudPane} hover:shadow-[0_0_0_1px_rgb(255_177_59/0.6),0_0_28px_rgb(255_177_59/0.35)]`}
            >
                <Text as="span" className={hudKey}>
                    E
                </Text>
                <Text
                    className={`${hudDisplay} text-2xl text-pane-ink uppercase`}
                >
                    Feed the fire
                </Text>
                <Text
                    as="span"
                    className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5"
                >
                    <Icon name="coins" className="size-4 text-menu-accent" />
                    <Text className={`${hudDisplay} text-xl text-menu-accent`}>
                        10
                    </Text>
                </Text>
            </Button>
            <Text
                as="div"
                className={`flex w-80 animate-hud-rise flex-col items-center gap-2 px-7 pt-4 pb-5 ${hudPane} border-danger/40 shadow-[0_0_48px_rgb(220_38_38/0.25)]`}
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
                <Text
                    as="div"
                    className="w-full rounded-md shadow-[0_0_14px_rgb(252_211_77/0.55)] transition-shadow duration-300 [--color-health-fill:#fcd34d]"
                >
                    <Bar
                        label="Getting up"
                        value={2}
                        maximum={5}
                        className="h-4 w-full rounded-md bg-black/55 ring-1 ring-white/10"
                    />
                </Text>
            </Text>
            <Text
                as="div"
                className={`relative flex w-80 flex-col items-stretch gap-2.5 overflow-hidden py-3 pr-4 pl-5 ${hudPane}`}
            >
                <Text
                    as="span"
                    className="pointer-events-none absolute inset-0 animate-hud-flash bg-red-500/40"
                >
                    {null}
                </Text>
                <Text as="div" className="flex items-baseline gap-1">
                    <Icon
                        name="heart"
                        className="size-5 self-center text-danger"
                    />
                    <Text
                        className={`${hudDisplay} animate-hud-pulse text-3xl text-danger`}
                    >
                        18
                    </Text>
                </Text>
                <Text as="div" className="flex items-center gap-1">
                    <Text
                        as="span"
                        className="flex animate-hud-bump items-center gap-0.5 rounded-md border border-menu-accent/25 bg-amber-400/10 py-0.5 pr-1.5 pl-1 [animation-delay:450ms]"
                    >
                        <Icon
                            name="swords"
                            className="size-3.5 text-menu-accent"
                        />
                        <Text className={`${hudDisplay} text-sm text-pane-ink`}>
                            2
                        </Text>
                    </Text>
                </Text>
            </Text>
            <Text
                as="div"
                className={`card-taken flex items-center gap-2 px-4 py-2 ${hudPane}`}
            >
                <ElementBadge
                    element={Element.Storm}
                    className={`size-4 ${elementClasses[Element.Storm].text}`}
                />
                <Text className={`${hudDisplay} text-base uppercase`}>
                    Storm
                </Text>
            </Text>
            <Text
                as="div"
                className="relative flex w-72 items-center gap-1.5 overflow-hidden rounded-md bg-red-500/15 py-1 pr-2 pl-1.5"
            >
                <Text
                    as="span"
                    className="pointer-events-none absolute inset-0 animate-hud-flash bg-[linear-gradient(90deg,rgb(162_28_175/0.75),rgb(251_191_36/0.5),transparent)]"
                >
                    {null}
                </Text>
                <Text
                    as="span"
                    className="pointer-events-none absolute inset-0 animate-hud-flash bg-red-500/50"
                >
                    {null}
                </Text>
                <Text className="min-w-0 truncate font-bold text-teal-300">
                    Ada
                </Text>
                <Text className={`${hudTag} ml-auto bg-red-500/85 text-white`}>
                    Down
                </Text>
            </Text>
            <Text
                as="span"
                className="size-24 bg-[radial-gradient(ellipse_120%_70%_at_50%_110%,rgb(255_170_90/38%),transparent_70%),radial-gradient(ellipse_at_center,rgb(30_18_10/25%),rgb(12_8_6/62%))]"
            >
                {null}
            </Text>
            <Text
                as="span"
                className="size-24 bg-[radial-gradient(ellipse_at_center,rgb(20_10_18/55%),rgb(8_4_10/88%))]"
            >
                {null}
            </Text>
            <Text
                as="div"
                className={`dawn-pane flex w-80 animate-hud-rise flex-col items-stretch gap-3.5 overflow-y-auto px-7 pt-4 pb-6 ${hudPane}`}
            >
                <Text as="div" className="flex flex-col items-center gap-1">
                    <Icon
                        name="trophy"
                        className="size-7 text-amber-200 drop-shadow-[0_0_12px_rgb(253_230_138/0.8)]"
                    />
                    <Text
                        className={`${hudDisplay} animate-hud-slam text-6xl text-amber-200 uppercase [text-shadow:0_2px_0_rgb(90_45_0),0_0_32px_rgb(255_190_90/0.7)]`}
                    >
                        Dawn
                    </Text>
                    <Text
                        as="div"
                        className="h-0.5 w-72 animate-hud-sweep bg-linear-to-r from-transparent via-amber-200 to-transparent"
                    >
                        {null}
                    </Text>
                </Text>
                <Text
                    className={`${hudDisplay} text-center text-5xl text-amber-200 [text-shadow:0_0_24px_rgb(255_177_59/0.45)]`}
                >
                    15
                </Text>
                <RunEndShade />
            </Text>
        </>
    );
}

/** One copy of each effect the HUD shows once play starts, drawn out of
 *  sight under the loading screen so none builds its GPU program in play.
 *  Gone once the screen lifts. */
export function HoldfastWarmHud() {
    return (
        <WarmHud>
            <CardSamples />
            <Text
                as="div"
                className="fixed inset-0 flex flex-wrap content-start items-start gap-3 p-3"
            >
                <OfferSamples />
                <CallSamples />
                <FightSamples />
                <PanelSamples />
            </Text>
        </WarmHud>
    );
}
