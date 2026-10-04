// @vitest-environment node
import type { Entity, World } from "koota";
import { Vector2 } from "three";
import { afterEach, expect, it } from "vitest";
import {
    captureRewoundTraits,
    createGameWorld,
    createRoomSession,
    dumpEntities,
    dumpKey,
    MovementTrait,
    movementRewoundTraits,
    readPredictionSeed,
    readStepComposition,
    receiveRoomMessage,
    protocolVersion,
    RoomMessageType,
    stepReplica,
    VelocityTrait,
} from "@spawnite/engine";
import { plugins } from "../../src/game";
import { joinWarden, onField, openSiege, type OpenedSiege } from "./room";

//  Her page's world: the game's plugins, welcomed into the room's world,
//  and stepped as her page steps it.

let siege: OpenedSiege | undefined;
let page: World | undefined;

afterEach(async () => {
    page?.destroy();
    page = undefined;
    await siege?.close();
    siege = undefined;
});

/** A page joined to `room` as `warden`'s player, through the room's
 *  welcome, with the session that claimed her hero. */
function joinPage(room: World, warden: Entity) {
    const world = createGameWorld(plugins);
    page = world;
    const session = createRoomSession();
    receiveRoomMessage(
        world,
        {
            type: RoomMessageType.Welcome,
            protocolVersion,
            hero: dumpKey(room, warden),
            snapshot: { entities: dumpEntities(room), hash: 0 },
            edits: false,
            composition: readStepComposition(room),
            tick: -1,
            predicted: [...movementRewoundTraits],
            rewound: captureRewoundTraits(warden, {}, movementRewoundTraits),
            predictionSeed: readPredictionSeed(room),
            sendRate: 30,
        },
        session,
    );
    const { hero } = session;
    if (!hero) throw new Error("The welcome claimed no hero.");
    return { world, session, hero };
}

it("walks her own warden on her page at the stride the room gives her", async () => {
    siege = await openSiege();
    const warden = joinWarden(siege, { name: "Ada", position: onField() });
    const stride = warden.get(MovementTrait)?.speed ?? 0;
    expect(stride).toBeGreaterThan(0);
    const { world, session, hero } = joinPage(siege.world, warden);
    const input = { intent: new Vector2(1, 0), steering: false, heading: 0 };

    for (let step = 0; step < 30; step++) stepReplica(world, session, input);

    expect(hero.get(MovementTrait)?.speed).toBe(stride);
    expect(hero.get(VelocityTrait)?.length()).toBeCloseTo(stride);
});
