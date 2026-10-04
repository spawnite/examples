// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { ChaseTrait, fixedStepSeconds, TransformTrait } from "@spawnite/engine";
import {
    blast,
    chainShock,
    Element,
    Mark,
    markSettleSeconds,
    ownMarkSettleSeconds,
    Reaction,
    restSeconds,
    steamCloud,
} from "../../src/siege/elements";
import { lanceWeapon } from "../../src/siege/lance";
import {
    ElementLookTrait,
    FrozenTrait,
    MonsterKind,
    MonsterTrait,
    ReactionTallyTrait,
    SiegeTrait,
    SteamTrait,
    StrikeKind,
    WardenTrait,
} from "../../src/siege/traits";
import {
    armWarden,
    landHit,
    landHits,
    readAfflictionsOf,
    readHealth,
    readStrikes,
    standMonster,
} from "./elements";
import {
    fortify,
    joinWarden,
    onField,
    openSiege,
    type OpenedSiege,
} from "./room";

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Two wardens: Ada with Frost, Bo with Storm, unless the test says. */
async function openPair(first = Element.Frost, second = Element.Storm) {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-2) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(2) });
    fortify(siege, ada);
    fortify(siege, bo);
    armWarden(ada, first);
    armWarden(bo, second);
    return { game: siege, ada, bo };
}

/** Freezes `monster` with the Frost warden's lance. */
function freeze(game: OpenedSiege, monster: Entity, frost: Entity) {
    landHit(game, { monster, warden: frost, weapon: lanceWeapon });
    expect(monster.has(FrozenTrait)).toBe(true);
    game.step(markSettleSeconds);
}

/** Sets `monster` blazing with the Ember warden's lance. */
function ignite(game: OpenedSiege, monster: Entity, ember: Entity) {
    landHits(game, { monster, warden: ember, weapon: lanceWeapon }, 3);
    expect(readAfflictionsOf(monster).mark).toBe(Mark.Blazing);
    game.step(markSettleSeconds);
}

/** The reactions the last step set off, of `kind`. */
function readReactions(game: OpenedSiege, kind: StrikeKind) {
    return readStrikes(game.world).filter((strike) => strike.kind === kind);
}

/** The run's tally of reactions on the siege. */
function readTally(game: OpenedSiege) {
    return (
        game.world.queryFirst(SiegeTrait)?.get(ReactionTallyTrait)?.counts ?? {}
    );
}

it("spends a mark when a different element hits it: its glow and reaction go, and its freeze stays", async () => {
    const { game, ada, bo } = await openPair();
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    freeze(game, husk, ada);

    landHit(game, { monster: husk, warden: bo });

    const state = readAfflictionsOf(husk);
    expect(state.mark).toBe(Mark.None);
    expect(state.restSeconds).toBeGreaterThan(0);
    expect(husk.has(FrozenTrait)).toBe(true);
});

it("rests a monster after a reaction: no mark and no reaction until the rest is over", async () => {
    const { game, ada, bo } = await openPair();
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    freeze(game, husk, ada);
    landHit(game, { monster: husk, warden: bo, weapon: lanceWeapon });
    expect(readReactions(game, StrikeKind.ChainShock)).toHaveLength(1);

    //  Frozen again at once, and struck again, while it rests.
    game.step(3);
    freeze(game, husk, ada);
    landHit(game, { monster: husk, warden: bo, weapon: lanceWeapon });
    expect(readAfflictionsOf(husk).mark).toBe(Mark.None);
    expect(readReactions(game, StrikeKind.ChainShock)).toHaveLength(0);

    //  Its rest over, a fresh freeze marks it and Storm sets it off.
    game.step(restSeconds);
    freeze(game, husk, ada);
    expect(readAfflictionsOf(husk).mark).toBe(Mark.Frozen);
    landHit(game, { monster: husk, warden: bo, weapon: lanceWeapon });
    expect(readReactions(game, StrikeKind.ChainShock)).toHaveLength(1);
});

it("lets a mark settle before it reacts, so a hit on the builder's heels sets off nothing", async () => {
    const { game, ada, bo } = await openPair();
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    landHit(game, { monster: husk, warden: ada, weapon: lanceWeapon });

    landHit(game, { monster: husk, warden: bo, weapon: lanceWeapon });
    expect(readReactions(game, StrikeKind.ChainShock)).toHaveLength(0);
    expect(readAfflictionsOf(husk).mark).toBe(Mark.Frozen);
    //  Pages show its ice at once, and its glow once it has settled.
    expect(husk.get(ElementLookTrait)).toMatchObject({
        frozen: true,
        mark: "",
    });

    game.step(markSettleSeconds);
    expect(husk.get(ElementLookTrait)?.mark).toBe(Mark.Frozen);
    landHit(game, { monster: husk, warden: bo, weapon: lanceWeapon });
    expect(readReactions(game, StrikeKind.ChainShock)).toHaveLength(1);
});

it("sets off nothing when the same element hits its own mark", async () => {
    const { game, ada } = await openPair();
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    freeze(game, husk, ada);

    landHit(game, { monster: husk, warden: ada, weapon: lanceWeapon });

    expect(readAfflictionsOf(husk).mark).toBe(Mark.Frozen);
    expect(readStrikes(game.world)).toEqual([]);
});

it("leaps Chain Shock through every frozen monster near the one Storm struck, and no other", async () => {
    const { game, ada, bo } = await openPair();
    const husks = [0, 4, 8].map((x) =>
        standMonster(game.world, { kind: MonsterKind.Husk, x, health: 1e4 }),
    );
    for (const husk of husks) freeze(game, husk, ada);
    const thawed = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: -3,
        health: 1e4,
    });

    landHit(game, { monster: husks[0], warden: bo });

    for (const husk of husks)
        expect(readHealth(husk)).toBeLessThanOrEqual(1e4 - chainShock.damage);
    for (const husk of husks)
        expect(readAfflictionsOf(husk).mark).toBe(Mark.None);
    //  Storm's own arc may reach it; the chain never does.
    expect(readHealth(thawed)).toBeGreaterThan(1e4 - chainShock.damage);
    const [shock] = readReactions(game, StrikeKind.ChainShock);
    expect(shock.by).toBe(bo);
    expect(shock.with).toBe(ada);
    expect(shock.count).toBe(1);
    expect(shock.points).toHaveLength(husks.length * 3);
});

it("sets off a Blast when Storm hits a blazing monster, which hits everything near and leaves it burning", async () => {
    const { game, ada, bo } = await openPair(Element.Ember, Element.Storm);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
    });
    const near = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: blast.metres - 1,
        health: 1e4,
    });
    const far = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: -(blast.metres + 8),
        health: 1e4,
    });
    ignite(game, brute, ada);
    const before = readHealth(brute);

    landHit(game, { monster: brute, warden: bo });

    expect(readReactions(game, StrikeKind.Blast)).toHaveLength(1);
    expect(before - readHealth(brute)).toBeGreaterThanOrEqual(
        blast.damage + 1e4 * blast.share,
    );
    expect(readHealth(near)).toBeLessThanOrEqual(1e4 - blast.damage);
    expect(readHealth(far)).toBe(1e4);
    expect(readAfflictionsOf(brute).burn).toBeGreaterThan(0);
});

it("raises a Steam Cloud when Ember hits a frozen monster, which slows and burns what stands in it until it clears", async () => {
    const { game, ada, bo } = await openPair(Element.Frost, Element.Ember);
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    const walker = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: 1.5,
        health: 1e4,
        walks: true,
    });
    const speed = walker.get(MonsterTrait)?.speed ?? 0;
    freeze(game, husk, ada);

    landHit(game, { monster: husk, warden: bo });
    game.step(1);

    expect(readReactions(game, StrikeKind.SteamCloud)).toHaveLength(0);
    expect(game.world.query(SteamTrait)).toHaveLength(1);
    expect(walker.get(ChaseTrait)?.speed).toBeLessThan(speed);
    expect(readHealth(walker)).toBeLessThan(1e4);
    game.step(steamCloud.seconds);
    expect(game.world.query(SteamTrait)).toHaveLength(0);
});

it("raises a Steam Cloud when Frost hits a blazing monster", async () => {
    const { game, ada, bo } = await openPair(Element.Ember, Element.Frost);
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1e4,
    });
    ignite(game, brute, ada);

    landHit(game, { monster: brute, warden: bo });

    const [cloud] = readReactions(game, StrikeKind.SteamCloud);
    expect(cloud.by).toBe(bo);
    expect(cloud.with).toBe(ada);
    const at = game.world.queryFirst(SteamTrait)?.get(TransformTrait);
    expect(at?.distanceTo(brute.get(TransformTrait) ?? at)).toBeLessThan(0.01);
});

it("counts each pair's reactions up through the run", async () => {
    const { game, ada, bo } = await openPair();
    const husks = [-6, 6].map((x) =>
        standMonster(game.world, { kind: MonsterKind.Husk, x, health: 1e4 }),
    );
    const counts: number[] = [];

    for (const husk of husks) {
        freeze(game, husk, ada);
        game.step(fixedStepSeconds);
        landHit(game, { monster: husk, warden: bo });
        counts.push(readReactions(game, StrikeKind.ChainShock)[0]?.count ?? 0);
    }

    expect(counts).toEqual([1, 2]);
    const hues = [ada, bo].map((warden) => warden.get(WardenTrait)?.hue ?? -1);
    expect(readTally(game)).toEqual({
        [`${Math.min(...hues)}-${Math.max(...hues)}:${Reaction.ChainShock}`]: 2,
    });
});

it("sets off a warden's own reaction between her two elements", async () => {
    const { game, ada } = await openPair(Element.Frost, Element.Storm);
    armWarden(ada, Element.Storm);
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    freeze(game, husk, ada);
    game.step(ownMarkSettleSeconds - markSettleSeconds);

    landHit(game, { monster: husk, warden: ada });

    const [shock] = readReactions(game, StrikeKind.ChainShock);
    expect(shock.by).toBe(ada);
    expect(shock.with).toBe(ada);
    const hue = ada.get(WardenTrait)?.hue;
    expect(readTally(game)).toEqual({
        [`${hue}-${hue}:${Reaction.ChainShock}`]: 1,
    });
});

it("holds a warden's own mark a while longer before her other element sets it off", async () => {
    const { game, ada } = await openPair(Element.Frost, Element.Storm);
    armWarden(ada, Element.Storm);
    const husk = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    //  Settled for a teammate, as the tests above set off, not yet for her.
    freeze(game, husk, ada);
    landHit(game, { monster: husk, warden: ada });
    expect(readReactions(game, StrikeKind.ChainShock)).toHaveLength(0);

    game.step(ownMarkSettleSeconds - markSettleSeconds);
    landHit(game, { monster: husk, warden: ada });
    expect(readReactions(game, StrikeKind.ChainShock)).toHaveLength(1);
});

it("sets off a reaction on a marked monster a Storm arc reaches", async () => {
    const { game, ada, bo } = await openPair();
    const struck = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    const frozen = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: 2,
        health: 1e4,
    });
    freeze(game, frozen, ada);

    landHit(game, { monster: struck, warden: bo, weapon: lanceWeapon });

    const [shock] = readReactions(game, StrikeKind.ChainShock);
    expect(shock?.by).toBe(bo);
    expect(shock?.with).toBe(ada);
    expect(readAfflictionsOf(frozen).mark).toBe(Mark.None);
});

it("spends every blazing mark a Blast reaches, so one explosion is one moment", async () => {
    const { game, ada, bo } = await openPair(Element.Ember, Element.Storm);
    const struck = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    const beside = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: blast.metres - 1,
        health: 1e4,
    });
    ignite(game, struck, ada);
    ignite(game, beside, ada);

    landHit(game, { monster: struck, warden: bo });

    expect(readReactions(game, StrikeKind.Blast)).toHaveLength(1);
    expect(readAfflictionsOf(beside).mark).toBe(Mark.None);
});

it("spends every mark inside a Steam Cloud as it rises", async () => {
    const { game, ada, bo } = await openPair(Element.Frost, Element.Ember);
    const struck = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    const beside = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: steamCloud.metres - 1,
        health: 1e4,
    });
    freeze(game, struck, ada);
    freeze(game, beside, ada);

    landHit(game, { monster: struck, warden: bo });

    expect(readReactions(game, StrikeKind.SteamCloud)).toHaveLength(1);
    expect(readAfflictionsOf(beside).mark).toBe(Mark.None);
});

it("renews the Steam Cloud a new one rises inside, as the same moment, rather than raising a second", async () => {
    const { game, ada, bo } = await openPair(Element.Frost, Element.Ember);
    const first = standMonster(game.world, {
        kind: MonsterKind.Husk,
        health: 1e4,
    });
    const second = standMonster(game.world, {
        kind: MonsterKind.Husk,
        x: 1,
        health: 1e4,
    });
    freeze(game, first, ada);
    landHit(game, { monster: first, warden: bo });
    game.step(steamCloud.seconds - 1);
    freeze(game, second, ada);

    landHit(game, { monster: second, warden: bo });
    expect(readReactions(game, StrikeKind.SteamCloud)).toHaveLength(0);
    expect(Object.values(readTally(game))).toEqual([1]);
    expect(readAfflictionsOf(second).mark).toBe(Mark.None);
    expect(game.world.query(SteamTrait)).toHaveLength(1);

    //  Past the first cloud's own end, the renewed one still stands.
    game.step(2);
    expect(game.world.query(SteamTrait)).toHaveLength(1);
});
