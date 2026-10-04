import { act, render, screen } from "@testing-library/react";
import type { Entity } from "koota";
import { useWorld } from "koota/react";
import { useEffect } from "react";
import { beforeAll, expect, it, vi } from "vitest";
import {
    Game,
    loadRapier,
    Round,
    Scene,
    TrackMoverTrait,
} from "@spawnite/engine";
import { RunHud } from "../../src/components/RunHud";
import { levels, Track } from "../../src/levels";
import { RunMachine, RunTrait, stallSpeed } from "../../src/ride/course";
import { spawnDistance } from "../../src/ride/rider";

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);

beforeAll(loadRapier);

let rider: Entity | undefined;

//  The run's HUD over a rider going slower than a stall.
function Ride() {
    const scene = useWorld();
    useEffect(() => {
        rider = scene.spawn(
            RunTrait,
            TrackMoverTrait({ speed: stallSpeed / 2, distance: spawnDistance }),
        );
        return () => rider?.destroy();
    }, [scene]);
    return (
        <>
            <Round ready />
            <RunHud />
        </>
    );
}

it("warns of a stall below the stall speed while the run plays, and shows no speed on the sling", async () => {
    await act(async () => {
        render(
            <Game name="hud-test" start="run" levels={Track}>
                <Scene name="run" component={Ride} />
            </Game>,
        );
    });
    const speed = (name: string) => screen.queryByRole("img", { name });
    expect(speed("Speed")).toBeNull();
    expect(speed("Stalling")).toBeNull();

    act(() => {
        if (rider) RunMachine.send(rider, "LAUNCH");
    });
    expect(speed("Stalling")).toBeInTheDocument();

    act(() => rider?.set(TrackMoverTrait, { speed: stallSpeed * 2 }));
    expect(speed("Stalling")).toBeNull();
    expect(speed("Speed")).toBeInTheDocument();
});

it("fills the track's strip by the distance run from the sling to the finish", async () => {
    await act(async () => {
        render(
            <Game name="hud-test" start="run" levels={Track}>
                <Scene name="run" component={Ride} />
            </Game>,
        );
    });
    const strip = () => screen.getByRole("meter", { name: "Track 1" });
    expect(strip()).toHaveAttribute("aria-valuenow", "0");

    const finish = levels[Track.One].finish.at;
    act(() =>
        rider?.set(TrackMoverTrait, {
            distance: (spawnDistance + finish) / 2,
        }),
    );
    expect(strip()).toHaveAttribute("aria-valuenow", "0.5");
});
