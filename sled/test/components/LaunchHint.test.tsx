import { act, render, screen } from "@testing-library/react";
import type { Entity } from "koota";
import { useWorld } from "koota/react";
import { useEffect } from "react";
import { beforeAll, expect, it, vi } from "vitest";
import type { World } from "koota";
import { Game, loadRapier, restoreLevels, Scene } from "@spawnite/engine";
import { LaunchHint } from "../../src/components/LaunchHint";
import { Track } from "../../src/levels";
import { RunMachine, RunTrait } from "../../src/ride/course";
import { SlingTrait } from "../../src/ride/sling";

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);

beforeAll(loadRapier);

let rider: Entity | undefined;
let world: World | undefined;

//  The hint over a rider on the sling.
function Ride() {
    const scene = useWorld();
    world = scene;
    useEffect(() => {
        rider = scene.spawn(RunTrait, SlingTrait);
        return () => rider?.destroy();
    }, [scene]);
    return <LaunchHint />;
}

async function mount() {
    await act(async () => {
        render(
            <Game name="hint-test" start="run" levels={Track}>
                <Scene name="run" component={Ride} />
            </Game>,
        );
    });
}

const findLaunchHint = () =>
    screen.queryByLabelText("Drag back and let go to launch");

it("shows on track 1 while the rider is on the sling, and goes at the launch", async () => {
    await mount();
    expect(findLaunchHint()).toBeInTheDocument();

    act(() => {
        if (rider) RunMachine.send(rider, "LAUNCH");
    });
    expect(findLaunchHint()).toBeNull();
});

it("never shows past track 1", async () => {
    await mount();
    //  Track 1 finished opens the game on track 2.
    act(() => {
        if (world)
            restoreLevels(world, { [Track.One]: { score: 7, seconds: 30 } });
    });
    expect(findLaunchHint()).toBeNull();
});
