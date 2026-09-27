import type { Entity } from "koota";
import { createWorld } from "koota";
import { Clock } from "three";
import { describe, expect, it, vi } from "vitest";
import { HealthTrait, type ShotResult } from "@spawnite/engine";
import {
    holdFrames,
    isOwnKill,
    resumeFrames,
    type FrameLoop,
} from "../../src/views/HitStop";

function shot(shooter: string, targets: string[]): ShotResult {
    return {
        shooter,
        weapon: "blaster",
        origin: [0, 0, 0],
        end: [0, 0, 5],
        hits: targets.map((target) => ({ target, damage: 10 })),
    };
}

describe("isOwnKill", () => {
    const world = createWorld();
    const standing = world.spawn(HealthTrait({ current: 20, maximum: 30 }));
    const fallen = world.spawn(HealthTrait({ current: 0, maximum: 30 }));
    const entities = new Map<string, Entity>([
        ["7", standing],
        ["8", fallen],
    ]);

    it("is a kill when her shot hit a monster that left the stream", () => {
        expect(isOwnKill([shot("1", ["9"])], { heroId: "1", entities })).toBe(
            true,
        );
    });

    it("is a kill when her shot left a monster at no health", () => {
        expect(isOwnKill([shot("1", ["8"])], { heroId: "1", entities })).toBe(
            true,
        );
    });

    it("is no kill when the monster she hit still stands", () => {
        expect(isOwnKill([shot("1", ["7"])], { heroId: "1", entities })).toBe(
            false,
        );
    });

    it("is no kill of hers when another warden's shot killed", () => {
        expect(isOwnKill([shot("2", ["9"])], { heroId: "1", entities })).toBe(
            false,
        );
    });

    it("is no kill for a miss", () => {
        expect(isOwnKill([shot("1", [])], { heroId: "1", entities })).toBe(
            false,
        );
    });
});

/** A loop whose switch does what fiber 9.8's `setFrameloop` does to its
 *  clock: it stops it and zeroes it, and starts it again for anything but
 *  "never". */
function createLoop(): FrameLoop {
    const loop: FrameLoop = {
        clock: new Clock(false),
        frameloop: "always",
        setFrameloop: (frameloop = "always") => {
            loop.clock.stop();
            loop.clock.elapsedTime = 0;
            if (frameloop !== "never") {
                loop.clock.start();
                loop.clock.elapsedTime = 0;
            }
            loop.frameloop = frameloop;
        },
    };
    loop.clock.start();
    return loop;
}

describe("a hit stop's hold", () => {
    it("keeps the clock the page's effects age on", () => {
        const loop = createLoop();
        loop.clock.elapsedTime = 120;

        const heldSince = holdFrames(loop);
        resumeFrames(loop, heldSince);

        expect(loop.frameloop).toBe("always");
        expect(loop.clock.elapsedTime).toBeGreaterThanOrEqual(120);
    });

    it("hands the held time to the next frame, so the page catches up", () => {
        vi.useFakeTimers({ toFake: ["performance"] });
        const loop = createLoop();
        loop.clock.getDelta();

        const heldSince = holdFrames(loop);
        vi.advanceTimersByTime(50);
        resumeFrames(loop, heldSince);

        expect(loop.clock.getDelta()).toBeCloseTo(0.05, 2);
        vi.useRealTimers();
    });
});
