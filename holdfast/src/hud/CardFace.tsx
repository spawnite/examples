import { useEffect, useRef } from "react";
import { Button, Icon, type IconName, Text } from "@spawnite/engine";
import { CardId, isCardId, type Card } from "../siege/cards";
import { Rarity } from "../siege/traits";
import { elementClasses } from "../views/palette";
import { burstClasses, dealClasses } from "./cardReveal";
import { readCardText } from "./cardText";
import { ElementBadge, elementJobs, ElementScene } from "./ElementArt";
import { hudDisplay, hudKeyboardKey, hudTag } from "./look";
import { isStill } from "./still";

//  One card of the offer: its back, which it is dealt on, and its face,
//  which it turns to in its reveal; its frame and its light by its rarity.
//  styles.css holds the reveal's animations, which the classes named
//  card-* here take part in.

/** Each stat card's picture, by what it changes. An element's card draws
 *  its element instead. */
const cardIcons: Partial<Record<CardId, IconName>> = {
    [CardId.HeavyRounds]: "swords",
    [CardId.HairTrigger]: "zap",
    [CardId.FleetFoot]: "arrow-big-right",
    [CardId.IronHeart]: "shield",
    [CardId.MidasTouch]: "coins",
    [CardId.SecondWind]: "rotate-ccw",
    [CardId.FieldMedic]: "heart",
    [CardId.StormLance]: "gem",
    [CardId.Marksman]: "target",
    [CardId.Attunement]: "flame",
};

/** A card's picture, or a plain one for an id the deck does not know. */
export function readCardIcon(id: string): IconName {
    return (isCardId(id) && cardIcons[id]) || "star";
}

/** How each rarity looks: its frame and face, the color of its number,
 *  its band, the chip that says why, its price where her purse meets it
 *  and where it does not, its ring and sparks as it turns, and the light
 *  through its back before it does. Three colours for three rarities:
 *  stone grey, blue, and violet with gold. Written whole, because Tailwind
 *  emits only the classes it reads. */
interface RarityLook {
    frame: string;
    face: string;
    amount: string;
    band: string;
    chip: string;
    price: string;
    priceIcon: string;
    priceShort: string;
    ring: string;
    sparks: string[];
    backGlow: string;
}

export const rarityLooks: Record<Rarity, RarityLook> = {
    [Rarity.Common]: {
        frame: "border-stone-400/80 ring-1 ring-stone-300/25 ring-inset hover:border-amber-300 hover:shadow-[0_0_0_1px_rgb(255_177_59/0.6),0_0_28px_rgb(255_177_59/0.35)]",
        face: "bg-menu-surface",
        amount: "text-amber-100",
        band: "bg-[linear-gradient(90deg,#57534e,#78716c,#57534e)] text-stone-50",
        chip: "",
        price: "border-stone-300/70 bg-stone-500/40 text-stone-50 shadow-[0_0_12px_rgb(168_162_158/0.4)]",
        priceIcon: "text-stone-200",
        priceShort: "border-stone-400/25",
        ring: "",
        sparks: [],
        backGlow: "",
    },
    [Rarity.Rare]: {
        frame: "border-blue-400/80 shadow-[0_0_24px_rgb(59_130_246/0.45)] hover:border-blue-300 hover:shadow-[0_0_0_1px_rgb(147_197_253/0.8),0_0_40px_rgb(59_130_246/0.65)]",
        face: "bg-[linear-gradient(180deg,rgb(37_99_235/0.45),rgb(2_6_23/0.93)_58%)]",
        amount: "text-blue-100 [text-shadow:0_0_18px_rgb(59_130_246/0.95),0_3px_0_rgb(0_0_0/0.7)]",
        band: "bg-[linear-gradient(90deg,#1d4ed8,#3b82f6,#1d4ed8)] text-white",
        chip: "border-blue-300/40 bg-blue-500/20 text-blue-50",
        price: "border-blue-300/80 bg-blue-500/35 text-blue-50 shadow-[0_0_14px_rgb(59_130_246/0.55)]",
        priceIcon: "text-blue-200",
        priceShort: "border-blue-400/30",
        ring: "border-blue-300",
        sparks: ["bg-blue-300", "bg-white", "bg-sky-300"],
        backGlow:
            "bg-[radial-gradient(circle_at_50%_50%,rgb(191_219_254/0.95),rgb(59_130_246/0.7)_35%,rgb(30_58_138/0.4)_70%,transparent)]",
    },
    [Rarity.Epic]: {
        frame: "border-transparent shadow-[0_0_34px_rgb(217_70_239/0.6),0_0_80px_rgb(168_85_247/0.35)] hover:shadow-[0_0_44px_rgb(217_70_239/0.8),0_0_100px_rgb(251_191_36/0.35)]",
        face: "bg-[radial-gradient(130%_75%_at_50%_0%,rgb(217_70_239/0.55),rgb(91_33_182/0.62)_45%,rgb(2_6_23/0.95)_85%)]",
        amount: "text-amber-200 [text-shadow:0_0_20px_rgb(251_191_36/0.9),0_0_40px_rgb(217_70_239/0.8),0_3px_0_rgb(0_0_0/0.7)]",
        band: "card-band-epic bg-[linear-gradient(90deg,#a21caf,#7c3aed,#f59e0b,#d946ef,#a21caf)] text-white [text-shadow:0_1px_0_rgb(0_0_0/0.6)]",
        chip: "border-amber-200/50 bg-fuchsia-500/25 text-amber-50",
        price: "border-fuchsia-300/80 bg-fuchsia-500/35 text-amber-50 shadow-[0_0_14px_rgb(217_70_239/0.55)]",
        priceIcon: "text-amber-300",
        priceShort: "border-fuchsia-400/30",
        ring: "border-amber-200",
        sparks: ["bg-amber-300", "bg-fuchsia-300", "bg-white", "bg-yellow-200"],
        backGlow:
            "bg-[radial-gradient(circle_at_50%_45%,rgb(254_243_199),rgb(251_191_36/0.9)_14%,rgb(217_70_239/0.9)_34%,rgb(88_28_135/0.85)_65%,rgb(24_8_40/0.6))]",
    },
};

/** Sparks a turning card throws; styles.css sets where each flies. */
const sparkCount = 16;

/** The nine cells over a card's face, row by row, each of which tilts
 *  the card toward itself under the pointer; styles.css sets each tilt. */
const tiltCells = ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"];

/** Motes that rise off a waiting epic; styles.css sets where and when. */
const moteCount = 5;

/** A four-pointed star, for a spark, a mote and the card's back. */
export function Glint({ className }: { className: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
            <path
                d="M12 0c.9 6.4 4.9 10.6 12 12-7.1 1.4-11.1 5.6-12 12-.9-6.4-4.9-10.6-12-12C7.1 10.6 11.1 6.4 12 0z"
                fill="currentColor"
            />
        </svg>
    );
}

/** What stands behind and around a rare or an epic card as it turns: the
 *  gold rays and the halo behind an epic, the ring and the sparks from
 *  both, and the motes that rise off an epic while it waits. */
function RevealBurst({ rarity }: { rarity: Rarity }) {
    const look = rarityLooks[rarity];
    return (
        <>
            {rarity === Rarity.Epic && (
                <>
                    <Text
                        as="span"
                        className="card-rays pointer-events-none absolute top-1/2 left-1/2 -z-10 -mt-[240px] -ml-[240px] size-[480px] rounded-full bg-[repeating-conic-gradient(rgb(253_224_71/0.6)_0deg_5deg,transparent_5deg_20deg)] mask-[radial-gradient(circle,#000_14%,transparent_50%)]"
                    >
                        {null}
                    </Text>
                    <Text
                        as="span"
                        className="card-halo pointer-events-none absolute -inset-6 -z-10 rounded-[48px] bg-[radial-gradient(closest-side,rgb(251_191_36/0.45),rgb(217_70_239/0.35)_45%,transparent)]"
                    >
                        {null}
                    </Text>
                    <Text
                        as="span"
                        className="card-motes pointer-events-none absolute inset-x-0 bottom-8 h-0"
                    >
                        {Array.from({ length: moteCount }, (_, index) => (
                            <Text
                                as="span"
                                key={index}
                                className="absolute bottom-0 text-amber-200"
                            >
                                <Glint className="size-3" />
                            </Text>
                        ))}
                    </Text>
                </>
            )}
            <Text
                as="span"
                className={`card-ring pointer-events-none absolute inset-0 rounded-xl border-2 ${look.ring}`}
            >
                {null}
            </Text>
            <Text
                as="span"
                className="card-sparks pointer-events-none absolute top-1/2 left-1/2 z-20 size-0"
            >
                {Array.from({ length: sparkCount }, (_, index) => (
                    <Text
                        as="span"
                        key={index}
                        className={`card-spark absolute -top-2 -left-2 size-4 [clip-path:polygon(50%_0,62%_38%,100%_50%,62%_62%,50%_100%,38%_62%,0_50%,38%_38%)] ${look.sparks[index % look.sparks.length]}`}
                    >
                        {null}
                    </Text>
                ))}
            </Text>
        </>
    );
}

/** The back a card is dealt on: the game's star in a double frame, its key,
 *  and, on a rare or an epic, its color glowing through before it turns. */
function CardBack({ slot, rarity }: { slot: number; rarity: Rarity }) {
    const look = rarityLooks[rarity];
    return (
        <Text
            as="span"
            className="card-back pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-xl border border-amber-200/40 bg-stone-950 bg-[radial-gradient(circle_at_50%_40%,rgb(120_53_15/0.9),rgb(28_25_23)_60%,rgb(12_10_9))]"
        >
            <Text
                as="span"
                className="absolute inset-2 rounded-lg border border-amber-200/25 bg-[repeating-linear-gradient(45deg,rgb(253_230_138/0.05)_0_2px,transparent_2px_10px)]"
            >
                {null}
            </Text>
            {rarity !== Rarity.Common && (
                <Text
                    as="span"
                    className={`card-back-glow absolute inset-0 ${look.backGlow}`}
                >
                    {null}
                </Text>
            )}
            <Text
                as="span"
                className="relative flex size-20 items-center justify-center rounded-full border border-amber-200/40 text-amber-200"
            >
                <Glint className="size-12 drop-shadow-[0_0_10px_rgb(251_191_36/0.7)]" />
            </Text>
            <Text
                as="span"
                className={`${hudKeyboardKey} absolute top-3 left-3`}
            >
                {slot + 1}
            </Text>
        </Text>
    );
}

interface CardPriceProps {
    cost: number;
    coins: number;
    rarity: Rarity;
}

/** A card's price, top right: Free, glowing, or its coins in its rarity's
 *  colour where her purse meets it, and locked where it is short. */
function CardPrice({ cost, coins, rarity }: CardPriceProps) {
    if (cost === 0)
        return (
            <Text
                className={`${hudTag} animate-hud-pulse border border-emerald-300/70 bg-emerald-400/25 text-emerald-100 shadow-[0_0_14px_rgb(52_211_153/0.55)]`}
            >
                Free
            </Text>
        );
    const short = coins < cost;
    const look = rarityLooks[rarity] ?? rarityLooks[Rarity.Common];
    return (
        <Text
            as="span"
            aria-label={
                short
                    ? `${cost} coins, ${cost - coins} more than you hold`
                    : `${cost} coins`
            }
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${short ? `${look.priceShort} bg-black/50 text-white/50` : look.price}`}
        >
            <Icon
                name={short ? "lock" : "coins"}
                className={`size-3.5 ${short ? "" : look.priceIcon}`}
            />
            <Text className={`${hudDisplay} text-base`}>{cost}</Text>
        </Text>
    );
}

export interface CardFaceProps {
    id: string;
    card: Card;
    rarity: Rarity;
    slot: number;
    /** When it turns face up, in milliseconds after the offer opens. */
    burst: number;
    /** Times she has taken it before this one. */
    held: number;
    /** Whether she took it from this offer: the element she holds while
     *  the wardens gather. */
    taken: boolean;
    /** Whether she took it for coins rather than free. */
    bought?: boolean;
    /** Whether another card of the offer is the one she holds. */
    passed: boolean;
    /** What it costs her: 0 for a free card, coins for one she buys, and
     *  none for an element's pick. */
    cost?: number;
    /** The coins she holds, which a cost is read against. */
    coins: number;
    onPick: (slot: number) => void;
}

/** The face of an element's own card: its job as a picture, its name and
 *  its job in its color, and what it does. */
function ElementFace({ card, taken }: Pick<CardFaceProps, "card" | "taken">) {
    const element = card.element;
    if (!element) return null;
    const classes = elementClasses[element];
    return (
        <Text
            as="span"
            className="card-face-body flex w-full flex-1 flex-col items-center gap-2 px-3 pb-4"
        >
            <Text
                as="span"
                className={`card-picture flex h-24 w-full items-end justify-center rounded-lg border ${classes.fill} ${classes.text}`}
            >
                <ElementScene element={element} className="h-20 w-32" />
            </Text>
            <Text
                className={`card-title ${hudDisplay} mt-1 text-center text-[1.75rem] tracking-normal uppercase ${classes.text} ${classes.glow}`}
            >
                {card.title}
            </Text>
            <Text
                className={`card-job ${hudTag} border ${classes.fill} ${classes.text}`}
            >
                {elementJobs[element]}
            </Text>
            <Text className="card-line text-center text-sm leading-snug font-medium text-white/90">
                {card.text(1)}
            </Text>
            <Text
                className={`mt-auto pt-1 text-[0.6875rem] font-bold tracking-[0.2em] uppercase ${taken ? classes.text : "text-white/45"}`}
            >
                {taken ? "Your element" : "Element"}
            </Text>
        </Text>
    );
}

/** The face of any other card: its picture, or an element card's badge,
 *  its name, its number large with what it raises, what it does, why a
 *  rare or an epic is bigger, and its rarity on a band. */
function StatFace({
    id,
    card,
    rarity,
}: Pick<CardFaceProps, "id" | "card" | "rarity">) {
    const look = rarityLooks[rarity] ?? rarityLooks[Rarity.Common];
    const element = card.line;
    const text = isCardId(id)
        ? readCardText(id, rarity)
        : { line: card.text(1) };
    return (
        <Text as="span" className="flex w-full flex-1 flex-col items-stretch">
            <Text
                as="span"
                className="card-face-body flex w-full flex-1 flex-col items-center gap-1.5 px-3 pb-3"
            >
                <Text
                    as="span"
                    className={`card-picture relative flex size-14 items-center justify-center rounded-full border transition-colors ${element ? `${elementClasses[element].fill} ${elementClasses[element].text}` : "border-amber-200/30 bg-amber-400/15 group-hover:border-amber-300 group-hover:bg-amber-400/30"}`}
                >
                    {element ? (
                        <ElementBadge element={element} className="size-7" />
                    ) : (
                        <Icon
                            name={readCardIcon(id)}
                            className="size-7 text-amber-200"
                        />
                    )}
                </Text>
                <Text
                    className={`card-title ${hudDisplay} text-center text-[1.375rem] tracking-normal uppercase ${element ? elementClasses[element].text : "text-amber-50"}`}
                >
                    {card.title}
                </Text>
                {text.amount && (
                    <Text as="span" className="flex flex-col items-center">
                        <Text
                            className={`card-amount ${hudDisplay} text-5xl tracking-normal ${look.amount}`}
                        >
                            {text.amount}
                        </Text>
                        <Text className="mt-1 text-[0.6875rem] font-bold tracking-[0.18em] text-white/75 uppercase">
                            {text.stat}
                        </Text>
                    </Text>
                )}
                <Text className="card-line text-center text-sm leading-snug font-medium text-white/90">
                    {text.line}
                </Text>
                {text.why && (
                    <Text
                        className={`card-why mt-auto rounded-md border px-2 py-1 text-center text-xs leading-tight font-semibold ${look.chip}`}
                    >
                        {text.why}
                    </Text>
                )}
            </Text>
            <Text
                className={`${hudDisplay} mt-auto py-1.5 text-center text-sm tracking-[0.3em] uppercase ${look.band}`}
            >
                {rarity}
            </Text>
        </Text>
    );
}

/** A card's shake as her purse falls short of it, before it greys. */
const shortShake: Keyframe[] = [
    { transform: "translateX(0)" },
    { transform: "translateX(-7px) rotate(-1.5deg)" },
    { transform: "translateX(6px) rotate(1deg)" },
    { transform: "translateX(-4px)" },
    { transform: "translateX(2px)" },
    { transform: "translateX(0)" },
];

/** Milliseconds the shake takes; the grey waits for it. */
const shakeMilliseconds = 360;

/** Shakes the hand's card that carries the class `hook` once as `short`
 *  turns true: a card her purse met a moment ago and meets no more. */
function useShortShake(short: boolean, hook: string) {
    const wasRef = useRef(short);
    useEffect(() => {
        const was = wasRef.current;
        wasRef.current = short;
        const element = document.querySelector(`.card-row .${hook}`);
        if (!short || was || !element || isStill()) return;
        if (typeof element.animate !== "function") return;
        element.animate(shortShake, {
            duration: shakeMilliseconds,
            easing: "ease-out",
        });
    }, [short, hook]);
}

/** One card of the offer: dealt face down in its turn, turned in its
 *  reveal, then held in the hand, where it leans toward the pointer and
 *  catches the light. An element's pick wears its color's frame, any other
 *  card its rarity's, with its key, how many of it she holds and its
 *  price. */
export function CardFace({
    id,
    card,
    rarity,
    slot,
    burst,
    held,
    taken,
    bought = false,
    passed,
    cost,
    coins,
    onPick,
}: CardFaceProps) {
    const pick = card.element;
    const shown = pick ? Rarity.Common : rarity;
    //  A card of the hand she took or bought steps back once stamped, and
    //  one her purse cannot meet is greyed, so the cards she can still buy
    //  stand out.
    const spent = taken && !pick;
    const short = !taken && cost !== undefined && cost > coins;
    const shakeHook = `card-tilt-${id}`;
    useShortShake(short, shakeHook);
    const look = rarityLooks[shown] ?? rarityLooks[Rarity.Common];
    const timing = `${dealClasses[slot] ?? dealClasses[0]} ${burstClasses[burst] ?? ""}`;
    const rarityClass =
        shown === Rarity.Epic
            ? "card-epic"
            : shown === Rarity.Rare
              ? "card-rare z-[1]"
              : "z-[1]";
    return (
        <Text
            as="span"
            className={`card-deal relative isolate flex ${timing} ${rarityClass}`}
        >
            {shown !== Rarity.Common && <RevealBurst rarity={shown} />}
            <Text as="span" className="card-pop flex">
                <Text as="span" className="card-flip relative flex">
                    {spent && (
                        <Text
                            as="span"
                            className={`card-bought-band pointer-events-none absolute inset-x-[-0.5rem] top-[38%] z-40 -rotate-6 border-y-2 py-1.5 text-center ${hudDisplay} text-2xl tracking-[0.2em] uppercase shadow-[0_6px_18px_rgb(0_0_0/0.55)] ${bought ? "border-amber-200 bg-amber-400 text-slate-950" : "border-emerald-200 bg-emerald-400 text-slate-950"}`}
                        >
                            {bought ? "Bought" : "Taken"}
                        </Text>
                    )}
                    <Text
                        as="span"
                        className={`card-tilt ${shakeHook} flex transition-[opacity,filter,translate] duration-300 ${passed ? "opacity-60 hover:opacity-100" : ""} ${spent ? "translate-y-3 opacity-45 brightness-80 grayscale-[0.7] delay-[480ms]" : ""} ${short ? "brightness-[0.8] saturate-50 delay-[360ms] hover:brightness-95 hover:delay-0" : ""}`}
                    >
                        <Button
                            onPress={() => onPick(slot)}
                            keyShortcuts={String(slot + 1)}
                            className={`card-face group relative h-auto min-h-72 w-48 flex-col items-stretch *:flex-1 *:items-stretch justify-start overflow-hidden rounded-xl border bg-none p-0 text-left whitespace-normal shadow-[0_12px_30px_rgb(0_0_0/0.55)] inset-shadow-none backdrop-blur-md hover:-translate-y-2 2xl:w-52 ${pick ? `bg-menu-surface ${elementClasses[pick].frame}` : `${look.face} ${look.frame}`} ${taken ? "card-taken -translate-y-2" : ""}`}
                        >
                            {shown === Rarity.Epic && (
                                <Text
                                    as="span"
                                    className="card-edge pointer-events-none absolute inset-0 rounded-xl"
                                >
                                    {null}
                                </Text>
                            )}
                            {shown !== Rarity.Common && (
                                <Text
                                    as="span"
                                    className="card-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.3),transparent)]"
                                >
                                    {null}
                                </Text>
                            )}
                            <Text
                                as="span"
                                className="card-glint pointer-events-none absolute inset-y-0 left-0 z-10 w-1/4 opacity-0 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.35),transparent)]"
                            >
                                {null}
                            </Text>
                            <Text
                                as="span"
                                className="relative flex w-full flex-1 flex-col items-stretch"
                            >
                                <Text
                                    as="span"
                                    className="card-face-head flex w-full items-center justify-between px-3 pt-3 pb-2"
                                >
                                    <Text as="span" className={hudKeyboardKey}>
                                        {slot + 1}
                                    </Text>
                                    {held > 0 && (
                                        <Text
                                            className={`${hudTag} mr-auto ml-2 whitespace-nowrap bg-amber-300/15 text-amber-200`}
                                        >
                                            Held ×{held}
                                        </Text>
                                    )}
                                    {taken ? (
                                        <Text
                                            as="span"
                                            className="card-stamp flex size-6 items-center justify-center rounded-full bg-emerald-400 text-slate-950"
                                        >
                                            <Icon
                                                name="check"
                                                className="size-4"
                                            />
                                        </Text>
                                    ) : (
                                        cost !== undefined && (
                                            <CardPrice
                                                cost={cost}
                                                coins={coins}
                                                rarity={shown}
                                            />
                                        )
                                    )}
                                </Text>
                                {pick ? (
                                    <ElementFace card={card} taken={taken} />
                                ) : (
                                    <StatFace
                                        id={id}
                                        card={card}
                                        rarity={rarity}
                                    />
                                )}
                            </Text>
                            <Text
                                as="span"
                                className="absolute inset-0 z-20 grid grid-cols-3 grid-rows-3"
                            >
                                {tiltCells.map((cell) => (
                                    <Text
                                        as="span"
                                        key={cell}
                                        className="card-cell"
                                    >
                                        {null}
                                    </Text>
                                ))}
                            </Text>
                            <CardBack slot={slot} rarity={shown} />
                        </Button>
                    </Text>
                </Text>
            </Text>
        </Text>
    );
}
