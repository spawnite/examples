import { LifeMachine } from "./life";
import { createQuery } from "koota";
import {
    MeasureKind,
    WalletTrait,
    type SceneTimeline,
} from "@spawnite/engine/core";
import type { World } from "koota";
import { Reaction, topLevel } from "./elements";
import { PhaseTrait, readPhase } from "./phase";
import {
    FireTrait,
    LedgerTrait,
    MonsterKind,
    MonsterTrait,
    ReactionTallyTrait,
    RunTallyTrait,
    type RunTotals,
    SiegeTrait,
    WardenElementsTrait,
    WardenTrait,
} from "./traits";
import { wardens } from "./wardens";

//  What a room run of the siege records, which `spawnite play room` reads into
//  a row for each wave's fight and breather.

const monsters = createQuery(MonsterTrait);

/** Which reactions to count: of one kind, or every kind where it names
 *  none, and a warden's own alone, a key that names her hue twice. */
interface CountedReactions {
    reaction?: Reaction;
    own?: boolean;
}

/** The run's reactions the tally holds that `counted` names. */
function countReactions(
    world: World,
    { reaction, own = false }: CountedReactions,
) {
    const counts =
        world.queryFirst(SiegeTrait)?.get(ReactionTallyTrait)?.counts ?? {};
    let total = 0;
    for (const [key, count] of Object.entries(counts)) {
        const [pair, kind] = key.split(":");
        const [first, second] = pair.split("-");
        if (reaction !== undefined && kind !== reaction) continue;
        if (own && first !== second) continue;
        total += count;
    }
    return total;
}
const wallets = createQuery(WardenTrait, WalletTrait);
const lines = createQuery(WardenTrait, WardenElementsTrait);
const ledgers = createQuery(WardenTrait, LedgerTrait);

/** One field of every warden's ledger, summed: a counter that a new run's
 *  empty ledgers start again, which the table's rises still count. */
function sumLedgers(world: World, field: keyof typeof LedgerTrait.schema) {
    let total = 0;
    for (const warden of world.query(ledgers))
        total += warden.get(LedgerTrait)?.[field] ?? 0;
    return total;
}

/** A counter of one of the run's totals. */
function countTally(read: (tally: RunTotals) => number) {
    return {
        kind: MeasureKind.Counter,
        read: (world: World) => {
            const tally = world.queryFirst(SiegeTrait)?.get(RunTallyTrait);
            return tally ? read(tally) : 0;
        },
    } as const;
}

/** For each kind, its kills and the greatest health of those killed:
 *  over a wave, one's rise over the other's is what a kill took; and the
 *  health its blows took from the wardens. */
const kindMeasures = Object.fromEntries(
    Object.values(MonsterKind).flatMap((kind) => {
        const name = kind[0].toUpperCase() + kind.slice(1);
        return [
            [`kills${name}`, countTally((tally) => tally.kills[kind] ?? 0)],
            [`damage${name}`, countTally((tally) => tally.felled[kind] ?? 0)],
            [`hurt${name}`, countTally((tally) => tally.hurtBy[kind] ?? 0)],
        ];
    }),
);

export const timeline: SceneTimeline = {
    measures: {
        wave: {
            kind: MeasureKind.Gauge,
            read: (world) =>
                world.queryFirst(SiegeTrait)?.get(SiegeTrait)?.wave ?? 0,
        },
        phase: {
            kind: MeasureKind.Gauge,
            read: (world) =>
                readPhase(world.queryFirst(PhaseTrait)) ?? "waiting",
        },
        kills: {
            kind: MeasureKind.Counter,
            read: (world) => {
                let kills = 0;
                for (const warden of world.query(wardens))
                    kills += warden.get(WardenTrait)?.kills ?? 0;
                return kills;
            },
        },
        //  The wardens down now: a counter sums each rise, so each fall.
        downs: {
            kind: MeasureKind.Counter,
            read: (world) => {
                let down = 0;
                for (const warden of world.query(wardens))
                    if (warden.has(LifeMachine.is.down)) down++;
                return down;
            },
        },
        coins: {
            kind: MeasureKind.Counter,
            read: (world) => {
                let coins = 0;
                for (const warden of world.query(wallets))
                    coins += warden.get(WalletTrait)?.coins ?? 0;
                return coins;
            },
        },
        monsters: {
            kind: MeasureKind.Gauge,
            read: (world) => world.query(monsters).length,
        },
        //  What the wardens earned and spent, over all of them, and what
        //  they bought: a table's row over the wardens in the run gives
        //  each one's share.
        earned: {
            kind: MeasureKind.Counter,
            read: (world) => sumLedgers(world, "earned"),
        },
        spent: {
            kind: MeasureKind.Counter,
            read: (world) => sumLedgers(world, "spent"),
        },
        rerolls: {
            kind: MeasureKind.Counter,
            read: (world) => sumLedgers(world, "rerolls"),
        },
        guns: {
            kind: MeasureKind.Counter,
            read: (world) => sumLedgers(world, "guns"),
        },
        upgrades: {
            kind: MeasureKind.Counter,
            read: (world) => sumLedgers(world, "upgrades"),
        },
        //  Cards bought from an offer, after each free one.
        cards: {
            kind: MeasureKind.Counter,
            read: (world) => sumLedgers(world, "cards"),
        },
        //  Coins fed to the fire, and the level it stands at.
        fed: {
            kind: MeasureKind.Counter,
            read: (world) => sumLedgers(world, "fed"),
        },
        fire: {
            kind: MeasureKind.Gauge,
            read: (world) =>
                world.queryFirst(FireTrait)?.get(FireTrait)?.level ?? 0,
        },
        chainShocks: {
            kind: MeasureKind.Counter,
            read: (world) =>
                countReactions(world, { reaction: Reaction.ChainShock }),
        },
        blasts: {
            kind: MeasureKind.Counter,
            read: (world) =>
                countReactions(world, { reaction: Reaction.Blast }),
        },
        steamClouds: {
            kind: MeasureKind.Counter,
            read: (world) =>
                countReactions(world, { reaction: Reaction.SteamCloud }),
        },
        //  Those a warden sets off between her own two elements.
        ownReactions: {
            kind: MeasureKind.Counter,
            read: (world) => countReactions(world, { own: true }),
        },
        //  The points her element cards put on her lines, over every
        //  warden: its rise over a breather is the points taken in it.
        linePoints: {
            kind: MeasureKind.Counter,
            read: (world) => {
                let points = 0;
                for (const warden of world.query(lines)) {
                    const held = warden.get(WardenElementsTrait);
                    points +=
                        (held?.firstPoints ?? 0) + (held?.secondPoints ?? 0);
                }
                return points;
            },
        },
        //  The lines at their capstone, over every warden.
        capstones: {
            kind: MeasureKind.Gauge,
            read: (world) => {
                let capstones = 0;
                for (const warden of world.query(lines)) {
                    const held = warden.get(WardenElementsTrait);
                    if (held?.firstLevel === topLevel) capstones++;
                    if (held?.secondLevel === topLevel) capstones++;
                }
                return capstones;
            },
        },
        //  Over a wave, its rise over the kills is how long a monster
        //  lasted, and the colossi's over theirs how long one took to kill.
        monsterSeconds: countTally((tally) => tally.monsterSeconds),
        colossusSeconds: countTally((tally) => tally.colossusSeconds),
        ...kindMeasures,
        //  Health the blows took, or would have from an invulnerable warden.
        hurt: countTally((tally) => tally.hurt),
        revives: countTally((tally) => tally.revives),
        selfRevives: countTally((tally) => tally.selfRevives),
    },
    parts: ["wave", "phase"],
    //  Every warden down, or the night's last wave held.
    over: (world) => {
        const phase = readPhase(world.queryFirst(PhaseTrait));
        return phase === "over" || phase === "dawn";
    },
};
