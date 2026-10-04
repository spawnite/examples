import { act, render, screen } from "@testing-library/react";
import { WorldProvider } from "koota/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
    createGameWorld,
    HealthTrait,
    NetworkEntitiesTrait,
    NetworkIdTrait,
} from "@spawnite/engine";
import { BossBar } from "../../src/hud/BossBar";
import { MonsterKind, MonsterTrait, SiegeTrait } from "../../src/siege/traits";
import { nightWaves } from "../../src/siege/waves";

//  The HUD layer lives in the canvas; here it draws in place.
vi.mock("@spawnite/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@spawnite/engine")>()),
    Hud: ({ children }: { children: ReactNode }) => children,
    Panel: ({ children }: { children: ReactNode }) => children,
}));

it("keeps the boss's bar up across a welcome that brings the colossus back, so its fill does not start again from empty", () => {
    const world = createGameWorld();
    world.add(NetworkEntitiesTrait);
    const spawnColossus = (current: number) =>
        world.spawn(
            NetworkIdTrait({ id: "31.26" }),
            MonsterTrait({ kind: MonsterKind.Colossus }),
            HealthTrait({ current, maximum: 2594 }),
        );
    const first = spawnColossus(2594);
    render(
        <WorldProvider world={world}>
            <BossBar />
        </WorldProvider>,
    );
    const shown = screen.getByRole("meter");

    //  A welcome, a rejoin's or a replay's seek: the stream down and up
    //  again, the colossus in it further into the fight.
    act(() => {
        first.destroy();
        spawnColossus(2100);
    });

    const meter = screen.getByRole("meter");
    expect(meter).toBe(shown);
    expect(meter.getAttribute("aria-valuenow")).toBe("2100");
    world.destroy();
});

it("names the night's last colossus as the banner and the call do", () => {
    const world = createGameWorld();
    world.spawn(SiegeTrait({ wave: nightWaves }));
    world.spawn(
        MonsterTrait({ kind: MonsterKind.Colossus }),
        HealthTrait({ current: 5000, maximum: 5000 }),
    );
    render(
        <WorldProvider world={world}>
            <BossBar />
        </WorldProvider>,
    );

    expect(screen.queryByText("The last colossus")).not.toBeNull();
    world.destroy();
});
