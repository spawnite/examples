import { domAnimation, LazyMotion, m } from "motion/react";
import { Panel, PanelVariant, Slot } from "@spawnite/engine";
import { springs } from "@spawnite/ui";
import { CoinIcon } from "../icons/CoinIcon";
import { Numeral } from "./Numeral";

/** The count's size and its cell, so the digits stand about as tall as
 *  the coin beside them. */
const digits = "[grid-area:1/1] text-4xl sm:text-5xl";

/** The run's coins at the top right: the gold coin beside a large count.
 *  Each pickup pops both, the coin with a twist, so a coin taken is felt
 *  in the corner. */
export function CoinCount({ coins }: { coins: number }) {
    return (
        <Panel
            slot={Slot.TopRight}
            order={1}
            variant={PanelVariant.Bare}
            className="flex-row gap-1.5"
        >
            <LazyMotion features={domAnimation}>
                {/*  A new element per count, so each change pops it. */}
                <m.span
                    key={`coin-${coins}`}
                    initial={{ scale: 1.3, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={springs.bouncy}
                    className="flex"
                >
                    <CoinIcon label="Coins" className="size-10 sm:size-12" />
                </m.span>
                <m.span
                    key={coins}
                    initial={{ scale: 1.45 }}
                    animate={{ scale: 1 }}
                    transition={springs.bouncy}
                    className="grid"
                >
                    {/*  An unseen "88" in the same cell holds two digits'
                         width in the font as drawn, so the coin stays put
                         as the count passes 9. The size is the Numeral's
                         own, which outranks one inherited. */}
                    <Numeral className={`invisible ${digits}`}>88</Numeral>
                    <Numeral className={digits}>{coins}</Numeral>
                </m.span>
            </LazyMotion>
        </Panel>
    );
}
