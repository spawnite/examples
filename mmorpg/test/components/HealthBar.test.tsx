// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { createGameWorld } from "@spawnite/engine";
import { WorldProvider } from "koota/react";
import { expect, it, vi } from "vitest";
import { HealthTrait } from "@spawnite/engine";
import { HealthBar } from "../../src/components/HealthBar";

vi.mock("@react-three/drei", async (importOriginal) =>
    (await import("@spawnite/testing/fiber")).fakeDrei(importOriginal, {
        Html: ({ children }: PropsWithChildren) => <div>{children}</div>,
    }),
);

it("subscribes to health and hides when the trait is absent", () => {
    const world = createGameWorld();
    const entity = world.spawn();
    const { unmount } = render(
        <WorldProvider world={world}>
            <HealthBar entity={entity} height={1.7} />
        </WorldProvider>,
    );
    try {
        expect(screen.queryByRole("meter")).not.toBeInTheDocument();
        act(() => entity.add(HealthTrait({ current: 60, maximum: 120 })));
        const bar = screen.getByRole("meter", { name: "Hero health" });
        expect(bar).toHaveAttribute("aria-valuenow", "60");
        expect(bar).toHaveAttribute("aria-valuemax", "120");
        act(() => entity.set(HealthTrait, { current: 30, maximum: 90 }));
        expect(bar).toHaveAttribute("aria-valuenow", "30");
        expect(bar).toHaveAttribute("aria-valuemax", "90");
        act(() => entity.remove(HealthTrait));
        expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    } finally {
        unmount();
        world.destroy();
    }
});
