import { renderHook } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { expect, it } from "vitest";
import { createGameWorld, WelcomesTrait } from "@spawnite/engine";
import { useWelcomed } from "../../src/views/welcomed";

//  A view that eases toward the world's state stands on the state at once
//  on its first frame and on the first frame after a welcome, a join's, a
//  rejoin's or a replay's seek, since the world it shows then did not come
//  from the frames before.

it("answers true on the first frame and after each welcome, and false between", () => {
    const world = createGameWorld();
    world.add(WelcomesTrait({ count: 1 }));
    const { result } = renderHook(() => useWelcomed(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <WorldProvider world={world}>{children}</WorldProvider>
        ),
    });
    const isWelcomed = result.current;

    expect(isWelcomed()).toBe(true);
    expect(isWelcomed()).toBe(false);
    expect(isWelcomed()).toBe(false);

    world.set(WelcomesTrait, { count: 2 });
    expect(isWelcomed()).toBe(true);
    expect(isWelcomed()).toBe(false);
    world.destroy();
});

it("answers true on the first frame of a world that took no welcome, as a solo page's", () => {
    const world = createGameWorld();
    const { result } = renderHook(() => useWelcomed(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <WorldProvider world={world}>{children}</WorldProvider>
        ),
    });

    expect(result.current()).toBe(true);
    expect(result.current()).toBe(false);
    world.destroy();
});
