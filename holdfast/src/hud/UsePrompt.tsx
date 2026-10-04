import { useFrame } from "@react-three/fiber";
import { useHas, useQueryFirst, useTrait, useWorld } from "koota/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    AuthorityTrait,
    Button,
    HeroTrait,
    Hud,
    Icon,
    engineActions,
    listenToAction,
    Panel,
    PanelVariant,
    Slot,
    Text,
    TransformTrait,
    WalletTrait,
} from "@spawnite/engine";
import { playSound, Sound } from "../audio/sounds";
import { feedCoins, measureFireRing } from "../siege/fire";
import {
    GunId,
    guns,
    isGunId,
    keepTier,
    readUpgradePrice,
    topTier,
} from "../siege/guns";
import { isRackOpen, isRunOn, rackStands } from "../siege/shop";
import { siegePlugin } from "../siege/siege.plugin";
import type { Signal } from "../siege/signals";
import { FireTrait, WardenGunTrait, WardenTrait } from "../siege/traits";
import { LifeMachine } from "../siege/life";
import { usePhase } from "../views/phase";
import { sendSignal } from "../weapons/signal";
import { announce } from "./Announcer";
import { readCardOffer, useHand } from "./hand";
import { levelNumerals } from "./ElementArt";
import { hudDisplay, hudKey, hudLabel, hudPane } from "./look";

//  The Use prompt: a warden who walks up to a stand of the fire's rack, or
//  to the fire itself, sees what E buys there and what it costs, and taps
//  the prompt on a touch screen, as Roblox's proximity prompts and Call of
//  Duty Zombies' wall buys ask. The room grants the purchase or does
//  nothing; a price her purse cannot meet buzzes here and sends nothing.
//  Held, E keeps feeding the fire.

/** Metres from a stand, and from the fire's middle, within which the
 *  prompt shows: inside the room's own reach, so a purchase the room lands
 *  a moment later still stands within it. */
const standMetres = 1.7;
const fireMetres = 3.1;
/** Milliseconds between two feeds while E is held: the room's rate. */
const feedMilliseconds = 260;

/** What she stands near: a stand of the rack, by its gun, or the fire. */
type UseTarget = GunId | "fire" | null;

/** What E does where she stands, as the prompt says it. */
interface UseOffer {
    signal: Signal | null;
    title: string;
    price: number | null;
    line: string;
    /** The key's word under the prompt, such as "hold". */
    hint?: string;
}

/** The offer at `target` for a warden holding `held` at `tier`. */
function readOffer(
    target: Exclude<UseTarget, null>,
    {
        open,
        held,
        tier,
        fire,
    }: {
        open: boolean;
        held: GunId;
        tier: number;
        fire: { level: number; fuel: number; next: number };
    },
): UseOffer {
    if (target === "fire")
        return {
            signal: { message: siegePlugin.messages.feed, payload: {} },
            title: "Feed the fire",
            price: feedCoins,
            line: `Level ${fire.level} · ${fire.fuel} of ${fire.next} to the next · its ring heals to ${measureFireRing(fire.level + 1)} m`,
            hint: "Hold to keep feeding",
        };
    const gun = guns[target];
    if (!open)
        return {
            signal: null,
            title: gun.title,
            price: null,
            line: "The rack opens when the night begins",
        };
    if (target !== held) {
        const kept = keepTier(tier);
        return {
            signal: {
                message: siegePlugin.messages.buyGun,
                payload: { gun: target },
            },
            title: `Buy ${gun.title}`,
            price: gun.price,
            line:
                kept > 0
                    ? `${gun.text} Keeps tier ${levelNumerals[kept]}`
                    : gun.text,
        };
    }
    const price = readUpgradePrice(tier);
    if (price === undefined)
        return {
            signal: null,
            title: `${gun.title} ${levelNumerals[topTier]}`,
            price: null,
            line: "Your gun is at its top tier",
        };
    const perk = gun.perks[tier];
    return {
        signal: { message: siegePlugin.messages.upgrade, payload: {} },
        title: `Upgrade to ${levelNumerals[tier + 1]}`,
        price,
        line: `${perk.title}: ${perk.text}`,
    };
}

/** Calls out her own purchase at the rack: the gun, or the perk its tier
 *  adds. */
function useOwnPurchases(
    gun: string | undefined,
    tier: number,
    bought: number,
) {
    const lastRef = useRef({ gun, tier, bought });
    useEffect(() => {
        const last = lastRef.current;
        lastRef.current = { gun, tier, bought };
        if (!gun || !isGunId(gun) || last.gun === undefined) return;
        //  A new run hands everyone the blaster back: no purchase.
        if (bought <= last.bought) return;
        const look = guns[gun];
        if (gun !== last.gun)
            announce({
                label: "From the rack",
                title: look.title,
                line:
                    tier > 0
                        ? `${look.text} Tier ${levelNumerals[tier]} kept`
                        : look.text,
                alarm: false,
            });
        else if (gun === last.gun && tier > last.tier)
            announce({
                label: `${look.title} ${levelNumerals[tier]}`,
                title: look.perks[tier - 1].title,
                line: look.perks[tier - 1].text,
                alarm: false,
            });
    }, [gun, tier, bought]);
}

export function UsePrompt() {
    const world = useWorld();
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const survivor = useTrait(hero, WardenTrait);
    const held = useTrait(hero, WardenGunTrait);
    const coins = useTrait(hero, WalletTrait)?.coins ?? 0;
    const phase = usePhase();
    const down = useHas(hero, LifeMachine.is.down);
    const fire = useTrait(useQueryFirst(FireTrait), FireTrait);
    const [target, setTarget] = useState<UseTarget>(null);
    const folded = useHand((state) => state.folded);
    const heldGun = held && isGunId(held.gun) ? held.gun : GunId.Blaster;
    const tier = held?.tier ?? 0;
    useOwnPurchases(held?.gun, tier, held?.bought ?? 0);

    const running = isRunOn(phase);
    const standing = hero !== undefined && !down;
    useFrame(() => {
        const feet = hero?.get(TransformTrait);
        let next: UseTarget = null;
        if (feet && running && standing) {
            if (Math.hypot(feet.x, feet.z) <= fireMetres) next = "fire";
            let nearest = standMetres;
            for (const stand of rackStands) {
                const metres = Math.hypot(feet.x - stand.x, feet.z - stand.z);
                if (metres <= nearest) {
                    nearest = metres;
                    next = stand.gun;
                }
            }
        }
        if (next !== target) setTarget(next);
    });

    const offer =
        target === null
            ? null
            : readOffer(target, {
                  open: isRackOpen(phase),
                  held: heldGun,
                  tier,
                  fire: fire ?? { level: 0, fuel: 0, next: 0 },
              });
    const offerRef = useRef({ offer, coins });
    offerRef.current = { offer, coins };
    const fedAtRef = useRef(0);

    /** Buys what the prompt offers where her purse meets its price, and
     *  buzzes where it does not. */
    const activate = useCallback(
        (repeat: boolean) => {
            const { offer: now, coins: held } = offerRef.current;
            if (!now) return;
            //  Held, E feeds the fire again at the room's pace, and buys
            //  nothing twice.
            if (repeat && now.signal?.message !== siegePlugin.messages.feed)
                return;
            const at = performance.now();
            if (repeat && at - fedAtRef.current < feedMilliseconds) return;
            if (!now.signal || now.price === null || held < now.price) {
                if (!repeat) playSound(Sound.Refused);
                return;
            }
            fedAtRef.current = at;
            sendSignal(world, now.signal.message, now.signal.payload);
        },
        [world],
    );

    useEffect(() => {
        if (target === null) return;
        //  Held, interact feeds again on each repeat, at its pace.
        return listenToAction(engineActions.interact, {
            repeat: true,
            onPress: ({ repeat }) => activate(repeat),
        });
    }, [target, activate]);

    if (!offer) return null;
    const short = offer.price !== null && coins < offer.price;
    //  Her open hand fills the foot of the screen: the prompt stands over
    //  the crosshair, under the wave banner, until she folds it.
    const cardsOpen = readCardOffer(phase, survivor).open && !folded;
    const shut = offer.signal === null;

    return (
        <Hud>
            {/*  Under the crosshair, clear of the downed panel's place, or
                over it while the card screen fills the foot. */}
            <Panel
                slot={Slot.Center}
                variant={PanelVariant.Bare}
                className={cardsOpen ? "mb-[30vh]" : "mt-[30vh]"}
            >
                <Button
                    onPress={() => activate(false)}
                    keyShortcuts="E"
                    aria-label={offer.title}
                    className={`flex animate-hud-rise items-center gap-3 py-2.5 pr-5 pl-3 text-left inset-shadow-none ${hudPane} ${shut ? "opacity-80" : short ? "" : "hover:shadow-[0_0_0_1px_rgb(255_177_59/0.6),0_0_28px_rgb(255_177_59/0.35)]"}`}
                >
                    <Text as="span" className={hudKey}>
                        {shut ? <Icon name="lock" className="size-4" /> : "E"}
                    </Text>
                    <Text
                        as="span"
                        className="flex max-w-[26rem] flex-col gap-0.5"
                    >
                        <Text as="span" className="flex items-center gap-2.5">
                            <Text
                                className={`${hudDisplay} text-2xl uppercase ${shut ? "text-white/70" : "text-pane-ink"}`}
                            >
                                {offer.title}
                            </Text>
                            {offer.price !== null && (
                                <Text
                                    as="span"
                                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${short ? "bg-black/30" : "bg-amber-400/15"}`}
                                >
                                    <Icon
                                        name="coins"
                                        className={`size-4 ${short ? "text-white/40" : "text-menu-accent"}`}
                                    />
                                    <Text
                                        className={`${hudDisplay} text-xl ${short ? "text-white/45" : "text-menu-accent"}`}
                                    >
                                        {offer.price}
                                    </Text>
                                </Text>
                            )}
                            {short && offer.price !== null && (
                                <Text className="text-xs font-semibold text-red-300/90">
                                    {offer.price - coins} more
                                </Text>
                            )}
                        </Text>
                        <Text className="text-sm leading-snug font-medium text-white/75">
                            {offer.line}
                        </Text>
                        {offer.hint && !short && (
                            <Text className={`${hudLabel} pt-0.5`}>
                                {offer.hint}
                            </Text>
                        )}
                    </Text>
                </Button>
            </Panel>
        </Hud>
    );
}
