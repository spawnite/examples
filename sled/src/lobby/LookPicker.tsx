import { useWorld } from "koota/react";
import { AnimatePresence } from "motion/react";
import { useBank } from "../bank";
import { RideId, RiderId, lookPrices, type Look } from "../ride/riders";
import { buyLook, equipLook, useProgress } from "../shop";
import { LookArrows } from "./LookArrows";
import { PriceTag } from "./PriceTag";
import type { ScreenPoint } from "./StageMark";

/** What a picker cycles: the animals or the rides. */
export enum LookKind {
    Rider = "rider",
    Ride = "ride",
}

/** The looks of each kind. */
interface LookOf {
    [LookKind.Rider]: RiderId;
    [LookKind.Ride]: RideId;
}

const looks: { [Kind in LookKind]: LookOf[Kind][] } = {
    [LookKind.Rider]: Object.values(RiderId),
    [LookKind.Ride]: Object.values(RideId),
};

/** What the arrows say they cycle. */
const names: Record<LookKind, string> = {
    [LookKind.Rider]: "animal",
    [LookKind.Ride]: "ride",
};

/** The arrows that cycle the animals or the rides on the stage, from the
 *  player's progress. A look the player owns is equipped as the arrows
 *  reach it; one they do not draws locked, with its price tag, which buys
 *  and equips it. The scene draws `shown` on the stage. */
export function LookPicker<Kind extends LookKind>({
    kind,
    shown,
    onShow,
    at,
    spread,
}: {
    kind: Kind;
    /** The look on the stage, owned or not. */
    shown: LookOf[Kind];
    onShow: (look: LookOf[Kind]) => void;
    at: ScreenPoint;
    spread: number;
}) {
    const world = useWorld();
    const { riders, rides } = useProgress();
    const bank = useBank();
    const owned = (look: Look) => [...riders, ...rides].includes(look);
    const cycle = (by: number) => {
        const list: LookOf[Kind][] = looks[kind];
        const next =
            list[(list.indexOf(shown) + by + list.length) % list.length];
        if (owned(next)) equipLook(world, next);
        onShow(next);
    };
    return (
        <LookArrows
            look={names[kind]}
            at={at}
            spread={spread}
            onPrevious={() => cycle(-1)}
            onNext={() => cycle(1)}
        >
            {/*  Keeps a bought look's tag until its coins land. */}
            <AnimatePresence>
                {!owned(shown) && (
                    <PriceTag
                        //  A new tag for each look, so each pops in.
                        key={shown}
                        price={lookPrices[shown]}
                        affordable={bank >= lookPrices[shown]}
                        onBuy={() => buyLook(world, shown)}
                    />
                )}
            </AnimatePresence>
        </LookArrows>
    );
}
