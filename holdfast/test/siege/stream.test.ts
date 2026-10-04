import { defaultRoomSendRate } from "@spawnite/schema";
// @vitest-environment node
import type { Entity, World } from "koota";
import { afterEach, expect, it, vi } from "vitest";
import {
    applyDelta,
    applySnapshot,
    ClientMessageType,
    createGameWorld,
    dumpEntities,
    dumpKey,
    encodeMessage,
    fixedStepSeconds,
    hash32,
    mountHeadlessScene,
    PlayerNameTrait,
    protocolVersion,
    quantizeSnapshot,
    readRoomFrame,
    readSendTicks,
    RoomMessageType,
    WireFormat,
} from "@spawnite/engine";
// eslint-disable-next-line @nx/enforce-module-boundaries -- the test runs the room the game's players join; the game's own code never imports it
import { mountSceneWorld, startRoom, type Room } from "@spawnite/room";
import { Holdfast, plugins } from "../../src/scenes/Holdfast";
import { PhaseMachine } from "../../src/siege/phase";
import { siegePlugin } from "../../src/siege/siege.plugin";
import { MonsterTrait, SiegeTrait } from "../../src/siege/traits";
import {
    deliverSignal,
    fortify,
    readSiege,
    skipToBreather,
    takePlaces,
    type OpenedSiege,
} from "./room";

//  The room's send cadence at the platform's default rate, which these
//  tests run at.
const sendTicks = readSendTicks(defaultRoomSendRate);
const sendsPerSecond = defaultRoomSendRate;

//  A page that joins mid-wave: the room's own Holdfast streamed over a
//  socket to a replica, which must hold the room's world after every send.

const rooms: Room[] = [];
const sockets: WebSocket[] = [];
const replicas: World[] = [];

afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.close();
    for (const room of rooms.splice(0)) await room.close();
    for (const replica of replicas.splice(0)) replica.destroy();
});

/** A room on Holdfast's scene, as the room mounts it, held still: only
 *  the test's director steps move it, each move's steps ending in a send. */
async function openHeldRoom() {
    //  The room's own mount, which destroys the world where the scene
    //  throws; the room destroys it from here, whether it starts or not.
    const scene = await mountSceneWorld(mountHeadlessScene, Holdfast, {
        plugins,
    });
    const room = await startRoom({
        port: 0,
        roomId: "holdfast",
        scene,
        director: true,
        seed: 1,
        //  The page below checks its replica against each send's hash.
        hashSends: true,
        log: () => undefined,
    });
    rooms.push(room);
    const { director } = room;
    if (!director) throw new Error("A room started with director has one.");
    director.pause();
    //  The siege helpers step the room's world through its director.
    const game: OpenedSiege = {
        ...scene,
        step: (seconds) =>
            void director.step(Math.round(seconds / fixedStepSeconds)),
        close: room.close,
    };
    return { room, director, game };
}

/** A page's end of the room: its socket, and a bare world fed from what
 *  lands on it, with the hash each message said the room's world had. */
interface Page {
    replica: World;
    /** Welcomes and deltas applied, and the hash each carried. */
    hashes: number[];
}

/** Opens a socket to `room` and joins as `name` on the binary wire, as a
 *  page does, applying each welcome and delta to a replica of its own. */
function joinPage(room: Room, name: string): Page {
    const socket = new WebSocket(`ws://127.0.0.1:${room.port}`);
    socket.binaryType = "arraybuffer";
    sockets.push(socket);
    const replica = createGameWorld();
    replicas.push(replica);
    const page: Page = { replica, hashes: [] };
    socket.addEventListener("open", () =>
        socket.send(
            encodeMessage({
                type: ClientMessageType.Join,
                protocolVersion,
                name,
                wire: WireFormat.Binary,
            }),
        ),
    );
    socket.addEventListener("message", ({ data }: MessageEvent<unknown>) => {
        const parts = readRoomFrame(
            typeof data === "string"
                ? data
                : new Uint8Array(data as ArrayBuffer),
        );
        for (const { message } of parts)
            if (message.type === RoomMessageType.Welcome) {
                applySnapshot(replica, message.snapshot);
                page.hashes.push(message.snapshot.hash);
            } else if (message.type === RoomMessageType.Delta) {
                applyDelta(replica, message.delta);
                page.hashes.push(message.delta.hash);
            }
    });
    return page;
}

/** The hero the room spawned for the page that joined as `name`, once its
 *  join has landed. */
async function findHero(room: Room, name: string) {
    let hero: Entity | undefined;
    await vi.waitFor(() => {
        hero = room.world
            .query(PlayerNameTrait)
            .find((entity) => entity.get(PlayerNameTrait)?.name === name);
        expect(hero).toBeDefined();
    });
    return hero as Entity;
}

/** The room's world as its stream sends it: the dump at the stream's
 *  precision. */
function dumpStream(world: World) {
    const snapshot = { entities: dumpEntities(world), hash: 0 };
    quantizeSnapshot(snapshot);
    return snapshot;
}

/** A dump as JSON reads it back, as the stream's hash reads it: a rounded
 *  -0 is 0 there, which `toEqual` alone tells apart. */
function readAsJson(dump: ReturnType<typeof dumpEntities>) {
    return JSON.parse(JSON.stringify(dump)) as typeof dump;
}

/** Sends in the three seconds after her join, her welcome the first. */
const sends = 1 + 3 * sendsPerSecond;

/** A room three seconds into wave 3's fight, with Ada holding the circle,
 *  and Bo's page joined but not yet welcomed. */
async function openLatecomer() {
    const { room, director, game } = await openHeldRoom();
    joinPage(room, "Ada");
    const ada = await findHero(room, "Ada");
    takePlaces(game, ada);
    fortify(game, ada);
    skipToBreather(game, 2);
    deliverSignal(game.world, {
        hero: ada,
        message: siegePlugin.messages.ready,
    });
    while (readSiege(game.world).phase === PhaseMachine.is.breather)
        game.step(0.5);
    game.step(3);
    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave: 3,
    });
    //  To the end of a move, so each move's steps after end on its send.
    const intoMove = director.read().step % sendTicks;
    if (intoMove > 0) director.step(sendTicks - intoMove);
    const bo = joinPage(room, "Bo");
    await findHero(room, "Bo");
    /** Runs one move of the room, and resolves once its send has landed
     *  on Bo's page, with the room's world as it sent it. */
    const nextSend = async () => {
        const landed = bo.hashes.length + 1;
        director.step(sendTicks);
        //  Polled each millisecond: the default 50 ms is most of a send.
        await vi.waitFor(() => expect(bo.hashes).toHaveLength(landed), {
            interval: 1,
        });
        return dumpStream(room.world);
    };
    return { room, game, bo, nextSend };
}

it("streams a latecomer the room's world mid-wave, and her replica holds it after every send", async () => {
    const { room, game, bo, nextSend } = await openLatecomer();

    for (let send = 0; send < sends; send++) {
        const sent = await nextSend();
        expect(bo.hashes[send], `send ${send}`).toBe(sent.hash);
        const [held, streamed] = [dumpEntities(bo.replica), sent.entities].map(
            readAsJson,
        );
        //  The siege's and every monster's own record among them, read by
        //  name, so a trait the stream dropped on both ends still fails.
        const siege = room.world.queryFirst(SiegeTrait) as Entity;
        expect(held[dumpKey(room.world, siege)]).toHaveProperty(
            "siege.wave",
            3,
        );
        const monsters = room.world.query(MonsterTrait);
        expect(monsters.length).toBeGreaterThan(0);
        for (const monster of monsters) {
            const key = dumpKey(room.world, monster);
            expect(held[key], `send ${send}, ${key}`).toHaveProperty(
                "monster.kind",
                monster.get(MonsterTrait)?.kind,
            );
        }
        expect(held, `send ${send}`).toEqual(streamed);
    }
    expect(readSiege(game.world)).toMatchObject({
        phase: PhaseMachine.is.fight,
        wave: 3,
    });
});

//  Fails on #2925: the stream's hash reads each world's own entity order.
//  A monster spawned on a reused id is keyed "19.1", which JSON orders by
//  insertion, and the room and her replica list it in different places:
//  she holds the room's world, and hashes it differently from send 5.
it.fails(
    "hashes the latecomer's replica as each delta says the room's world hashed",
    async () => {
        const { bo, nextSend } = await openLatecomer();

        for (let send = 0; send < sends; send++) {
            await nextSend();
            expect(
                hash32(JSON.stringify(dumpEntities(bo.replica))),
                `send ${send}`,
            ).toBe(bo.hashes[send]);
        }
    },
);
