import { useQueryFirst, useTrait } from "koota/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    AuthorityTrait,
    HeroTrait,
    Hud,
    Icon,
    Panel,
    PanelVariant,
    Slot,
    Text,
} from "@spawnite/engine";
import { playSound, Sound } from "../audio/sounds";
import { readCard, readCardPrice } from "../siege/cards";
import { type CardOffer, Rarity, WardenTrait } from "../siege/traits";
import { elementClasses } from "../views/palette";
import { rarityLooks, readCardIcon } from "./CardFace";
import {
    flightTargetClasses,
    readFlightTarget,
    readNewCards,
} from "./cardFlight";
import { ElementBadge } from "./ElementArt";
import { hudDisplay } from "./look";
import { shopPurseClass } from "./ShopBar";
import { isStill } from "./still";
import { purseClass } from "./Vitals";

//  Each card she takes or buys, free or for coins, flies out of its place
//  in the hand to where it lands: an element card to its element's line,
//  any other to the chips of her cards. Where it lands lights as it
//  arrives, and a bought card's coins rise off her coin count: the shop
//  bar's while it shows, her health panel's otherwise. The flights read
//  the page's layout as each starts, so a card lands on its line at any
//  screen size.

/** Milliseconds a card flies: its line lights and pops its points as it
 *  lands, 450 ms after the card is taken (styles.css). */
export const flightMilliseconds = 480;

/** A rarity's landing chime, higher for a rarer card. */
const landPitches: Record<Rarity, number> = {
    [Rarity.Common]: 1,
    [Rarity.Rare]: 1.12,
    [Rarity.Epic]: 1.26,
};

/** Where on the screen a flight starts: the middle of a box. */
interface Box {
    x: number;
    y: number;
    width: number;
}

interface Flight {
    key: number;
    id: string;
    rarity: Rarity;
    from: Box;
    /** Coins it cost, for a bought card: they rise off her purse. */
    price?: number;
    purse?: Box;
}

/** The box of `element`, as a flight reads it: none where it has no size. */
function readBox(element: Element | null | undefined): Box | undefined {
    const rect = element?.getBoundingClientRect();
    if (!rect || rect.width === 0) return undefined;
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
    };
}

/** Where a card in `slot` of the hand stands, or the middle of the bottom
 *  edge where the hand is gone, as when an unmade pick is made for her. */
function readCardBox(slot: number): Box {
    const faces = document.querySelectorAll(".card-row .card-face");
    const box = readBox(slot >= 0 ? faces[slot] : undefined);
    if (box) return box;
    return {
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.8,
        width: 0,
    };
}

/** Where the card `id` lands: its line or her chips, or her panel, or the
 *  bottom left corner where neither shows. */
function readLanding(id: string): { box: Box; element?: Element } {
    const selectors = [
        `.${flightTargetClasses[readFlightTarget(id)]}`,
        `.${flightTargetClasses.vitals}`,
    ];
    for (const selector of selectors) {
        const element = document.querySelector(selector) ?? undefined;
        const box = readBox(element);
        if (box) return { box, element };
    }
    return { box: { x: 160, y: window.innerHeight - 80, width: 0 } };
}

/** One card in the air, from its place in the hand to where it lands,
 *  shrinking and turning as it goes, then the landing's light. */
function FlyingCard({
    flight,
    onLanded,
}: {
    flight: Flight;
    onLanded: (key: number) => void;
}) {
    const { key, id, rarity, from } = flight;
    const card = readCard(id);
    const element = card?.line;
    const look = rarityLooks[rarity] ?? rarityLooks[Rarity.Common];
    const hook = `card-fly-${key}`;
    useLayoutEffect(() => {
        const ghost = document.querySelector<HTMLElement>(`.${hook}`);
        const landing = readLanding(id);
        const to = landing.box;
        const still = isStill();
        if (!still && ghost && typeof ghost.animate === "function") {
            const own = ghost.getBoundingClientRect();
            const half = { x: own.width / 2, y: own.height / 2 };
            const start = from.width > 0 ? from.width / own.width : 1;
            const place = (box: Box, lift = 0) =>
                `translate(${box.x - half.x}px, ${box.y - half.y - lift}px)`;
            ghost.animate(
                [
                    { transform: `${place(from)} scale(${start})`, opacity: 1 },
                    {
                        transform: `${place(from, 36)} scale(${start * 1.08}) rotate(-3deg)`,
                        opacity: 1,
                        offset: 0.22,
                    },
                    {
                        transform: `${place(to)} scale(0.16) rotate(-14deg)`,
                        opacity: 0.35,
                    },
                ],
                {
                    duration: flightMilliseconds,
                    easing: "cubic-bezier(0.5, 0, 0.75, 0.35)",
                    fill: "both",
                },
            );
        }
        const timer = window.setTimeout(() => {
            playSound(Sound.CardLand, { pitch: landPitches[rarity] });
            if (rarity === Rarity.Epic)
                playSound(Sound.EpicCard, { volume: 0.45 });
            const target = landing.element;
            if (!still && target && typeof target.animate === "function")
                target.animate(
                    [
                        { filter: "brightness(2.2)", transform: "scale(1.06)" },
                        { filter: "none", transform: "none" },
                    ],
                    { duration: 420, easing: "ease-out" },
                );
            onLanded(key);
        }, flightMilliseconds);
        return () => window.clearTimeout(timer);
    }, [hook, id, key, from, rarity, onLanded]);
    return (
        <Text
            as="span"
            className={`${hook} pointer-events-none fixed top-0 left-0 z-50 flex h-44 w-32 flex-col items-center justify-center gap-2 rounded-xl border-2 opacity-0 shadow-[0_12px_30px_rgb(0_0_0/0.55)] ${element ? `bg-menu-surface ${elementClasses[element].frame}` : `${look.face} ${look.frame}`}`}
        >
            {element ? (
                <ElementBadge
                    element={element}
                    className={`size-12 ${elementClasses[element].text}`}
                />
            ) : (
                <Icon
                    name={readCardIcon(id)}
                    className="size-12 text-amber-200"
                />
            )}
            <Text
                className={`${hudDisplay} px-2 text-center text-lg text-amber-50 uppercase`}
            >
                {card?.title}
            </Text>
        </Text>
    );
}

/** A bought card's coins, rising off her coin count. */
function SpentCoins({ flight }: { flight: Flight }) {
    const { key, price, purse } = flight;
    const hook = `card-spent-${key}`;
    useLayoutEffect(() => {
        const pop = document.querySelector<HTMLElement>(`.${hook}`);
        if (!pop || !purse || isStill() || typeof pop.animate !== "function")
            return;
        const own = pop.getBoundingClientRect();
        const at = (lift: number) =>
            `translate(${purse.x - own.width / 2}px, ${purse.y - own.height / 2 - lift}px)`;
        pop.animate(
            [
                { transform: `${at(0)} scale(1.5)`, opacity: 0 },
                { transform: `${at(8)} scale(1)`, opacity: 1, offset: 0.2 },
                { transform: `${at(44)} scale(1)`, opacity: 0 },
            ],
            { duration: 900, easing: "ease-out", fill: "both" },
        );
    }, [hook, purse]);
    if (price === undefined || !purse) return null;
    return (
        <Text
            as="span"
            className={`${hook} pointer-events-none fixed top-0 left-0 z-50 flex items-center gap-1 opacity-0`}
        >
            <Icon name="coins" className="size-4 text-menu-accent" />
            <Text className={`${hudDisplay} text-2xl text-menu-accent`}>
                {`−${price}`}
            </Text>
        </Text>
    );
}

/** The flights of the cards her hero takes and buys. */
export function CardFlights() {
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const survivor = useTrait(hero, WardenTrait);
    const [flights, setFlights] = useState<Flight[]>([]);
    const nextRef = useRef(0);
    const cards = survivor?.cards;
    const seenRef = useRef<readonly string[] | undefined>(undefined);
    const stateRef = useRef(survivor);
    stateRef.current = survivor;
    //  The last offer she held: the wave's opening puts it away in the
    //  same step it makes her unmade pick, which still flies from its
    //  card.
    const offerRef = useRef<readonly CardOffer[]>([]);
    if (survivor && survivor.offer.length > 0)
        offerRef.current = survivor.offer;

    useEffect(() => {
        const seen = seenRef.current;
        seenRef.current = cards;
        //  The cards she held as the page opened fly nowhere.
        if (!seen || !cards) return;
        const added = readNewCards(seen, cards);
        if (added.length === 0) return;
        const now = stateRef.current;
        const offer =
            now && now.offer.length > 0 ? now.offer : offerRef.current;
        const started = added.map((id): Flight => {
            const slot = offer.findIndex(({ card }) => card === id);
            const rarity = offer[slot]?.rarity ?? Rarity.Common;
            const bought = now?.bought.includes(id) ?? false;
            return {
                key: nextRef.current++,
                id,
                rarity,
                from: readCardBox(slot),
                ...(bought && {
                    price: readCardPrice(rarity),
                    purse:
                        readBox(document.querySelector(`.${shopPurseClass}`)) ??
                        readBox(document.querySelector(`.${purseClass}`)),
                }),
            };
        });
        //  A purchase the room granted latches over its coins as it leaves.
        if (started.some((flight) => flight.price !== undefined))
            playSound(Sound.RackBuy, { volume: 0.8 });
        setFlights((flying) => [...flying, ...started]);
    }, [cards]);

    const landed = useRef((key: number) =>
        setFlights((flying) => flying.filter((flight) => flight.key !== key)),
    ).current;

    if (flights.length === 0) return null;
    return (
        <Hud>
            <Panel slot={Slot.Center} variant={PanelVariant.Bare}>
                {flights.map((flight) => (
                    <Text as="span" key={flight.key} className="contents">
                        <FlyingCard flight={flight} onLanded={landed} />
                        <SpentCoins flight={flight} />
                    </Text>
                ))}
            </Panel>
        </Hud>
    );
}
