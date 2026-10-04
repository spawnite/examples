import { LifeMachine } from "./life";
import { createQuery, type Entity, type World } from "koota";
import { isPhase, PhaseMachine } from "./phase";
import {
    DamagedTrait,
    findEntity,
    PlayerNameTrait,
    readEach,
    type StepOptions,
} from "@spawnite/engine/core";
import {
    type Award,
    AwardKind,
    AwardsTrait,
    DeedsTrait,
    MonsterTrait,
    ReactionTallyTrait,
    SiegeStateTrait,
    WardenTrait,
} from "./traits";
import { isConnected, queryStandingWardens, queryWardens } from "./wardens";

//  The awards a run ends on, on the dawn screen and the end screen alike:
//  what the team did together, as Left 4 Dead's and Deep Rock Galactic's
//  end screens name who saved whom. The room keeps each warden's deeds
//  through the run and sets the awards once, as dawn breaks or the run
//  ends; every page draws them.

/** Her deeds, added where she has none. */
function readDeeds(warden: Entity) {
    if (!warden.has(DeedsTrait)) warden.add(DeedsTrait);
    return warden.get(DeedsTrait) ?? DeedsTrait.schema;
}

/** Counts a revive for the warden who got a teammate up. */
export function countRevive(reviver: Entity) {
    reviver.set(DeedsTrait, { revives: readDeeds(reviver).revives + 1 });
}

const damagedMonsters = createQuery(MonsterTrait, DamagedTrait);
const sieges = createQuery(SiegeStateTrait);

/** Counts each warden's deeds this step: the damage of every hit she
 *  dealt a monster, and a second alone while she is the only warden on
 *  her feet in a fight and a teammate lies down. Runs after every hit of
 *  the step lands and before the fallen are taken out. */
export function recordDeeds(world: World, { deltaSeconds }: StepOptions) {
    readEach(world, damagedMonsters, ([, damaged]) => {
        for (const { amount, source } of damaged.hits) {
            if (!source?.isAlive() || !source.has(WardenTrait)) continue;
            source.set(DeedsTrait, {
                damage: readDeeds(source).damage + amount,
            });
        }
    });
    if (!isPhase(world, PhaseMachine.is.fight)) return;
    const standing = queryStandingWardens(world);
    if (standing.length !== 1) return;
    const [alone] = standing;
    const downed = queryWardens(world).some(
        (warden) => isConnected(warden) && warden.has(LifeMachine.is.down),
    );
    if (!downed) return;
    alone.set(DeedsTrait, {
        aloneSeconds: readDeeds(alone).aloneSeconds + deltaSeconds,
    });
}

/** Forgets every warden's deeds and the awards, as a new run starts. */
export function clearDeeds(world: World) {
    for (const warden of queryWardens(world))
        if (warden.has(DeedsTrait))
            warden.set(DeedsTrait, { damage: 0, revives: 0, aloneSeconds: 0 });
    findEntity(world, sieges)?.set(AwardsTrait, { list: [] });
}

/** A warden as an award names her. */
interface Named {
    warden: Entity;
    name: string;
    hue: number;
}

/** Every warden in the room, by her name and colour, in colour order. */
function nameWardens(world: World): Named[] {
    return queryWardens(world)
        .map((warden) => ({
            warden,
            name: warden.get(PlayerNameTrait)?.name ?? "",
            hue: warden.get(WardenTrait)?.hue ?? 0,
        }))
        .sort((first, second) => first.hue - second.hue);
}

/** The warden whose deed `read` counts highest, the lower colour on a
 *  tie, where one counts more than `least`. */
function findTop(
    wardens: Named[],
    read: (deeds: typeof DeedsTrait.schema) => number,
    least: number,
) {
    let top: Named | undefined;
    let most = least;
    for (const named of wardens) {
        const value = read(readDeeds(named.warden));
        if (value > most) {
            most = value;
            top = named;
        }
    }
    return top && { named: top, value: most };
}

/** An award naming `wardens`. */
function award(
    kind: AwardKind,
    wardens: Named[],
    value: number,
    reaction = "",
): Award {
    return {
        kind,
        wardens: wardens.map(({ name, hue }) => ({ name, hue })),
        value: Math.round(value),
        reaction,
    };
}

/** A tallied reaction: the pair's colours, lowest first, which, and how
 *  many. */
interface TalliedPair {
    low: number;
    high: number;
    reaction: string;
    count: number;
}

/** Every entry of the run's reaction tally, whose wardens are both still
 *  in the room. */
function readTally(world: World, byHue: Map<number, Named>): TalliedPair[] {
    const counts =
        findEntity(world, sieges)?.get(ReactionTallyTrait)?.counts ?? {};
    const pairs: TalliedPair[] = [];
    for (const [key, count] of Object.entries(counts)) {
        const [pair, reaction] = key.split(":");
        const [low, high] = pair.split("-").map(Number);
        if (!byHue.has(low) || !byHue.has(high)) continue;
        pairs.push({ low, high, reaction, count });
    }
    return pairs;
}

/** The pair who made the most reactions together, two wardens. */
function findBestDuo(pairs: TalliedPair[], byHue: Map<number, Named>) {
    const totals = new Map<string, TalliedPair>();
    for (const pair of pairs) {
        if (pair.low === pair.high) continue;
        const key = `${pair.low}-${pair.high}`;
        const total = totals.get(key);
        if (total) total.count += pair.count;
        else totals.set(key, { ...pair });
    }
    let best: TalliedPair | undefined;
    for (const total of totals.values())
        if (!best || total.count > best.count) best = total;
    if (!best) return undefined;
    const pair = [byHue.get(best.low), byHue.get(best.high)];
    return award(
        AwardKind.BestDuo,
        pair.filter((named) => named !== undefined),
        best.count,
    );
}

/** The reaction one pair made most, or one warden with her own two
 *  elements, and who made it. */
function findTopReaction(pairs: TalliedPair[], byHue: Map<number, Named>) {
    let top: TalliedPair | undefined;
    for (const pair of pairs) if (!top || pair.count > top.count) top = pair;
    if (!top) return undefined;
    const hues = top.low === top.high ? [top.low] : [top.low, top.high];
    return award(
        AwardKind.TopReaction,
        hues
            .map((hue) => byHue.get(hue))
            .filter((named) => named !== undefined),
        top.count,
        top.reaction,
    );
}

/** The run's awards from what each warden in the room did: best duo, top
 *  reaction, top damage, most revives and last one standing, each where
 *  someone earned it. */
export function measureAwards(world: World): Award[] {
    const wardens = nameWardens(world);
    const byHue = new Map(wardens.map((named) => [named.hue, named]));
    const pairs = readTally(world, byHue);
    const list: (Award | undefined)[] = [
        findBestDuo(pairs, byHue),
        findTopReaction(pairs, byHue),
    ];
    const damage = findTop(wardens, ({ damage }) => damage, 0);
    if (damage)
        list.push(award(AwardKind.TopDamage, [damage.named], damage.value));
    const revives = findTop(wardens, ({ revives }) => revives, 0);
    if (revives)
        list.push(award(AwardKind.MostRevives, [revives.named], revives.value));
    //  A second at least, so a fall and a rise in one breath names nobody.
    const alone = findTop(wardens, ({ aloneSeconds }) => aloneSeconds, 1);
    if (alone)
        list.push(award(AwardKind.LastStanding, [alone.named], alone.value));
    return list.filter((each) => each !== undefined);
}

/** Sets the run's awards on the siege for every page, as dawn breaks or
 *  the run ends. */
export function presentAwards(world: World) {
    const siege = findEntity(world, sieges);
    if (!siege) return;
    const list = measureAwards(world);
    if (siege.has(AwardsTrait)) siege.set(AwardsTrait, { list });
    else siege.add(AwardsTrait({ list }));
}
