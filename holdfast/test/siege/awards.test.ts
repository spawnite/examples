// @vitest-environment node
import type { Entity } from "koota";
import { afterEach, expect, it } from "vitest";
import { PhaseMachine } from "../../src/siege/phase";
import { Vector3 } from "three";
import {
    createGameWorld,
    dealDamage,
    requireAuthority,
    dumpKey,
    dumpState,
    teleportActor,
    TransformTrait,
    writeDumpedTraits,
} from "@spawnite/engine";
import { measureAwards, presentAwards } from "../../src/siege/awards";
import { reviveSeconds } from "../../src/siege/downs";
import { lastFallSeconds } from "../../src/siege/siege";
import { Reaction } from "../../src/siege/elements";
import {
    AwardKind,
    AwardsTrait,
    DeedsTrait,
    MonsterKind,
    ReactionTallyTrait,
    SiegeTrait,
    WardenTrait,
} from "../../src/siege/traits";
import { firstBreatherSeconds } from "../../src/siege/waves";
import { standMonster } from "./elements";
import {
    fortify,
    joinWarden,
    onField,
    openSiege,
    readSiege,
    takePlaces,
    type OpenedSiege,
} from "./room";
import { LifeMachine } from "../../src/siege/life";

//  The awards a run ends on: best duo, top reaction, top damage, most
//  revives and last one standing, on the dawn screen and the end screen.

let siege: OpenedSiege | undefined;

afterEach(async () => {
    await siege?.close();
    siege = undefined;
});

/** Opens a room with Ada, Bo and Cy in it, taken in by the siege. */
async function openRoom() {
    siege = await openSiege();
    const wardens = ["Ada", "Bo", "Cy"].map((name, index) =>
        joinWarden(siege!, { name, position: onField(index * 4 - 4) }),
    );
    siege.step(1 / 60);
    return { game: siege, wardens };
}

/** Each warden's colour. */
function readHues(wardens: Entity[]) {
    return wardens.map((warden) => warden.get(WardenTrait)?.hue ?? 0);
}

/** The award of `kind` in `awards`. */
function find(awards: ReturnType<typeof measureAwards>, kind: AwardKind) {
    return awards.find((award) => award.kind === kind);
}

it("names the pair who made the most reactions together as the best duo, whatever the kinds, and never a warden alone", async () => {
    const { game, wardens } = await openRoom();
    const [ada, bo, cy] = readHues(wardens);
    game.world.queryFirst(SiegeTrait)?.add(
        ReactionTallyTrait({
            counts: {
                [`${ada}-${bo}:${Reaction.ChainShock}`]: 4,
                [`${ada}-${bo}:${Reaction.Blast}`]: 3,
                [`${bo}-${cy}:${Reaction.SteamCloud}`]: 6,
                [`${cy}-${cy}:${Reaction.Blast}`]: 20,
            },
        }),
    );

    const duo = find(measureAwards(game.world), AwardKind.BestDuo);

    expect(duo).toEqual({
        kind: AwardKind.BestDuo,
        wardens: [
            { name: "Ada", hue: ada },
            { name: "Bo", hue: bo },
        ],
        value: 7,
        reaction: "",
    });
});

it("reaches a page as the room set it, each warden's name with their colour", async () => {
    const { game, wardens } = await openRoom();
    const [ada, bo] = readHues(wardens);
    const siege = game.world.queryFirst(SiegeTrait);
    siege?.add(
        ReactionTallyTrait({
            counts: { [`${ada}-${bo}:${Reaction.ChainShock}`]: 4 },
        }),
    );
    presentAwards(game.world);
    const page = createGameWorld();
    const copy = page.spawn(SiegeTrait, AwardsTrait);

    const key = dumpKey(game.world, siege!);
    writeDumpedTraits(copy, {
        awards: dumpState(game.world).entities[key]?.awards,
    });

    expect(copy.get(AwardsTrait)).toEqual(siege?.get(AwardsTrait));
    page.destroy();
});

it("names the team's top reaction with its count and who made it, one warden where she made it with her own two elements", async () => {
    const { game, wardens } = await openRoom();
    const [ada, bo, cy] = readHues(wardens);
    game.world.queryFirst(SiegeTrait)?.add(
        ReactionTallyTrait({
            counts: {
                [`${ada}-${bo}:${Reaction.ChainShock}`]: 12,
                [`${cy}-${cy}:${Reaction.Blast}`]: 20,
            },
        }),
    );

    const top = find(measureAwards(game.world), AwardKind.TopReaction);

    expect(top).toMatchObject({
        wardens: [{ name: "Cy", hue: cy }],
        value: 20,
        reaction: Reaction.Blast,
    });
});

it("counts the damage each warden's hits dealt the monsters, and names the most as top damage", async () => {
    const { game, wardens } = await openRoom();
    const [ada, bo] = wardens;
    const brute = standMonster(game.world, {
        kind: MonsterKind.Brute,
        health: 1000,
    });

    dealDamage(requireAuthority(game.world), brute, {
        amount: 40,
        source: ada,
    });
    dealDamage(requireAuthority(game.world), brute, { amount: 25, source: bo });
    game.step(1 / 60);
    dealDamage(requireAuthority(game.world), brute, { amount: 30, source: bo });
    game.step(1 / 60);

    expect(
        wardens.map((warden) => warden.get(DeedsTrait)?.damage ?? 0),
    ).toEqual([40, 55, 0]);
    expect(find(measureAwards(game.world), AwardKind.TopDamage)).toMatchObject({
        wardens: [{ name: "Bo" }],
        value: 55,
    });
});

it("counts a revive for the warden who got a teammate up, and names the most as most revives", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-8) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(8) });
    takePlaces(siege, ada, bo);
    siege.step(firstBreatherSeconds + 0.1);
    fortify(siege, ada);
    fortify(siege, bo);
    ada.set(WardenTrait, { health: 0 });
    siege.step(1 / 60);
    const feet = ada.get(TransformTrait)?.clone() ?? new Vector3();
    bo.get(TransformTrait)?.copy(feet.setX(feet.x + 1));
    teleportActor(siege.world, bo);

    siege.step(reviveSeconds + 0.5);

    expect(ada.has(LifeMachine.is.down)).toBe(false);
    expect(bo.get(DeedsTrait)?.revives).toBe(1);
    expect(
        find(measureAwards(siege.world), AwardKind.MostRevives),
    ).toMatchObject({ wardens: [{ name: "Bo" }], value: 1 });
});

it("counts the seconds a warden fights on alone while every teammate is down, and names the longest as last one standing", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-8) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(8) });
    takePlaces(siege, ada, bo);
    siege.step(firstBreatherSeconds + 0.1);
    fortify(siege, ada);
    fortify(siege, bo);
    ada.set(WardenTrait, { health: 0 });

    siege.step(3);

    expect(bo.get(DeedsTrait)?.aloneSeconds).toBeCloseTo(3, 0);
    expect(
        find(measureAwards(siege.world), AwardKind.LastStanding),
    ).toMatchObject({ wardens: [{ name: "Bo" }], value: 3 });
});

it("sets the awards on the siege as the run ends, and clears them as the next run starts", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-8) });
    takePlaces(siege, ada);
    siege.step(firstBreatherSeconds + 0.1);
    const brute = standMonster(siege.world, {
        kind: MonsterKind.Brute,
        health: 1000,
    });
    dealDamage(requireAuthority(siege.world), brute, {
        amount: 40,
        source: ada,
    });
    siege.step(1 / 60);
    ada.set(WardenTrait, { health: 0, selfRevive: false });
    siege.step(lastFallSeconds + 0.1);
    const ended = siege.world.queryFirst(AwardsTrait)?.get(AwardsTrait)?.list;
    const phase = readSiege(siege.world).phase;

    takePlaces(siege, ada);

    expect(phase).toBe(PhaseMachine.is.over);
    expect(ended?.map(({ kind }) => kind)).toEqual([AwardKind.TopDamage]);
    expect(siege.world.queryFirst(AwardsTrait)?.get(AwardsTrait)?.list).toEqual(
        [],
    );
});

it("credits nobody who joins mid-run in a colour a warden who left made reactions in", async () => {
    siege = await openSiege();
    const ada = joinWarden(siege, { name: "Ada", position: onField(-8) });
    const bo = joinWarden(siege, { name: "Bo", position: onField(8) });
    takePlaces(siege, ada, bo);
    siege.step(firstBreatherSeconds + 0.1);
    const [adaHue, boHue] = readHues([ada, bo]);
    siege.world.queryFirst(SiegeTrait)?.add(
        ReactionTallyTrait({
            counts: {
                [`${adaHue}-${boHue}:${Reaction.ChainShock}`]: 9,
                [`${boHue}-${boHue}:${Reaction.Blast}`]: 4,
            },
        }),
    );
    bo.destroy();

    const cy = joinWarden(siege, { name: "Cy", position: onField(8) });
    siege.step(1 / 60);
    const awards = measureAwards(siege.world);

    expect(readHues([cy])).toEqual([boHue]);
    expect(find(awards, AwardKind.BestDuo)).toBeUndefined();
    expect(find(awards, AwardKind.TopReaction)).toBeUndefined();
});
