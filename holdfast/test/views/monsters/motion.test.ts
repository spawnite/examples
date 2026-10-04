import { createWorld } from "koota";
import { FromWelcomeTrait, NetworkIdTrait } from "@spawnite/engine/core";
import { expect, it } from "vitest";
import {
    createMonsterMotion,
    measureProgress,
    riseSeconds,
} from "../../../src/views/monsters/motion";

//  A monster climbs out of its rift as it spawns in play, and stands up at
//  once where a page's welcome found it already there: a page that joins
//  late, rejoins, or opens a replay mid-fight.

it("stands a monster the welcome brought up at once, and has one that spawned in play climb out", () => {
    const world = createWorld();
    const there = createMonsterMotion(
        world.spawn(NetworkIdTrait({ id: "31.26" }), FromWelcomeTrait),
    );
    const spawned = createMonsterMotion(
        world.spawn(NetworkIdTrait({ id: "40" })),
    );

    //  Its first frame, at any time on the page's clock: a bornAt of
    //  -Infinity is a rise the first frame starts.
    const now = 12.5;
    const firstFrame = ({ bornAt }: { bornAt: number }) =>
        measureProgress(
            now - (bornAt === -Infinity ? now : bornAt),
            riseSeconds,
        );
    expect(firstFrame(there)).toBe(1);
    expect(firstFrame(spawned)).toBe(0);
});
