import { useQueryFirst, useTrait } from "koota/react";
import {
    AuthorityTrait,
    Button,
    HeroTrait,
    Icon,
    Text,
} from "@spawnite/engine";
import { readRerollPrice } from "../siege/shop";
import { isReadyAsked } from "../siege/gathering";
import { SiegeTrait } from "../siege/traits";
import {
    hudDisplay,
    hudKeyboardKey,
    hudLabel,
    hudPane,
    hudTapTarget,
} from "./look";
import { useShownCoins, useTickedCount } from "./purse";
import { ReadyButton, urgentSeconds } from "./ReadyButton";
import { useReadyCount } from "./readyCount";

//  The bar under her cards: everything the shop's choice needs in one
//  place, as Brotato keeps the materials, the reroll and Go together at
//  the item row. Her coins on the left, the reroll in the middle, and the
//  breather's clock with Ready on the right.

/** The class on the bar's coin count, where a bought card's coins rise
 *  from while her cards are open. */
export const shopPurseClass = "shop-purse";

/** Her coins, large, counted as each lands and run down as she spends
 *  them. */
function ShopPurse() {
    const coins = useShownCoins(useQueryFirst(HeroTrait, AuthorityTrait));
    const shown = useTickedCount(coins);
    return (
        <Text
            as="span"
            aria-label={`${coins} coins`}
            className={`${shopPurseClass} flex items-center gap-2 justify-self-start`}
        >
            <Icon
                name="coins"
                className="size-7 text-amber-300 drop-shadow-[0_0_8px_rgb(251_191_36/0.55)]"
            />
            <Text
                //  A new element per count she holds, so each change bumps
                //  it once, however many steps its run down shows.
                key={coins}
                tabular
                className={`shop-purse-count ${hudDisplay} inline-block text-4xl text-amber-100 ${coins > 0 ? "animate-hud-bump" : ""}`}
            >
                {shown}
            </Text>
        </Text>
    );
}

export interface ShopReroll {
    price: number;
    onReroll: () => void;
}

interface RerollButtonProps extends ShopReroll {
    coins: number;
}

/** The reroll as a button: its icon and word, its price, its key, and
 *  how many more coins it needs where her purse is short. */
function RerollButton({ price, coins, onReroll }: RerollButtonProps) {
    const short = coins < price;
    return (
        <Button
            onPress={onReroll}
            keyShortcuts="4"
            label={`Reroll the cards for ${price} coins`}
            className={`group h-10 min-w-0 ${hudTapTarget} rounded-lg border bg-none px-3 py-0 shadow-none inset-shadow-none ${short ? "border-white/10 bg-black/35 text-white/45" : "border-menu-accent/50 bg-amber-400/15 text-pane-ink hover:bg-amber-400/25"}`}
        >
            <Text as="span" className="flex items-center gap-2">
                <Icon
                    name="rotate-ccw"
                    className={`size-5 transition-transform duration-300 group-hover:-rotate-180 ${short ? "text-white/35" : "text-menu-accent"}`}
                />
                <Text
                    className={`shop-reroll-word ${hudDisplay} text-lg uppercase`}
                >
                    Reroll
                </Text>
                <Text as="span" className="flex items-center gap-1">
                    <Icon
                        name="coins"
                        className={`size-4 ${short ? "text-white/35" : "text-menu-accent"}`}
                    />
                    <Text
                        //  Keyed by the price, so a reroll bumps it to its
                        //  next value; the breather's first price stands.
                        key={price}
                        tabular
                        className={`shop-reroll-price ${hudDisplay} inline-block text-lg ${short ? "text-white/45" : "text-menu-accent"} ${price > readRerollPrice(0) ? "animate-hud-bump" : ""}`}
                    >
                        {price}
                    </Text>
                </Text>
                {short && (
                    <Text className="text-xs font-semibold whitespace-nowrap text-white/50">
                        {price - coins} more
                    </Text>
                )}
                <Text as="span" className={hudKeyboardKey}>
                    4
                </Text>
            </Text>
        </Button>
    );
}

/** The breather's clock, "Wave 4 in 17", red over its last seconds, and
 *  Ready beside it once ready is asked, with how many of the wardens are
 *  ready where she has company. */
function ShopClock() {
    const siege = useTrait(useQueryFirst(SiegeTrait), SiegeTrait);
    const count = useReadyCount();
    if (!siege) return null;
    const seconds = Math.ceil(siege.secondsLeft);
    const urgent = seconds <= urgentSeconds;
    //  The first breather follows the gathering's own ready: it asks
    //  nothing.
    const asked = isReadyAsked("breather", siege.wave);
    return (
        <Text as="div" className="flex items-center gap-3 justify-self-end">
            <Text as="span" className="flex items-baseline gap-1.5">
                <Text
                    className={`shop-clock-words ${hudDisplay} text-base whitespace-nowrap text-pane-ink/85 uppercase`}
                >
                    {asked
                        ? `Wave ${siege.wave + 1} in`
                        : "The Hollow wakes in"}
                </Text>
                <Text
                    //  Keyed by the second, so each lands with the entrance.
                    key={`in${seconds}`}
                    tabular
                    className={`${hudDisplay} min-w-[1.2ch] animate-hud-slam text-center text-3xl ${urgent ? "text-red-300 [text-shadow:0_0_14px_rgb(248_113_113/0.7)]" : "text-menu-accent"}`}
                >
                    {seconds}
                </Text>
            </Text>
            {asked && (
                //  The ready count stands over Ready, in the gap above the
                //  bar, so it widens nothing.
                <Text as="span" className="relative flex">
                    <ReadyButton tall />
                    {count.wardens > 1 && (
                        <Text
                            tabular
                            className={`shop-ready-count absolute right-0 bottom-full mb-1 ${hudLabel} whitespace-nowrap text-emerald-200 [text-shadow:0_1px_6px_rgb(0_0_0/0.9)]`}
                        >
                            {count.ready}/{count.wardens} ready
                        </Text>
                    )}
                </Text>
            )}
        </Text>
    );
}

interface ShopBarProps {
    /** Her coins as the room credits them, which the reroll's price is
     *  read against. */
    coins: number;
    /** The reroll, where the offer takes one. */
    reroll?: ShopReroll;
    /** Whether a breather's clock runs, as it does not for a warden who
     *  catches up mid-wave. */
    breather: boolean;
}

/** One framed bar under her cards: her coins, the reroll, and the clock
 *  with Ready. */
export function ShopBar({ coins, reroll, breather }: ShopBarProps) {
    return (
        <Text
            as="div"
            className={`card-shop-bar grid w-full min-w-max grid-cols-[1fr_auto_1fr] items-center gap-5 py-2 pr-2 pl-4 ${hudPane}`}
        >
            <ShopPurse />
            {reroll ? (
                <RerollButton {...reroll} coins={coins} />
            ) : (
                <Text as="span">{null}</Text>
            )}
            {breather ? <ShopClock /> : <Text as="span">{null}</Text>}
        </Text>
    );
}
