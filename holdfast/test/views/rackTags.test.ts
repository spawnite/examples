import { describe, expect, it } from "vitest";
import {
    areTagsHidden,
    isSightBlocked,
    liftTags,
    readShaftStrength,
    readTagSight,
    type ScreenBox,
} from "../../src/views/rackTags";

//  The rack's three tags stand over their stands in the world; from most
//  places a warden stands, the stands line up and the tags would overlap.
//  Each farther tag lifts above the nearer ones it would cover.

/** A tag 100 by 30 px round `x`, `y`, `distance` metres away. */
function tag(x: number, y: number, distance: number) {
    return { x, y, width: 100, height: 30, distance };
}

it("leaves tags that do not overlap where they stand", () => {
    expect(liftTags([tag(100, 200, 5), tag(300, 200, 6)], [])).toEqual([0, 0]);
});

it("lifts a farther tag clear above the nearer one it would cover, with a gap", () => {
    const lifts = liftTags([tag(160, 205, 8), tag(100, 200, 5)], []);

    //  The nearer stays; the farther's bottom stands 4 px over its top.
    expect(lifts[1]).toBe(0);
    expect(205 + 15 + lifts[0]).toBe(200 - 15 - 4);
});

it("stacks three tags in a line of stands, nearest lowest", () => {
    const lifts = liftTags(
        [tag(100, 200, 5), tag(140, 198, 7), tag(180, 196, 9)],
        [],
    );

    expect(lifts[0]).toBe(0);
    expect(196 + lifts[2]).toBeLessThan(198 + lifts[1]);
    expect(198 + lifts[1] + 15 + 4).toBeLessThanOrEqual(200 - 15);
    expect(196 + lifts[2] + 15 + 4).toBeLessThanOrEqual(198 + lifts[1] - 15);
});

it("lifts a tag above a box it must keep clear of, such as her cards", () => {
    const hand: ScreenBox = { left: 0, top: 210, width: 800, height: 300 };

    const [lift] = liftTags([tag(100, 220, 5)], [hand]);

    expect(220 + 15 + lift).toBe(210 - 4);
});

describe("readTagSight", () => {
    const hidden = { shown: false, detail: false };
    const shown = { shown: true, detail: false };
    const near = { hidden: false, metres: 8, degrees: 10, clear: true };

    it("shows a stand's name and price within 10 m, faced and in sight", () => {
        expect(readTagSight(hidden, near)).toEqual(shown);
    });

    it("hides every tag during a wave, however near and faced", () => {
        expect(readTagSight(shown, { ...near, hidden: true })).toEqual(hidden);
    });

    it("keeps a shown tag a metre past 10 m, and shows a hidden one only inside it", () => {
        const edge = { ...near, metres: 10.6 };
        expect(readTagSight(hidden, edge)).toEqual(hidden);
        expect(readTagSight(shown, edge)).toEqual(shown);
        expect(readTagSight(shown, { ...near, metres: 11.2 })).toEqual(hidden);
    });

    it("hides a stand the camera does not face, with a margin past 30°", () => {
        expect(readTagSight(hidden, { ...near, degrees: 32 })).toEqual(hidden);
        expect(readTagSight(shown, { ...near, degrees: 34 })).toEqual(shown);
        expect(readTagSight(shown, { ...near, degrees: 40 })).toEqual(hidden);
    });

    it("hides a stand out of sight", () => {
        expect(readTagSight(shown, { ...near, clear: false })).toEqual(hidden);
    });

    it("steps aside for the Use prompt within 2.2 m, and comes back only a metre out", () => {
        expect(readTagSight(shown, { ...near, metres: 2 })).toEqual(hidden);
        expect(readTagSight(hidden, { ...near, metres: 2.8 })).toEqual(hidden);
        expect(readTagSight(hidden, { ...near, metres: 3.4 })).toEqual({
            shown: true,
            detail: true,
        });
    });

    it("adds the detail line within 4 m and keeps it a metre past", () => {
        const close = { shown: true, detail: true };
        expect(readTagSight(shown, { ...near, metres: 3.9 })).toEqual(close);
        expect(readTagSight(shown, { ...near, metres: 4.5 })).toEqual(shown);
        expect(readTagSight(close, { ...near, metres: 4.5 })).toEqual(close);
        expect(readTagSight(close, { ...near, metres: 5.2 })).toEqual(shown);
    });
});

describe("isSightBlocked", () => {
    const eye = { x: 0, y: 1.6, z: 10 };
    const tag = { x: 0, y: 2.2, z: 0 };

    it("is blocked by a body standing on the line between", () => {
        expect(isSightBlocked(eye, tag, [{ x: 0.2, y: 0, z: 5 }])).toBe(true);
    });

    it("is clear past a body beside the line", () => {
        expect(isSightBlocked(eye, tag, [{ x: 1.5, y: 0, z: 5 }])).toBe(false);
    });

    it("is clear past a body behind the stand or behind the eye", () => {
        expect(
            isSightBlocked(eye, tag, [
                { x: 0, y: 0, z: -2 },
                { x: 0, y: 0, z: 12 },
            ]),
        ).toBe(false);
    });

    it("is clear over a body the line passes above", () => {
        expect(
            isSightBlocked({ x: 0, y: 6, z: 10 }, tag, [{ x: 0, y: 0, z: 5 }]),
        ).toBe(false);
    });
});

describe("readShaftStrength", () => {
    it("is dark while the rack is shut, lit once open, and brighter where her purse meets its price", () => {
        expect(readShaftStrength({ open: false, affordable: true })).toBe(0);
        const lit = readShaftStrength({ open: true, affordable: false });
        expect(lit).toBe(1);
        expect(
            readShaftStrength({ open: true, affordable: true }),
        ).toBeGreaterThan(lit);
    });
});

describe("areTagsHidden", () => {
    it("hides the tags through a wave and under a hand that holds the screen they would cross", () => {
        const breather = {
            phase: "breather" as const,
            picking: false,
            handAtTop: false,
        };

        expect(areTagsHidden(breather)).toBe(false);
        expect(areTagsHidden({ ...breather, phase: "fight" })).toBe(true);
        expect(areTagsHidden({ ...breather, picking: true })).toBe(true);
        expect(areTagsHidden({ ...breather, handAtTop: true })).toBe(true);
    });
});
