import { act, render, screen } from "@testing-library/react";
import type { Entity, World } from "koota";
import { useWorld } from "koota/react";
import { useEffect, type PropsWithChildren } from "react";
import { beforeAll, expect, it, vi } from "vitest";
import {
    Game,
    loadRapier,
    Round,
    RoundState,
    RoundTrait,
    Scene,
    TrackMoverTrait,
} from "@spawnite/engine";
import { palette } from "@spawnite/ui";
import { RunHud } from "../../src/components/RunHud";
import { RunTrait, stallSpeed } from "../../src/ride/course";

//  jsdom has no WebGL: the canvas is a div that holds its children.
vi.mock("@react-three/fiber", () => ({
    Canvas: ({ children }: PropsWithChildren) => <div>{children}</div>,
    useFrame: () => undefined,
    extend: () => undefined,
    //  The loop reads the frameloop a pause draws on, as Game's test does.
    useThree: () => () => ({
        frameloop: "always",
        setFrameloop: () => undefined,
        invalidate: () => undefined,
        clock: { elapsedTime: 0 },
    }),
}));

beforeAll(loadRapier);

let world: World | undefined;
let rider: Entity | undefined;

//  The run's round and HUD over a rider going slower than a stall.
function Ride() {
    const scene = useWorld();
    useEffect(() => {
        world = scene;
        rider = scene.spawn(
            RunTrait,
            TrackMoverTrait({ speed: stallSpeed / 2 }),
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

it("warns of a stall below the stall speed while the run plays, and not on the sling", async () => {
    await act(async () => {
        render(
            <Game name="hud-test" start="run">
                <Scene name="run" component={Ride} />
            </Game>,
        );
    });
    const speed = () => screen.getByText(/km\/h/);
    expect(speed()).not.toHaveClass(palette.dangerText);

    act(() =>
        world
            ?.queryFirst(RoundTrait)
            ?.set(RoundTrait, { state: RoundState.Playing }),
    );
    expect(speed()).toHaveClass(palette.dangerText);

    act(() => rider?.set(TrackMoverTrait, { speed: stallSpeed * 2 }));
    expect(speed()).not.toHaveClass(palette.dangerText);
});
