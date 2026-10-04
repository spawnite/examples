import { createQuery, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    dealDamage,
    requireAuthority,
    findEntity,
    HealthTrait,
    readEach,
    TransformTrait,
} from "@spawnite/engine/core";
import {
    findMonstersNear,
    measureChest,
    readAfflictions,
    spendMark,
} from "./afflictions";
import {
    blast,
    chainShock,
    Mark,
    Reaction,
    restSeconds,
    steamCloud,
} from "./elements";
import { addStrike, pushPoint, tallyReaction } from "./strikes";
import {
    AfflictionsTrait,
    FrozenTrait,
    LifetimeTrait,
    MonsterTrait,
    SteamClockTrait,
    SteamTrait,
    StrikeKind,
} from "./traits";

//  What two elements set off on a marked monster. Each spends the mark,
//  rests the monster, counts toward the pair's tally, and is drawn on
//  every page with both wardens' names and the count.

/** A reaction to set off: on which monster, which, the warden whose hit
 *  set it off, the one who built the mark, and the hitter's element
 *  power. */
export interface ReactionHit {
    monster: Entity;
    reaction: Reaction;
    by: Entity;
    builder: Entity | null;
    power: number;
}

const frozenMonsters = createQuery(
    MonsterTrait,
    FrozenTrait,
    HealthTrait,
    TransformTrait,
);
//  Written in place for each reaction.
const from = new Vector3();
const spot = new Vector3();
//  The frozen monsters standing as a chain starts, refilled for each, and
//  the ones it passed through.
const frozen: Entity[] = [];
const chain: Entity[] = [];

/** The frozen monster nearest `from` within `metres` the chain has not
 *  passed through, or null. */
function findNextFrozen(metres: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDistance = metres;
    for (const monster of frozen) {
        if (chain.includes(monster)) continue;
        const feet = monster.get(TransformTrait);
        if (!feet) continue;
        const distance = Math.hypot(feet.x - from.x, feet.z - from.z);
        if (distance <= nearestDistance) {
            nearest = monster;
            nearestDistance = distance;
        }
    }
    return nearest;
}

/** Chain Shock: lightning from the struck monster through every frozen
 *  monster near it, each to the next nearest, spending each one's mark. */
function shockChain(world: World, hit: ReactionHit, points: number[]) {
    const damage = chainShock.damage * hit.power;
    frozen.length = 0;
    readEach(world, frozenMonsters, ([, health], monster) => {
        if (health.current > 0) frozen.push(monster);
    });
    chain.length = 0;
    chain.push(hit.monster);
    dealDamage(requireAuthority(world), hit.monster, {
        amount: damage,
        source: hit.by,
    });
    while (chain.length <= chainShock.links) {
        const next = findNextFrozen(chainShock.metres);
        if (!next) break;
        const feet = next.get(TransformTrait);
        if (!feet) break;
        chain.push(next);
        from.copy(feet);
        pushPoint(points, from, measureChest(next));
        dealDamage(requireAuthority(world), next, {
            amount: damage,
            source: hit.by,
        });
        if (next.has(AfflictionsTrait))
            spendMark(readAfflictions(next), restSeconds);
    }
}

/** Spends the mark of each monster in `near` that wears one of `marks`,
 *  so one reaction is one moment, however many marks it reaches. */
function spendMarksNear(near: readonly Entity[], marks: readonly Mark[]) {
    for (const monster of near) {
        //  A factory trait: `get` hands back the record, and adds none.
        const state = monster.get(AfflictionsTrait);
        if (
            state &&
            marks.includes(state.mark as Mark) &&
            state.restSeconds <= 0
        )
            spendMark(state, restSeconds);
    }
}

const blazing: readonly Mark[] = [Mark.Blazing];
const anyMark: readonly Mark[] = [Mark.Blazing, Mark.Frozen];

/** Blast: an explosion round the monster, hitting everything in reach and
 *  spending every blazing mark it reaches, and the monster itself for a
 *  share of its greatest health besides. */
function explode(world: World, hit: ReactionHit) {
    const damage = blast.damage * hit.power;
    const maximum = hit.monster.get(HealthTrait)?.maximum ?? 0;
    dealDamage(requireAuthority(world), hit.monster, {
        amount: maximum * blast.share,
        source: hit.by,
    });
    const near = findMonstersNear(world, spot, blast.metres);
    for (const monster of near)
        dealDamage(requireAuthority(world), monster, {
            amount: damage,
            source: hit.by,
        });
    spendMarksNear(near, blazing);
}

const clouds = createQuery(
    SteamTrait,
    SteamClockTrait,
    LifetimeTrait,
    TransformTrait,
);

/** A cloud standing where `spot` is inside it, or null. */
function findCloudAtSpot(world: World) {
    return findEntity(world, clouds, (cloud) => {
        const at = cloud.get(TransformTrait);
        return (
            at !== undefined &&
            Math.hypot(at.x - spot.x, at.z - spot.z) <= steamCloud.metres
        );
    });
}

/** A Steam Cloud rising inside one already standing: it spends every mark
 *  inside and renews that cloud's seconds and its warden, as the same
 *  moment, so it counts and draws nothing new and the room streams one
 *  cloud. Returns whether one stood there. */
function renewSteam(world: World, hit: ReactionHit) {
    const standing = findCloudAtSpot(world);
    if (!standing) return false;
    spendMarksNear(findMonstersNear(world, spot, steamCloud.metres), anyMark);
    standing.set(LifetimeTrait, { seconds: steamCloud.seconds });
    standing.set(SteamTrait, (cloud) => ({ renewals: cloud.renewals + 1 }));
    const clock = standing.get(SteamClockTrait);
    if (clock) clock.by = hit.by;
    return true;
}

/** Steam Cloud: a cloud where the monster stands, which burns and slows
 *  every monster in it for a few seconds, and spends every mark inside it
 *  as it rises. */
function raiseSteam(world: World, hit: ReactionHit) {
    spendMarksNear(findMonstersNear(world, spot, steamCloud.metres), anyMark);
    world.spawn(
        TransformTrait(spot.clone()),
        SteamTrait({ radius: steamCloud.metres }),
        SteamClockTrait({ by: hit.by, tickSeconds: 0 }),
        LifetimeTrait({ seconds: steamCloud.seconds }),
    );
}

/** The strike each reaction draws. */
const reactionStrikes: Record<Reaction, StrikeKind> = {
    [Reaction.ChainShock]: StrikeKind.ChainShock,
    [Reaction.Blast]: StrikeKind.Blast,
    [Reaction.SteamCloud]: StrikeKind.SteamCloud,
};

/** Sets off `hit.reaction` on the monster: spends its mark, rests it,
 *  counts it for the pair, does what the reaction does, and draws it; or,
 *  for a Steam Cloud inside one standing, renews that one. */
export function setOffReaction(world: World, hit: ReactionHit) {
    const feet = hit.monster.get(TransformTrait);
    if (!feet) return;
    spot.copy(feet);
    from.copy(feet);
    spendMark(readAfflictions(hit.monster), restSeconds);
    if (hit.reaction === Reaction.SteamCloud && renewSteam(world, hit)) return;
    const count = tallyReaction(world, {
        by: hit.by,
        builder: hit.builder,
        reaction: hit.reaction,
    });
    const points: number[] = [];
    pushPoint(points, spot, measureChest(hit.monster));
    if (hit.reaction === Reaction.ChainShock) shockChain(world, hit, points);
    else if (hit.reaction === Reaction.Blast) explode(world, hit);
    else raiseSteam(world, hit);
    addStrike(world, {
        kind: reactionStrikes[hit.reaction],
        by: hit.by,
        with: hit.builder?.isAlive() ? hit.builder : null,
        count,
        points,
    });
}
