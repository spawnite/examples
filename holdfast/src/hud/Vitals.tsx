import { useQueryFirst, useTrait } from "koota/react";
import { useState } from "react";
import {
    Authority,
    Bar,
    Hero,
    Hud,
    Icon,
    Panel,
    PanelVariant,
    PlayerName,
    Slot,
    Text,
    Wallet,
} from "@spawnite/engine";
import { readCard } from "../siege/cards";
import { WardenTrait } from "../siege/traits";
import { readWardenTextClass } from "../views/palette";
import { hudDisplay, hudLabel, hudPane } from "./look";

/** The share of her health under which the bar turns red and the number
 *  throbs. */
const lowShare = 0.3;

/** How many of each card she holds, in the order she first took them. */
function countCards(cards: string[]) {
    const counts = new Map<string, number>();
    for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
    return [...counts];
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

/** Her own warden, bottom left: her name in her colour, her coins, her
 *  health as a big number over a chunky bar, and the cards she holds. */
export function Vitals() {
    const hero = useQueryFirst(Hero, Authority);
    const survivor = useTrait(hero, WardenTrait);
    const player = useTrait(hero, PlayerName);
    const wallet = useTrait(hero, Wallet);
    const hits = useHits(survivor?.health ?? 0);
    if (!survivor) return null;

    const low = survivor.health <= survivor.maximum * lowShare;

    return (
        <Hud>
            <Panel
                slot={Slot.BottomLeft}
                variant={PanelVariant.Bare}
                className={`relative w-80 items-stretch gap-3 overflow-hidden py-3 pr-4 pl-5 ${hudPane}`}
            >
                {/*  Her colour down the pane's edge. */}
                <Text
                    as="div"
                    className={`absolute inset-y-0 left-0 w-1.5 bg-current ${readWardenTextClass(survivor.hue)}`}
                >
                    {null}
                </Text>
                {hits > 0 && (
                    <Text
                        as="div"
                        key={hits}
                        className="pointer-events-none absolute inset-0 animate-hud-flash bg-red-500/40"
                    >
                        {null}
                    </Text>
                )}
                <Text as="div" className="flex items-center justify-between">
                    <Text
                        className={`${hudDisplay} text-xl uppercase ${readWardenTextClass(survivor.hue)}`}
                    >
                        {player?.name ?? "You"}
                    </Text>
                    <Text
                        as="div"
                        className="flex items-center gap-1.5 rounded-lg bg-black/30 py-1 pr-2.5 pl-2"
                    >
                        <Icon name="coins" className="size-5 text-amber-300" />
                        <Text
                            className={`${hudDisplay} text-2xl text-amber-200`}
                        >
                            {wallet?.coins ?? 0}
                        </Text>
                    </Text>
                </Text>
                <Text as="div" className="flex flex-col gap-1.5">
                    <Text as="div" className="flex items-end justify-between">
                        <Text
                            as="div"
                            className="flex items-center gap-1.5 pb-1"
                        >
                            <Icon
                                name="heart"
                                className={
                                    low
                                        ? "size-5 text-red-400"
                                        : "size-5 text-emerald-300"
                                }
                            />
                            <Text className={hudLabel}>Health</Text>
                        </Text>
                        <Text
                            className={
                                low
                                    ? `${hudDisplay} animate-hud-pulse text-4xl text-red-400`
                                    : `${hudDisplay} text-4xl`
                            }
                        >
                            {Math.ceil(survivor.health)}
                            <Text className="ml-1 text-base font-semibold text-white/50">
                                / {survivor.maximum}
                            </Text>
                        </Text>
                    </Text>
                    {/*  The bar's fill reads the palette's variable, so the
                        wrapper sets it: green, red once she is low. */}
                    <Text
                        as="div"
                        className={
                            low
                                ? "[--color-health-fill:#ef4444]"
                                : "[--color-health-fill:#34d399]"
                        }
                    >
                        <Bar
                            label="Your health"
                            value={survivor.health}
                            maximum={survivor.maximum}
                            className="h-4 w-full rounded-md bg-black/55 ring-1 ring-white/10"
                        />
                    </Text>
                </Text>
                {survivor.cards.length > 0 && (
                    <Text as="div" className="flex flex-wrap gap-1.5">
                        {countCards(survivor.cards).map(([id, count]) => (
                            <Text
                                key={id}
                                className="rounded-md border border-menu-edge bg-menu-raised px-2 py-0.5 text-xs font-semibold text-amber-50"
                            >
                                {readCard(id)?.title}
                                {count > 1 && (
                                    <Text className="ml-1 text-xs font-bold text-amber-300">
                                        ×{count}
                                    </Text>
                                )}
                            </Text>
                        ))}
                    </Text>
                )}
            </Panel>
        </Hud>
    );
}
