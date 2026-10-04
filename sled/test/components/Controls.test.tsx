import { useThree } from "@react-three/fiber";
import { act, fireEvent, render } from "@testing-library/react";
import type { Entity } from "koota";
import { useWorld } from "koota/react";
import { useEffect } from "react";
import { Vector2 } from "three";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
    Game,
    loadRapier,
    Scene,
    TrackMoverTrait,
    useInput,
} from "@spawnite/engine";
import { Controls } from "../../src/components/Controls";
import { Track } from "../../src/levels";
import { RunMachine, RunTrait } from "../../src/ride/course";
import { SlingTrait } from "../../src/ride/sling";

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);

beforeAll(loadRapier);

let rider: Entity | undefined;
let canvas: HTMLCanvasElement;
const steer = vi.fn<(direction: Vector2) => void>();
const jump = vi.fn<() => void>();
const verbs = useInput.getState();

beforeEach(() => useInput.setState({ steer, jump }));
afterEach(() => {
    useInput.setState({ steer: verbs.steer, jump: verbs.jump });
    steer.mockClear();
    jump.mockClear();
});

//  The run's controls over a rider on the sling.
function Ride() {
    const scene = useWorld();
    canvas = useThree((state) => state.gl.domElement);
    useEffect(() => {
        rider = scene.spawn(RunTrait, SlingTrait, TrackMoverTrait);
        return () => rider?.destroy();
    }, [scene]);
    return <Controls />;
}

async function mount() {
    await act(async () => {
        render(
            <Game name="controls-test" start="run" levels={Track}>
                <Scene name="run" component={Ride} />
            </Game>,
        );
    });
    return canvas;
}

//  A full pull, aim or steer is a drag of 30% of the screen's shorter side.
const span = () => Math.min(window.innerWidth, window.innerHeight) * 0.3;

it("pulls the sling as far as the drag goes down, aims it across, and fires on release", async () => {
    const surface = await mount();
    fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
    });
    fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 100 - span() / 2,
        clientY: 100 + span() / 2,
    });
    expect(rider?.get(SlingTrait)).toMatchObject({
        targetCharge: 0.5,
        targetSide: -0.5,
    });
    expect(jump).not.toHaveBeenCalled();

    fireEvent.pointerUp(document, { pointerId: 1 });
    expect(jump).toHaveBeenCalledOnce();
});

it("fires a tap on the sling from the half-draw, whatever a cancelled drag left", async () => {
    const surface = await mount();
    fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
    });
    fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 100,
        clientY: 100 + span(),
    });
    fireEvent.pointerCancel(document, { pointerId: 1 });
    expect(jump).not.toHaveBeenCalled();

    fireEvent.pointerDown(surface, {
        pointerId: 2,
        clientX: 100,
        clientY: 100,
    });
    fireEvent.pointerMove(document, {
        pointerId: 2,
        clientX: 100,
        clientY: 102,
    });
    fireEvent.pointerUp(document, { pointerId: 2 });
    expect(rider?.get(SlingTrait)?.targetCharge).toBe(0.5);
    expect(jump).toHaveBeenCalledOnce();
});

it("steers by the drag across once riding, and lets go on release without a jump", async () => {
    const surface = await mount();
    act(() => {
        if (rider) RunMachine.send(rider, "LAUNCH");
    });
    fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
    });
    fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 100 + span(),
        clientY: 100,
    });
    expect(steer).toHaveBeenLastCalledWith(new Vector2(1, 0));

    fireEvent.pointerUp(document, { pointerId: 1 });
    expect(steer).toHaveBeenLastCalledWith(new Vector2(0, 0));
    expect(jump).not.toHaveBeenCalled();
});

it("jumps on a tap anywhere once riding", async () => {
    const surface = await mount();
    act(() => {
        if (rider) RunMachine.send(rider, "LAUNCH");
    });
    fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 300,
        clientY: 200,
    });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 302, clientY: 201 });
    expect(jump).toHaveBeenCalledOnce();
});

it("lets go of a drag when the window loses focus, so a later move steers nothing", async () => {
    const surface = await mount();
    act(() => {
        if (rider) RunMachine.send(rider, "LAUNCH");
    });
    fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
    });
    fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 100 + span(),
        clientY: 100,
    });
    fireEvent.blur(window);
    expect(steer).toHaveBeenLastCalledWith(new Vector2(0, 0));

    steer.mockClear();
    fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 100 + span(),
        clientY: 100,
    });
    fireEvent.pointerUp(document, { pointerId: 1 });
    expect(steer).not.toHaveBeenCalled();
    expect(jump).not.toHaveBeenCalled();
});

it("jumps on a second finger's tap while the first steers", async () => {
    const surface = await mount();
    act(() => {
        if (rider) RunMachine.send(rider, "LAUNCH");
    });
    fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
    });
    fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 100 + span(),
        clientY: 100,
    });
    fireEvent.pointerDown(surface, {
        pointerId: 2,
        clientX: 500,
        clientY: 300,
    });
    fireEvent.pointerUp(document, { pointerId: 2 });
    expect(jump).toHaveBeenCalledOnce();
    expect(steer).toHaveBeenLastCalledWith(new Vector2(1, 0));
});

it("lets go of a steer whose release reaches only the window", async () => {
    const surface = await mount();
    act(() => {
        if (rider) RunMachine.send(rider, "LAUNCH");
    });
    fireEvent.pointerDown(surface, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
    });
    fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 100 + span(),
        clientY: 100,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(steer).toHaveBeenLastCalledWith(new Vector2(0, 0));
});
