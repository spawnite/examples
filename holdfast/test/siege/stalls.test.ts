// @vitest-environment node
import type { Entity } from "koota";
import { Vector3 } from "three";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import {
    ChaseTrait,
    dumpKey,
    fixedStepSeconds,
    GroundTrait,
    TransformTrait,
} from "@spawnite/engine";
import { spawnMonster } from "../../src/siege/monsters";
import {
    BoltTrait,
    BurstKind,
    BurstTrait,
    MonsterKind,
    MonsterTrait,
    SiegeStateTrait,
} from "../../src/siege/traits";
import { stalledSeconds } from "../../src/siege/stalls";
import { firstBreatherSeconds, planWave } from "../../src/siege/waves";
import { standingStones } from "../../src/views/layout";
import {
    fortify,
    joinWarden,
    openSiege,
    readSiege,
    takePlaces,
    type OpenedSiege,
} from "./room";

//  No wave waits on a monster that can never reach a warden nor be reached:
//  a spitter comes on until it sees her, a monster beside a warden who
//  stands off the field is hers to fight, and one held where it stands
//  away from every warden rises again near them.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** The first standing stone's middle, and the way out from the circle's
 *  middle through it, level with the ground. */
const stone = standingStones[0];
const outward = new Vector3(stone.x, 0, stone.z).normalize();
/** Level with the ground, a quarter turn from `outward`. */
const across = new Vector3(outward.z, 0, -outward.x);

/** The point `metres` out from the middle through the first stone, and
 *  `aside` metres to one side of that line. */
function alongStone(metres: number, aside = 0) {
    return outward
        .clone()
        .multiplyScalar(metres)
        .addScaledVector(across, aside);
}

/** `position` on the ground there, up the hills past the circle too. */
function onGround(game: OpenedSiege, position: Vector3) {
    const surface = game.world
        .queryFirst(GroundTrait)
        ?.get(GroundTrait)?.surface;
    const spot = position.clone();
    spot.y = surface?.getHeightAt(spot) ?? 0;
    return spot;
}

/** A warden stood on the ground at `position`, her health past any
 *  wave's reach, in the first wave's fight with nothing of it left to spawn
 *  and none of it standing, so each test's own monster, raised before the
 *  next step, is the wave. */
async function openFight(position: Vector3) {
    siege = await openSiege();
    const game = siege;
    const hero = joinWarden(game, {
        name: "Ada",
        position: onGround(game, position),
    });
    takePlaces(game, hero);
    fortify(game, hero);
    game.step(firstBreatherSeconds + 0.1);
    expect(readSiege(game.world).phase).toBe(PhaseMachine.is.fight);
    const state = game.world.queryFirst(SiegeStateTrait);
    state?.set(SiegeStateTrait, { toSpawn: 0, spawnSeconds: 1e6 });
    for (const monster of game.world.query(MonsterTrait)) monster.destroy();
    return { game, hero };
}

/** One monster of `kind` of the first wave, risen at `position` on the
 *  ground there. */
function raise(game: OpenedSiege, kind: MonsterKind, position: Vector3) {
    return spawnMonster(game.world, {
        kind,
        position: onGround(game, position),
        plan: planWave(1, 1),
    });
}

/** Metres a monster stands from where it stood, level with the ground. */
function measureMoved(monster: Entity, from: Vector3) {
    const at = monster.get(TransformTrait);
    if (!at) throw new Error("The monster has no place.");
    return Math.hypot(at.x - from.x, at.z - from.z);
}

it("walks a spitter on while a stone hides her, though she stands in its range", async () => {
    const { game } = await openFight(alongStone(15));
    const spitter = raise(game, MonsterKind.Spitter, alongStone(24.5, 0.25));
    const start = spitter.get(TransformTrait)?.clone();
    if (!start) throw new Error("The spitter has no place.");

    game.step(1.5);

    expect(measureMoved(spitter, start)).toBeGreaterThan(1);
});

it("holds a spitter at its range and spits once it sees her", async () => {
    const { game } = await openFight(alongStone(15, 3));
    const spitter = raise(game, MonsterKind.Spitter, alongStone(24.5, 3));
    const start = spitter.get(TransformTrait)?.clone();
    if (!start) throw new Error("The spitter has no place.");

    game.step(1.5);

    expect(measureMoved(spitter, start)).toBeLessThan(0.2);
    expect(game.world.query(BoltTrait).length).toBeGreaterThan(0);
});

//  Where a one-bot run's wave 12 stood for 27 minutes of play: she past a
//  hill's crest beyond the circle's edge, the wave's last spitter at its
//  foot 10 m off, in its range, the crest between them. The map's
//  southwest hill peaks 3.8 m high 40 m out.
it("walks a spitter up to a warden on a hill it cannot see over", async () => {
    const { game } = await openFight(new Vector3(-31.82, 0, -31.82));
    const spitter = raise(
        game,
        MonsterKind.Spitter,
        new Vector3(-24.75, 0, -24.75),
    );
    const start = spitter.get(TransformTrait)?.clone();
    if (!start) throw new Error("The spitter has no place.");
    //  How far it had walked when its first bolt left.
    let walkedBeforeBolt: number | null = null;

    for (let step = 0; step < 6 / fixedStepSeconds; step++) {
        game.step(fixedStepSeconds);
        if (game.world.query(BoltTrait).length > 0) {
            walkedBeforeBolt ??= measureMoved(spitter, start);
            break;
        }
    }

    expect(walkedBeforeBolt).not.toBeNull();
    expect(walkedBeforeBolt).toBeGreaterThan(0.5);
});

it("spits no bolt through a stone at a warden it cannot see", async () => {
    const { game } = await openFight(alongStone(15));
    raise(game, MonsterKind.Spitter, alongStone(24.5));
    let bolts = 0;

    for (let step = 0; step < 3 / fixedStepSeconds; step++) {
        game.step(fixedStepSeconds);
        bolts = Math.max(bolts, game.world.query(BoltTrait).length);
    }

    expect(bolts).toBe(0);
});

//  Speed 0 stands in for what holds a walker in play, such as a slope too
//  steep for it to climb below a warden on a hilltop.
it("raises a monster held where it stands, far from every warden, again near them", async () => {
    const { game } = await openFight(new Vector3(0, 0, 5));
    const husk = raise(game, MonsterKind.Husk, new Vector3(0, 0, 20));
    husk.set(ChaseTrait, { speed: 0 });
    game.step(stalledSeconds - 1);
    expect(husk.isAlive()).toBe(true);

    game.step(2);

    expect(husk.isAlive()).toBe(false);
    const state = readSiege(game.world);
    expect(state.phase).toBe(PhaseMachine.is.fight);
    expect(
        state.toSpawn + game.world.query(MonsterTrait).length,
    ).toBeGreaterThan(0);
});

it("keeps a monster held near a warden, as the back of a crowd round her is", async () => {
    const { game } = await openFight(new Vector3(0, 0, 5));
    const husk = raise(game, MonsterKind.Husk, new Vector3(0, 0, 10));
    husk.set(ChaseTrait, { speed: 0 });

    game.step(stalledSeconds + 1);

    expect(husk.isAlive()).toBe(true);
});

it("leaves a monster beside a warden who stands off the field hers to fight, and recalls one far from her", async () => {
    const out = new Vector3(0, 0, 36);
    const { game } = await openFight(out);
    const beside = raise(game, MonsterKind.Husk, new Vector3(0, 0, 38));
    const far = raise(game, MonsterKind.Husk, new Vector3(0, 0, -40));

    game.step(0.5);

    expect(beside.isAlive()).toBe(true);
    expect(far.isAlive()).toBe(false);
});

it("leaves a recall burst where a held monster sank, naming it, and no death", async () => {
    const { game } = await openFight(new Vector3(0, 0, 5));
    const husk = raise(game, MonsterKind.Husk, new Vector3(0, 0, 20));
    const key = dumpKey(game.world, husk);
    husk.set(ChaseTrait, { speed: 0 });
    const stood = husk.get(TransformTrait)?.clone();
    let kinds: BurstKind[] = [];

    for (let step = 0; step < (stalledSeconds + 1) / fixedStepSeconds; step++) {
        game.step(fixedStepSeconds);
        if (!husk.isAlive()) {
            kinds = game.world
                .query(BurstTrait)
                .map((burst) => burst.get(BurstTrait)?.kind ?? BurstKind.Death);
            break;
        }
    }

    expect(kinds).toEqual([BurstKind.Recall]);
    const burst = game.world.queryFirst(BurstTrait);
    expect(
        burst?.get(TransformTrait)?.distanceTo(stood ?? new Vector3()),
    ).toBeLessThan(0.5);
    expect(burst?.get(BurstTrait)?.monsterId).toBe(key);
});
