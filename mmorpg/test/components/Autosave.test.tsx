// @vitest-environment jsdom
import { act, create } from "@react-three/test-renderer";
import type { World } from "koota";
import { WorldProvider } from "koota/react";
import { ErrorBoundary } from "react-error-boundary";
import type { ComponentProps } from "react";
import { Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    createGameStores,
    createGameWorld,
    frameCamera,
    GameStoresContext,
    Transform,
    useTime,
    type GameStores,
} from "@spawnite/engine";
import { readSave } from "@spawnite/schema";
import { Autosave } from "../../src/components/Autosave";
import { CameraMemory } from "../../src/components/CameraMemory";
import { autosaveSettings } from "../../src/save";
import { heroBuilder } from "../helpers/heroBuilder";
import { mountOrbit } from "../helpers/orbit";

//  Built after the clear, so no case opens on the save the last one wrote.
let stores: GameStores;
beforeEach(() => {
    localStorage.clear();
    stores = createGameStores("three-mmorpg");
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    //  As the engine's loop says once it has mounted, which these cases
    //  leave out.
    useTime.setState({ running: true });
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useTime.setState(useTime.getInitialState(), true);
});

interface GameProps {
    world: World;
    onError?: ComponentProps<typeof ErrorBoundary>["onError"];
}

/** The camera's memory and the save under test, over an orbit the case
 *  mounts as the engine's Camera would. */
function Game({ world, onError }: GameProps) {
    return (
        <ErrorBoundary fallback={null} onError={onError}>
            <GameStoresContext value={stores}>
                <WorldProvider world={world}>
                    <CameraMemory />
                    <Autosave />
                </WorldProvider>
            </GameStoresContext>
        </ErrorBoundary>
    );
}

//  Both save triggers are exercised on the store the game uses: jsdom gives
//  these cases a real local storage.
const savedKey = "three-mmorpg-save";

//  A save that is there and unreadable is not nothing: the cases that assert
//  nothing was written read the key itself rather than this.
function readStoredGameSave() {
    const stored: unknown = JSON.parse(
        localStorage.getItem(savedKey) ?? "null",
    );
    const save = readSave(stored);
    return save.success ? save.data : null;
}

function hidePage() {
    Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

it("saves the game once the frames have added up to the interval", async () => {
    const world = createGameWorld();
    mountOrbit(world);
    const hero = heroBuilder(world).spawn();
    const renderer = await create(<Game world={world} />);
    hero.set(Transform, new Vector3(7, 0.5, -3));
    //  Inside the rig's own stops, which the game's camera is always within:
    //  a framing past them is the clamp's case, not the save's.
    const framing = { azimuth: 2, polar: 1, distance: 4 };
    frameCamera(world, framing);

    await renderer.advanceFrames(1, autosaveSettings.seconds - 1);
    expect(localStorage.getItem(savedKey)).toBeNull();

    await renderer.advanceFrames(1, 1);

    expect(readStoredGameSave()?.hero?.position).toStrictEqual(
        new Vector3(7, 0.5, -3),
    );
    expect(readStoredGameSave()?.camera).toEqual(framing);
    await renderer.unmount();
    world.destroy();
});

it("saves when the page hides, long before the interval", async () => {
    const world = createGameWorld();
    const orbit = mountOrbit(world);
    const hero = heroBuilder(world).spawn();
    vi.spyOn(stores.save, "getState").mockReturnValue({
        ...stores.save.getState(),
        initialSave: {
            hero: heroBuilder().toSave(),
            camera: { azimuth: 3, polar: 1, distance: 7 },
        },
    });
    const renderer = await create(<Game world={world} />);
    expect(orbit.azimuthAngle).toBe(3);
    hero.set(Transform, new Vector3(4, 0.5, 1));
    frameCamera(world, { azimuth: -2, polar: 1.2, distance: 5 });

    await renderer.advanceFrames(1, 0.25);
    expect(localStorage.getItem(savedKey)).toBeNull();

    hidePage();

    expect(readStoredGameSave()?.hero?.position).toStrictEqual(
        new Vector3(4, 0.5, 1),
    );
    expect(readStoredGameSave()?.camera).toEqual({
        azimuth: -2,
        polar: 1.2,
        distance: 5,
    });
    await renderer.unmount();
    world.destroy();
});

it("writes nothing from a frame or a page event once the loop has stopped", async () => {
    const world = createGameWorld();
    mountOrbit(world);
    const hero = heroBuilder(world).spawn();
    const renderer = await create(<Game world={world} />);
    hero.set(Transform, new Vector3(7, 0.5, -3));
    //  As the engine's loop says in the frame one of its systems throws: the
    //  world may be half stepped, so neither trigger writes it.
    useTime.setState({ running: false });

    await renderer.advanceFrames(1, autosaveSettings.seconds);
    hidePage();

    expect(localStorage.getItem(savedKey)).toBeNull();
    await renderer.unmount();
    world.destroy();
});

it("writes nothing from a frame or a page event once a save has thrown", async () => {
    const world = createGameWorld();
    mountOrbit(world);
    const hero = heroBuilder(world)
        .at(new Vector3(5, 0.5, 5))
        .spawn();
    const onError = vi.fn();
    const renderer = await create(<Game world={world} onError={onError} />);
    //  Only a broken simulation puts this in a transform, and the save is
    //  what meets it.
    hero.set(Transform, new Vector3(NaN, 0.5, 5));

    //  One batch, before the boundary commits the fallback that takes the
    //  save out of the tree: what leaves the key empty here is the stop
    //  flag, not an unmounted frame callback and unbound listeners.
    await act(async () => {
        await renderer.advanceFrames(1, autosaveSettings.seconds);
        hero.set(Transform, new Vector3(6, 0.5, 5));
        await renderer.advanceFrames(1, autosaveSettings.seconds);
        hidePage();
    });

    expect(onError).toHaveBeenCalledOnce();
    expect(localStorage.getItem(savedKey)).toBeNull();
    await renderer.unmount();
    world.destroy();
});

it("carries an invariant a page event meets first to the boundary", async () => {
    const world = createGameWorld();
    mountOrbit(world);
    const hero = heroBuilder(world)
        .at(new Vector3(2, 0.5, 2))
        .spawn();
    const onError = vi.fn();
    const renderer = await create(<Game world={world} onError={onError} />);
    await renderer.advanceFrames(1, 0.25);

    //  The frame after the event runs in the same batch, before the boundary
    //  commits, so what keeps it from saving the good position is the flag
    //  the page event set.
    hero.set(Transform, new Vector3(NaN, 0.5, 2));
    await act(async () => {
        hidePage();
        hero.set(Transform, new Vector3(3, 0.5, 2));
        await renderer.advanceFrames(1, autosaveSettings.seconds);
    });

    expect(onError).toHaveBeenCalledOnce();
    expect(localStorage.getItem(savedKey)).toBeNull();
    await renderer.unmount();
    world.destroy();
});
