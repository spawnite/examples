import { createWorld, type World } from "koota";
import { Group, Matrix4, Mesh, Object3D } from "three";
import {
    NetworkEntitiesTrait,
    NetworkIdTrait,
    WelcomesTrait,
} from "@spawnite/engine/core";
import { expect, it, vi } from "vitest";
import {
    advanceCorpses,
    dropCorpse,
    isTakenAway,
    readWelcomes,
    recallCorpse,
    setCorpseGroup,
} from "../../../src/views/monsters/Corpses";
import { MonsterClip } from "../../../src/views/monsters/models";
import {
    disposeMonsterRig,
    type MonsterRig,
} from "../../../src/views/monsters/rig";

//  A body here is a bare object: its model, clips and skin are the views'.
vi.mock("../../../src/views/monsters/rig", () => ({
    disposeMonsterRig: vi.fn(),
}));
vi.mock("../../../src/views/monsters/skin", () => ({ paintSkin: vi.fn() }));

//  A monster's body falls where the room took it away in play, and nowhere
//  a welcome, a rejoin's or a replay's seek, took the whole stream down,
//  whether it brought the monster straight back or left it out.

/** A page's world with the stream a welcome brought, a monster in it. */
function joinStream() {
    const world = createWorld(
        NetworkEntitiesTrait,
        WelcomesTrait({ count: 1 }),
    );
    const streamed = world.get(NetworkEntitiesTrait);
    if (!streamed) throw new Error("The world keeps no stream.");
    streamed.set("31.26", world.spawn(NetworkIdTrait({ id: "31.26" })));
    return { world, streamed };
}

/** A welcome: the stream down, and up again with `ids` in it. */
function welcome(world: World, ids: string[]) {
    const streamed = world.get(NetworkEntitiesTrait);
    for (const entity of streamed?.values() ?? []) entity.destroy();
    streamed?.clear();
    for (const id of ids)
        streamed?.set(id, world.spawn(NetworkIdTrait({ id })));
    world.set(WelcomesTrait, { count: readWelcomes(world) + 1 });
}

it("reads a monster the room took away in play as gone", () => {
    const { world, streamed } = joinStream();
    const seen = readWelcomes(world);

    //  The room's next send leaves it out.
    streamed.get("31.26")?.destroy();
    streamed.delete("31.26");
    expect(isTakenAway(world, "31.26", seen)).toBe(true);
    //  A page with no stream holds nothing that comes back.
    expect(isTakenAway(createWorld(), "31.26", 0)).toBe(true);
});

it("reads a monster a welcome brought back under its id as standing", () => {
    const { world } = joinStream();
    const seen = readWelcomes(world);

    welcome(world, ["31.26"]);

    expect(isTakenAway(world, "31.26", seen)).toBe(false);
});

it("leaves no body for a monster a welcome left out, as a seek past its death does", () => {
    const { world } = joinStream();
    const seen = readWelcomes(world);

    welcome(world, []);

    expect(isTakenAway(world, "31.26", seen)).toBe(false);
});

/** A monster's rig with no model: a fall clip that plays, and nothing
 *  else to draw. */
function createBareRig() {
    const fall = {
        reset: () => fall,
        fadeIn: () => fall,
        play: () => fall,
        isRunning: () => true,
    };
    return {
        object: new Object3D(),
        shadow: new Mesh(),
        shadowMetres: 1,
        mixer: { update: vi.fn() },
        actions: { [MonsterClip.Fall]: fall },
        skin: { flash: 0, wash: 1 },
    } as unknown as MonsterRig;
}

it("takes away a body still falling when a welcome replaces the moment it fell in", () => {
    const { world } = joinStream();
    const ground = new Group();
    setCorpseGroup(ground);
    const rig = createBareRig();

    dropCorpse(rig, {
        id: "31.26",
        placement: new Matrix4(),
        welcomes: readWelcomes(world),
    });
    advanceCorpses(world, 0.1);
    expect(ground.children).toContain(rig.object);

    //  A seek: the stream down and up again, and the page's frames stand
    //  still after it.
    welcome(world, []);
    advanceCorpses(world, 0);

    expect(ground.children).not.toContain(rig.object);
    expect(disposeMonsterRig).toHaveBeenCalledWith(rig);
});

/** A body placed at `x` along the ground. */
function placeAt(x: number) {
    return new Matrix4().makeTranslation(x, 0, 0);
}

it("sinks a recalled body where it stood, with no fall, whichever the page hears first", () => {
    const { world } = joinStream();
    setCorpseGroup(new Group());
    const heardFirst = createBareRig();
    const droppedFirst = createBareRig();

    //  The recall's rift before the body, and after it.
    recallCorpse("12");
    dropCorpse(heardFirst, {
        id: "12",
        placement: placeAt(4),
        welcomes: readWelcomes(world),
    });
    dropCorpse(droppedFirst, {
        id: "13",
        placement: placeAt(-4),
        welcomes: readWelcomes(world),
    });
    recallCorpse("13");
    advanceCorpses(world, 0.3);

    //  Each holds the pose it stood in: its clips never move on.
    expect(heardFirst.mixer.update).not.toHaveBeenCalled();
    expect(droppedFirst.mixer.update).not.toHaveBeenCalled();
    expect(heardFirst.object.position.y).toBeLessThan(-0.5);
    expect(droppedFirst.object.position.y).toBeLessThan(-0.5);
});

//  Matched by place, a monster that died on the spot of one the room
//  recalled in the same moment could sink in its place.
it("sinks the recalled body by its id, and lets one that died on the same spot fall as it died", () => {
    const { world } = joinStream();
    setCorpseGroup(new Group());
    const died = createBareRig();
    const recalled = createBareRig();

    recallCorpse("21");
    dropCorpse(recalled, {
        id: "21",
        placement: placeAt(20),
        welcomes: readWelcomes(world),
    });
    dropCorpse(died, {
        id: "20",
        placement: placeAt(20),
        welcomes: readWelcomes(world),
    });
    advanceCorpses(world, 0.3);

    expect(died.object.position.y).toBe(0);
    expect(recalled.object.position.y).toBeLessThan(-0.5);
});

it("lets a body fall as it died where its recall came too long before it", () => {
    const { world } = joinStream();
    setCorpseGroup(new Group());
    const rig = createBareRig();

    recallCorpse("30");
    advanceCorpses(world, 1);
    dropCorpse(rig, {
        id: "30",
        placement: placeAt(0),
        welcomes: readWelcomes(world),
    });
    advanceCorpses(world, 0.3);

    expect(rig.object.position.y).toBe(0);
});
