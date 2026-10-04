import { createQuery, type Entity, type World } from "koota";
import type { Vector3 } from "three";
import {
    emitEvent,
    findEntity,
    readField,
    roundTo,
} from "@spawnite/engine/core";
import type { Reaction } from "./elements";
import {
    ElementStrikesTrait,
    ReactionTallyTrait,
    SiegeTrait,
    type StrikeKind,
    WardenTrait,
} from "./traits";

//  An element's moments as every page draws them: each an entry in the
//  step's `ElementStrikesTrait` on the siege, which the room sends once. And the
//  count of each pair's reactions this run, which the big word shows.

const sieges = createQuery(SiegeTrait);

/** One moment to draw: what, whose, with whom, its count, and where. */
export interface StrikeDraw {
    kind: StrikeKind;
    by: Entity | null;
    with?: Entity | null;
    count?: number;
    amount?: number;
    points: number[];
}

/** Adds the moment to the step's strikes on the siege. A world with no
 *  siege yet draws nothing. */
export function addStrike(world: World, draw: StrikeDraw) {
    const siege = findEntity(world, sieges);
    if (!siege) return;
    const strike = {
        kind: draw.kind,
        by: draw.by,
        with: draw.with ?? null,
        count: draw.count ?? 0,
        amount: draw.amount ?? 0,
        points: draw.points,
    };
    emitEvent(siege, ElementStrikesTrait, (held) => {
        held.strikes.push(strike);
        return held;
    });
}

/** Adds `at`, lifted `height` metres, to `points`, to the centimetre. */
export function pushPoint(points: number[], at: Vector3, height = 0) {
    points.push(roundTo(at.x, 2), roundTo(at.y + height, 2), roundTo(at.z, 2));
}

/** A warden's hue, or -1 for none: one field read, so a step that asks
 *  for every monster builds no record. */
export function readHue(warden: Entity | null) {
    if (!warden?.isAlive()) return -1;
    return readField(warden, WardenTrait, "hue") ?? -1;
}

/** The tally's key for a pair and a reaction: the lower hue first. */
export function readTallyKey(first: number, second: number, reaction: string) {
    const low = Math.min(first, second);
    const high = Math.max(first, second);
    return `${low}-${high}:${reaction}`;
}

/** A reaction to count: the warden whose hit set it off, the one who built
 *  the mark it spent, and which. */
export interface TalliedReaction {
    by: Entity;
    builder: Entity | null;
    reaction: Reaction;
}

/** Counts a reaction and returns how many this pair has made this run,
 *  this one among them. A mark whose builder has left counts as the
 *  reacting warden's own. */
export function tallyReaction(
    world: World,
    { by, builder, reaction }: TalliedReaction,
) {
    const siege = findEntity(world, sieges);
    if (!siege) return 1;
    const own = readHue(by);
    const other = readHue(builder);
    const key = readTallyKey(own, other < 0 ? own : other, reaction);
    if (!siege.has(ReactionTallyTrait)) siege.add(ReactionTallyTrait);
    const tally = siege.get(ReactionTallyTrait);
    if (!tally) return 1;
    const count = (tally.counts[key] ?? 0) + 1;
    tally.counts[key] = count;
    siege.changed(ReactionTallyTrait);
    return count;
}

/** Forgets every reaction a warden of colour `hue` made this run, as a
 *  warden who joins takes the colour of one who left: the new warden
 *  starts their own count, and no award names them for the other's. */
export function forgetHue(world: World, hue: number) {
    const tally = findEntity(world, sieges)?.get(ReactionTallyTrait);
    if (!tally) return;
    for (const key of Object.keys(tally.counts)) {
        const [low, high] = key.split(":")[0].split("-").map(Number);
        if (low === hue || high === hue) delete tally.counts[key];
    }
}

/** Forgets every reaction counted, as a new run starts. */
export function clearTally(world: World) {
    const siege = findEntity(world, sieges);
    if (siege?.has(ReactionTallyTrait))
        siege.set(ReactionTallyTrait, { counts: {} });
}
