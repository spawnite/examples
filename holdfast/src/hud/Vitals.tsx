import { useHas, useQueryFirst, useTrait } from "koota/react";
import { useEffect, useState } from "react";
import {
    AuthorityTrait,
    Bar,
    Counter,
    HeroTrait,
    Hud,
    Icon,
    Panel,
    PanelVariant,
    PlayerNameTrait,
    Slot,
    Text,
} from "@spawnite/engine";
import { readCard } from "../siege/cards";
import { GunId, guns, isGunId, topTier } from "../siege/guns";
import { WardenGunTrait, WardenTrait } from "../siege/traits";
import { LifeMachine } from "../siege/life";
import { usePhase } from "../views/phase";
import { readWardenTextClass } from "../views/palette";
import { readCardIcon } from "./CardFace";
import { flightTargetClasses, groupCardChips, mostChips } from "./cardFlight";
import { ElementLines } from "./ElementLines";
import { LevelChip, useLevel } from "./LevelChip";
import { SelfReviveLine } from "./SelfRevive";
import { useShownCoins } from "./purse";
import { hudDisplay, hudLabel, hudPane } from "./look";

/** The class on her coin count, the one place her coins show: a bought
 *  card's price rises off it. */
export const purseClass = "hud-purse";

/** The share of her health under which the bar turns red and the number
 *  throbs. */
const lowShare = 0.3;

/** Her stat cards in one row: each kind's picture and the times she holds
 *  it, the most held first, and a count of the kinds past those. A new
 *  card's chip bumps as its flight lands. */
function CardChips({ cards }: { cards: string[] }) {
    const { chips, rest } = groupCardChips(cards, mostChips);
    return (
        <Text
            as="div"
            aria-label={`Your cards: ${cards.length}`}
            className={`flex items-center gap-1 ${flightTargetClasses.cards}`}
        >
            <Text className={`${hudLabel} mr-1`}>Cards</Text>
            {chips.map(([id, count]) => (
                <Text
                    key={`${id}:${count}`}
                    as="span"
                    aria-label={`${readCard(id)?.title ?? id} ×${count}`}
                    className="flex animate-hud-bump items-center gap-0.5 rounded-md border border-menu-accent/25 bg-amber-400/10 py-0.5 pr-1.5 pl-1 [animation-delay:450ms]"
                >
                    <Icon
                        name={readCardIcon(id)}
                        className="size-3.5 text-menu-accent"
                    />
                    <Text className={`${hudDisplay} text-sm text-pane-ink`}>
                        {count}
                    </Text>
                </Text>
            ))}
            {rest > 0 && (
                <Text className={`${hudDisplay} text-sm text-white/60`}>
                    +{rest}
                </Text>
            )}
        </Text>
    );
}

/** Counts the times her health has dropped, so each hit keys its own flash;
 *  a heal counts nothing. */
function useHits(health: number) {
    const [seen, setSeen] = useState({ health, hits: 0 });
    //  Adjusted while rendering, as React's docs do for state that follows
    //  a prop, so the flash lands in the same frame as the new number.
    if (seen.health !== health)
        setSeen({
            health,
            hits: health < seen.health ? seen.hits + 1 : seen.hits,
        });
    return seen.hits;
}

/** Milliseconds the hit flash stays in the page: its fade in styles.css.
 *  It leaves on this clock, so it goes even where its fade does not run. */
const flashMilliseconds = 450;

/** The number of the hit whose flash is showing, or null. */
export function useHitFlash(health: number): number | null {
    const hits = useHits(health);
    const [ended, setEnded] = useState(0);
    useEffect(() => {
        if (hits === 0) return;
        const timer = setTimeout(() => setEnded(hits), flashMilliseconds);
        return () => clearTimeout(timer);
    }, [hits]);
    return hits > ended ? hits : null;
}

/** Her gun from the rack, with a pip for each tier she raised it. */
function GunLine({ gun, tier }: { gun: GunId; tier: number }) {
    return (
        <Text as="div" className="flex items-center gap-2">
            <Icon name="crosshair" className="size-4 text-menu-accent/80" />
            <Text className={`${hudDisplay} text-base text-pane-ink uppercase`}>
                {guns[gun].title}
            </Text>
            <Text as="span" className="flex items-center gap-1">
                {Array.from({ length: topTier }, (_, index) => (
                    <Text
                        as="span"
                        key={index}
                        className={`size-2 rounded-full ${index < tier ? (index === topTier - 1 ? "bg-amber-200 shadow-[0_0_6px_rgb(253_230_138/0.9)]" : "bg-amber-400") : "bg-white/15"}`}
                    >
                        {null}
                    </Text>
                ))}
            </Text>
        </Text>
    );
}

/** Her own warden, bottom left: her name in her colour, her level, her
 *  coins, her gun and its tier, her health as a big number over a chunky
 *  bar, her element lines, and the cards she holds. */
export function Vitals() {
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const survivor = useTrait(hero, WardenTrait);
    const player = useTrait(hero, PlayerNameTrait);
    const held = useTrait(hero, WardenGunTrait);
    //  Her purse counts each coin as it lands, not as the room credits it.
    const coins = useShownCoins(hero);
    const flash = useHitFlash(survivor?.health ?? 0);
    //  Her cards show while she chooses more, between waves; in a wave the
    //  panel keeps to what she fights with.
    const breather = usePhase() === "breather";
    const down = useHas(hero, LifeMachine.is.down);
    const level = useLevel(hero);
    if (!survivor) return null;

    const low = survivor.health <= survivor.maximum * lowShare;
    //  Her element cards show on her lines, not as cards.
    const statCards = survivor.cards.filter((id) => !readCard(id)?.line);

    return (
        <Hud>
            {/*  On a computer the card stands at four fifths of a phone's,
                every row with it: a zoom lays it out again at that size,
                so its type stays sharp. A coarse pointer keeps it whole. */}
            <Panel
                slot={Slot.BottomLeft}
                variant={PanelVariant.Bare}
                className={`relative w-80 shrink-0 [zoom:0.8] pointer-coarse:[zoom:1] items-stretch gap-2.5 overflow-hidden py-3 pr-4 pl-5 [@media(max-height:760px)]:gap-1.5 [@media(max-height:760px)]:py-2 ${flightTargetClasses.vitals} ${hudPane}`}
            >
                {/*  Her colour down the pane's edge. */}
                <Text
                    as="div"
                    className={`absolute inset-y-0 left-0 w-1.5 bg-current ${readWardenTextClass(survivor.hue)}`}
                >
                    {null}
                </Text>
                {flash !== null && (
                    <Text
                        as="div"
                        key={flash}
                        className="pointer-events-none absolute inset-0 animate-hud-flash bg-red-500/40"
                    >
                        {null}
                    </Text>
                )}
                <Text
                    as="div"
                    className="flex items-center justify-between gap-2.5"
                >
                    {/*  Her name alone truncates, so her level and her
                        coins stay whole. */}
                    <Text as="div" className="flex min-w-0 items-center gap-2">
                        <Text
                            className={`${hudDisplay} min-w-0 truncate text-xl uppercase ${readWardenTextClass(survivor.hue)}`}
                        >
                            {player?.name ?? "You"}
                        </Text>
                        <LevelChip level={level} />
                    </Text>
                    <Counter
                        icon="coins"
                        label="Coins"
                        value={coins}
                        classNames={{
                            root: `${purseClass} shrink-0 gap-1.5 rounded-lg bg-black/30 py-1 pr-2.5 pl-2 text-menu-accent`,
                            value: `${hudDisplay} text-2xl`,
                        }}
                    />
                </Text>
                <GunLine
                    gun={held && isGunId(held.gun) ? held.gun : GunId.Blaster}
                    tier={held?.tier ?? 0}
                />
                {/*  Her health in one row: its number, large, beside a
                    chunky bar, so the panel keeps to its corner at 540
                    rows. */}
                <Text as="div" className="flex items-center gap-3">
                    <Text as="div" className="flex items-baseline gap-1">
                        <Icon
                            name="heart"
                            className={`size-5 self-center ${low ? "text-danger" : "text-emerald-300"}`}
                        />
                        <Text
                            className={
                                low
                                    ? `${hudDisplay} animate-hud-pulse text-3xl text-danger`
                                    : `${hudDisplay} text-3xl`
                            }
                        >
                            {Math.ceil(survivor.health)}
                        </Text>
                        <Text className="text-sm font-semibold text-white/50">
                            / {survivor.maximum}
                        </Text>
                    </Text>
                    <Text as="div" className="flex-1">
                        <Bar
                            label="Your health"
                            value={survivor.health}
                            maximum={survivor.maximum}
                            className="h-4 w-full rounded-md bg-black/55 ring-1 ring-white/10"
                            //  Green, and the danger colour once she is low.
                            classNames={{
                                fill: low ? "bg-danger" : "bg-emerald-400",
                            }}
                        />
                    </Text>
                </Text>
                <SelfReviveLine selfRevive={survivor.selfRevive} down={down} />
                {hero && <ElementLines entity={hero} />}
                {breather && statCards.length > 0 && (
                    <CardChips cards={statCards} />
                )}
            </Panel>
        </Hud>
    );
}
