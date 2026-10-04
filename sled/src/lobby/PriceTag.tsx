import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { domAnimation, LazyMotion, m, usePresence } from "motion/react";
import { springs } from "@spawnite/ui";
import { Numeral } from "../components/Numeral";
import { CoinIcon } from "../icons/CoinIcon";
import { LockIcon } from "../icons/LockIcon";
import { BareButton } from "./BareButton";
import { useShake } from "./shake";

/** The coins that fly from the bank to the tag on a buy. */
const flyingCoins = 6;

/** Seconds each coin takes to fly, and between one coin's start and the
 *  next's. */
const flight = { duration: 0.45, stagger: 0.06 };

/** Where a box's middle is on the screen. */
function middleOf(rect: DOMRect) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** The bank's coin at the top right, which the coins fly from: the
 *  CoinCount's coin, by its name, or the screen's top right corner where
 *  none is drawn. */
function findBank() {
    const coin = document.querySelector(
        '[data-slot="top-right"] [aria-label="Coins"]',
    );
    return coin
        ? middleOf(coin.getBoundingClientRect())
        : { x: window.innerWidth - 48, y: 48 };
}

/** A locked look's price: a lock, a coin and the price on a white tag,
 *  small enough to leave the look it stands over on show. A
 *  tap buys it at once: `onBuy` runs, then coins fly from the bank to the
 *  tag and the tag pops away. Grey while the bank is short, when a tap only
 *  shakes it. Under an `AnimatePresence`, a tag taken away mid-flight
 *  stays until its coins land. */
export function PriceTag({
    price,
    affordable,
    onBuy,
}: {
    /** Coins it costs. */
    price: number;
    /** The bank holds the price. */
    affordable: boolean;
    onBuy: () => void;
}) {
    const { scope, animate, shake } = useShake<HTMLSpanElement>();
    //  Where the coins fly from and to, while they fly.
    const [path, setPath] = useState<{
        from: { x: number; y: number };
        to: { x: number; y: number };
    } | null>(null);
    const landedRef = useRef(0);
    const [present, safeToRemove] = usePresence();
    const [popped, setPopped] = useState(false);
    //  Taken away by its owner, as a bought look's tag is: gone once its
    //  coins have landed, at once with none flying.
    useEffect(() => {
        if (!present && (!path || popped)) safeToRemove();
    }, [present, path, popped, safeToRemove]);
    const buy = () => {
        if (path) return;
        if (!affordable) return shake();
        setPath({
            from: findBank(),
            to: middleOf(scope.current.getBoundingClientRect()),
        });
        onBuy();
    };
    const land = () => {
        landedRef.current += 1;
        if (landedRef.current < flyingCoins) return;
        void animate(
            scope.current,
            { scale: [1.25, 0] },
            { duration: 0.25 },
        ).then(() => setPopped(true));
    };
    return (
        <LazyMotion features={domAnimation}>
            <m.span
                ref={scope}
                className="flex"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={springs.bouncy}
            >
                <BareButton
                    label={`Buy for ${price} coins`}
                    onPress={buy}
                    className={`h-10.5 rounded-full border-3 border-[#14213d] pr-3 pl-1.5 shadow-[0_4px_0_#14213d] ${affordable ? "bg-white" : "bg-[#b9c2d3]"}`}
                >
                    <LockIcon className="size-7" />
                    <CoinIcon className="size-6" />
                    <Numeral
                        className={`text-2xl ${affordable ? "" : "text-[#e3e8f1]"}`}
                    >
                        {price}
                    </Numeral>
                </BareButton>
            </m.span>
            {path &&
                createPortal(
                    <LazyMotion features={domAnimation}>
                        {Array.from({ length: flyingCoins }, (_, index) => (
                            <m.div
                                key={index}
                                aria-hidden
                                className="pointer-events-none fixed top-0 left-0 z-50 size-9 -translate-1/2"
                                initial={{
                                    x: path.from.x,
                                    y: path.from.y,
                                    scale: 0.6,
                                }}
                                animate={{
                                    x: path.to.x,
                                    //  Up a little first, so each coin arcs
                                    //  out of the bank rather than sliding.
                                    y: [
                                        path.from.y,
                                        path.from.y - 30,
                                        path.to.y,
                                    ],
                                    //  Gone as it lands in the tag.
                                    scale: [0.6, 1.1, 0],
                                }}
                                transition={{
                                    duration: flight.duration,
                                    delay: index * flight.stagger,
                                    ease: "easeIn",
                                }}
                                onAnimationComplete={land}
                            >
                                <CoinIcon className="size-full" />
                            </m.div>
                        ))}
                    </LazyMotion>,
                    document.body,
                )}
        </LazyMotion>
    );
}
