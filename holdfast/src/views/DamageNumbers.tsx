import { Html } from "@react-three/drei";
import { Vector3 } from "three";
import { create } from "zustand";
import { Text } from "@spawnite/engine";

//  The damage a hit does, floating up off the monster it hit and fading:
//  every page shows every warden's hits, since the stream reports each
//  monster's health.

/** One number in the air. */
interface DamagePop {
    id: number;
    position: Vector3;
    amount: number;
}

interface DamagePops {
    pops: DamagePop[];
}

const useDamagePops = create<DamagePops>(() => ({ pops: [] }));

/** Milliseconds a number floats. */
const popMilliseconds = 750;
/** The most numbers in the air at once: the oldest goes first. */
const mostPops = 24;
let nextId = 0;

export type DamagePopInput = Pick<DamagePop, "position" | "amount">;

/** Floats `amount` up from `position`, which is copied. */
export function showDamage({ position, amount }: DamagePopInput) {
    const pop: DamagePop = {
        id: nextId++,
        //  A hair to one side at random, so a burst of hits fans out.
        position: position
            .clone()
            .add(
                new Vector3(
                    (Math.random() - 0.5) * 1.1,
                    Math.random() * 0.6,
                    (Math.random() - 0.5) * 1.1,
                ),
            ),
        amount,
    };
    useDamagePops.setState(({ pops }) => ({
        pops: [...pops.slice(-(mostPops - 1)), pop],
    }));
    setTimeout(
        () =>
            useDamagePops.setState(({ pops }) => ({
                pops: pops.filter((shown) => shown !== pop),
            })),
        popMilliseconds,
    );
}

/** A big hit reads bigger. */
const bigHit = 30;

function DamageNumber({ amount }: Pick<DamagePop, "amount">) {
    const big = amount >= bigHit;
    return (
        <Text
            as="div"
            className={`animate-damage-pop font-display font-bold font-stretch-condensed [text-shadow:0_2px_0_rgb(0_0_0/0.85),0_0_8px_rgb(0_0_0/0.6)] ${big ? "text-3xl text-amber-300" : "text-2xl text-white"}`}
        >
            {Math.round(amount)}
        </Text>
    );
}

export function DamageNumbers() {
    const pops = useDamagePops((state) => state.pops);
    return pops.map((pop) => (
        <Html
            key={pop.id}
            position={pop.position}
            center
            zIndexRange={[15, 10]}
            style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
        >
            <DamageNumber amount={pop.amount} />
        </Html>
    ));
}
