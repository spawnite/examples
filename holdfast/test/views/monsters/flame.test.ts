import { expect, it } from "vitest";
import {
    readFlameSize,
    readKindlePitch,
} from "../../../src/views/monsters/ElementAura";

//  A burn a warden can see build: one tongue of flame at its chest grows to
//  three over its chest and shoulders, and its crackle climbs, while the
//  flame keeps to the monster's own size.

it("lights more and taller tongues of flame as a burn's stacks build", () => {
    const lick = readFlameSize(0.125);
    const blaze = readFlameSize(1);

    expect(lick.tongues).toBe(1);
    expect(blaze.tongues).toBe(3);
    expect(blaze.height).toBeGreaterThan(lick.height * 1.5);
    expect(blaze.heat).toBeGreaterThan(lick.heat);
});

it("keeps a full burn's flame to the monster's own size", () => {
    const blaze = readFlameSize(1);

    //  A tongue under twice the monster's radius wide, and under its height.
    expect(blaze.width).toBeLessThanOrEqual(1.8);
    expect(blaze.height).toBeLessThan(1);
});

it("pitches a burn's crackle up as it builds", () => {
    expect(readKindlePitch(0.75)).toBeGreaterThan(readKindlePitch(0.25));
});
