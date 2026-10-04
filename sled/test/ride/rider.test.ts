// @vitest-environment node
import { expect } from "vitest";
import {
    addStatModifier,
    dumpKey,
    stepSeconds,
    TrackMoverTrait,
} from "@spawnite/engine/core";
import {
    attachDevtools,
    DevtoolsNodeKind,
    registerDevtoolsNode,
    useDevtools,
} from "@spawnite/engine/devtools";
import { frames, startRide } from "./rider";
import { it, type CreateGame } from "@spawnite/engine/testing";

async function start(createGame: CreateGame) {
    const ride = await startRide(createGame);
    return ride;
}

it("rides at today's side speed and drag", async ({ createGame }) => {
    const { game, rider } = await start(createGame);
    stepSeconds(game, frames(1));
    expect(rider.get(TrackMoverTrait)).toMatchObject({
        sideSpeed: 3.5,
        drag: 0.004,
    });
});

it("rides on the side and drag stats' modifiers", async ({ createGame }) => {
    const { game, rider } = await start(createGame);
    addStatModifier(rider, "side", { source: "sled", more: 0.02 });
    addStatModifier(rider, "drag", { source: "sled", more: 1 / 1.02 ** 2 - 1 });
    stepSeconds(game, frames(1));
    const mover = rider.get(TrackMoverTrait);
    expect(mover?.sideSpeed).toBeCloseTo(3.5 * 1.02);
    expect(mover?.drag).toBeCloseTo(0.004 / 1.02 ** 2, 8);
});

it("tunes the side speed and drag in the devtools through their stats, under the stats' modifiers", async ({
    createGame,
}) => {
    const { game, rider } = await start(createGame);
    const detach = attachDevtools(game);
    //  The rows the Rider's Entity and TrackMover register.
    const forget = [
        registerDevtoolsNode({
            id: "rider",
            name: "Rider",
            kind: DevtoolsNodeKind.Entity,
            entityId: dumpKey(game.world, rider),
            parentId: null,
        }),
        registerDevtoolsNode({
            id: "rider:mover",
            name: "TrackMover",
            kind: DevtoolsNodeKind.Behaviour,
            entity: rider,
            traits: [TrackMoverTrait],
            parentId: "rider",
        }),
    ];
    const { readStatFields, setStatBase } = useDevtools.getState();

    //  The inspector hides the two sliders the next step would undo.
    expect(readStatFields("rider:mover")).toEqual({
        sideSpeed: "side",
        drag: "drag",
    });
    setStatBase({ id: "rider", name: "side", base: 5 });
    setStatBase({ id: "rider", name: "drag", base: 0.002 });
    addStatModifier(rider, "side", { source: "sled", more: 0.02 });
    const expectTuned = () => {
        const mover = rider.get(TrackMoverTrait);
        expect(mover?.sideSpeed).toBeCloseTo(5 * 1.02);
        expect(mover?.drag).toBeCloseTo(0.002, 8);
    };
    stepSeconds(game, frames(1));
    expectTuned();
    //  And the step after: nothing sets them back.
    stepSeconds(game, frames(1));
    expectTuned();

    for (const stop of forget) stop();
    detach();
});
