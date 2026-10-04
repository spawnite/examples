// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { useWorld } from "koota/react";
import type { World } from "koota";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { findSaveSession, loadRapier, LootLeftTrait } from "@spawnite/engine";
import { resetPersistedStores, resetPageSave } from "@spawnite/engine/testing";
import { App } from "../../src/app/App";

//  The game's own Game passes its declaration, and loads the player's record
//  through it: the meadow, in place of its scene, reads what it got.

vi.mock("@react-three/fiber", async () =>
    (await import("@spawnite/testing/fiber")).fakeFiber(),
);
vi.mock("@react-three/drei", async (importOriginal) =>
    (await import("@spawnite/testing/fiber")).fakeDrei(importOriginal),
);
vi.mock("../../src/app/devtools", () => ({ default: () => null }));
const opened: { world?: World } = {};
vi.mock("../../src/scenes/Meadow", () => ({
    Meadow: () => {
        opened.world = useWorld();
        return null;
    },
}));

beforeAll(loadRapier);
afterEach(async () => {
    cleanup();
    await resetPageSave();
    resetPersistedStores();
    localStorage.clear();
});

it("opens on the player's record, read through the saves it declares", async () => {
    localStorage.setItem(
        "three-mmorpg-record",
        JSON.stringify({
            engine: {
                loot: { version: 1, state: { left: { "meadow-ring": 0 } } },
            },
        }),
    );
    await act(async () => {
        render(<App />);
    });

    expect(
        findSaveSession(opened.world!)?.owners.map(({ key }) => key),
    ).toEqual([
        "engine.hero",
        "engine.stats",
        "engine.inventory",
        "engine.resources",
        "engine.loot",
    ]);
    expect(opened.world!.get(LootLeftTrait)).toEqual({ "meadow-ring": 0 });
});
