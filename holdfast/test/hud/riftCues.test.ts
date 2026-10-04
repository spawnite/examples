import { expect, it } from "vitest";
import { fadeCue, measureCueScale, placeCue } from "../../src/hud/RiftCues";
import { MonsterKind } from "../../src/siege/traits";

const screen = { width: 1920, height: 1080 };

it("stands a cue at the top edge for a rift ahead, the right edge for one to her right, and the bottom for one behind", () => {
    const ahead = placeCue(0, screen);
    const right = placeCue(Math.PI / 2, screen);
    const behind = placeCue(Math.PI, screen);

    expect(ahead.x).toBeCloseTo(0);
    expect(ahead.y).toBeGreaterThan(400);
    expect(right.x).toBeGreaterThan(800);
    expect(right.y).toBeCloseTo(0);
    expect(behind.y).toBeLessThan(-400);
    //  Inside the screen, clear of its edges.
    for (const place of [ahead, right, behind]) {
        expect(Math.abs(place.x)).toBeLessThan(screen.width / 2);
        expect(Math.abs(place.y)).toBeLessThan(screen.height / 2);
    }
});

it("holds a cue at full strength a moment, then fades it out", () => {
    expect(fadeCue(0)).toBe(1);
    expect(fadeCue(1)).toBe(1);
    expect(fadeCue(2)).toBeGreaterThan(0);
    expect(fadeCue(2)).toBeLessThan(1);
    expect(fadeCue(3)).toBe(0);
});

it("draws a colossus's cue largest, and the first waves' larger than later ones", () => {
    expect(measureCueScale(MonsterKind.Colossus, 10)).toBeGreaterThan(
        measureCueScale(MonsterKind.Husk, 1),
    );
    expect(measureCueScale(MonsterKind.Husk, 1)).toBeGreaterThan(
        measureCueScale(MonsterKind.Husk, 4),
    );
});
