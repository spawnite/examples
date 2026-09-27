// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { PropsWithChildren } from "react";
import { Object3D } from "three";
import { afterEach, expect, it } from "vitest";
import {
    createGameWorld,
    Ground,
    Ref,
    useLoading,
    useTime,
} from "@spawnite/engine";
import { useSceneLoaded } from "../../src/scenes/useSceneLoaded";
import { heroBuilder } from "../helpers/heroBuilder";

afterEach(() => {
    useTime.setState(useTime.getInitialState(), true);
    useLoading.setState(useLoading.getInitialState(), true);
});

//  Her model mounts beside the World's views, which wait on their models: a
//  drawn heroine, idle loaders and a running loop are not yet a loaded
//  meadow.
it("waits for the ground's views as well as her model and the loop", () => {
    const world = createGameWorld();
    heroBuilder(world).withRef(new Object3D()).spawn();
    const ground = world.spawn(Ground);
    //  Idle, as the loop reads the loaders once the models have landed.
    useTime.setState({ running: true });
    useLoading.setState({ loading: false });
    const { result, unmount } = renderHook(useSceneLoaded, {
        wrapper: ({ children }: PropsWithChildren) => (
            <WorldProvider world={world}>{children}</WorldProvider>
        ),
    });

    expect(result.current).toBe(false);

    //  As the ground's view registers its mesh, once its boundary commits.
    act(() => {
        ground.add(Ref({ object: new Object3D() }));
    });

    expect(result.current).toBe(true);
    unmount();
    world.destroy();
});
