import { expect, it, vi } from "vitest";
import { levels, Track } from "../../src/levels";
import { loadLevel } from "../../src/scenes/Run";
import { buildSlopeSurface } from "../../src/track/surface";

//  The surface takes seconds to build under load; counted, not built.
vi.mock("../../src/track/surface", () => ({
    buildSlopeSurface: vi.fn(() => null),
}));

it("builds the level `current` names, once", () => {
    const third = loadLevel(Track.Three);
    expect(third.level).toBe(levels[Track.Three]);
    expect(loadLevel(Track.Three)).toBe(third);
    expect(loadLevel(Track.One).level).toBe(levels[Track.One]);
    expect(buildSlopeSurface).toHaveBeenCalledTimes(2);
});
