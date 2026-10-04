import { createQuery, type World } from "koota";
import { findEntity, type StepOptions } from "@spawnite/engine/core";
import { MonsterKind, MonsterTrait, RunTallyTrait, SiegeTrait } from "./traits";

//  The run's totals the timeline reads and nothing else does, so a pass of
//  `game play room` reads how long monsters last, what each kind took to
//  kill, how hard the wardens were pressed and how often they got up.

const sieges = createQuery(SiegeTrait);
const monsters = createQuery(MonsterTrait);

/** The run's totals on the siege, added where it has none yet. */
export function ensureRunTally(world: World) {
    const siege = findEntity(world, sieges);
    if (!siege) return undefined;
    if (!siege.has(RunTallyTrait)) siege.add(RunTallyTrait);
    return siege.get(RunTallyTrait);
}

/** A monster taken out: its kind, and its greatest health. */
interface TalliedKill {
    kind: MonsterKind;
    health: number;
}

/** Counts a kill of `kind`, and the health it had at its fullest. */
export function tallyKill(world: World, { kind, health }: TalliedKill) {
    const tally = ensureRunTally(world);
    if (!tally) return;
    tally.kills[kind] = (tally.kills[kind] ?? 0) + 1;
    tally.felled[kind] = (tally.felled[kind] ?? 0) + health;
}

/** A blow a warden took or was spared: its health, and the kind that
 *  struck it. */
interface TalliedBlow {
    amount: number;
    kind: MonsterKind;
}

/** Counts a blow's health, whether or not it took any, and by the kind
 *  that struck it. */
export function tallyHurt(world: World, { amount, kind }: TalliedBlow) {
    const tally = ensureRunTally(world);
    if (!tally) return;
    tally.hurt += amount;
    tally.hurtBy[kind] = (tally.hurtBy[kind] ?? 0) + amount;
}

/** Counts a warden got up, by a teammate or `alone` by herself. */
export function tallyRevive(world: World, alone: boolean) {
    const tally = ensureRunTally(world);
    if (!tally) return;
    if (alone) tally.selfRevives++;
    else tally.revives++;
}

/** Adds the step's seconds for each monster standing, and for each
 *  colossus apart: over a wave, their rise over its kills is how long a
 *  monster lasted. */
export function tallyMonsters(world: World, { deltaSeconds }: StepOptions) {
    const standing = world.query(monsters);
    if (standing.length === 0) return;
    const tally = ensureRunTally(world);
    if (!tally) return;
    for (const monster of standing) {
        tally.monsterSeconds += deltaSeconds;
        if (monster.get(MonsterTrait)?.kind === MonsterKind.Colossus)
            tally.colossusSeconds += deltaSeconds;
    }
}
