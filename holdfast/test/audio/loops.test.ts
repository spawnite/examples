import { expect, it } from "vitest";
import { blendLoopSeam } from "../../src/audio/loops";

//  A recording played as a loop: its tail is blended into its head, so the
//  last sample runs on into the first with no jump, whatever the recording.

/** 0, 1, 2 ... up to `length` - 1: a signal whose seam jump is plain. */
function rampOf(length: number) {
    return Float32Array.from({ length }, (_, index) => index);
}

it("runs the loop's end on into its start with no jump", () => {
    const loop = blendLoopSeam(rampOf(10), 4);

    //  Six samples: the last is the ramp's 5, and the first is where the
    //  ramp went on, its 6.
    expect(Array.from(loop)).toHaveLength(6);
    expect(loop[5]).toBe(5);
    expect(loop[0]).toBe(6);
});

it("blends the tail out and the head in over the fade, at equal power", () => {
    const loop = blendLoopSeam(rampOf(10), 4);

    //  Halfway through the fade both weigh the square root of a half:
    //  2 × 0.7071 + 8 × 0.7071.
    expect(loop[2]).toBeCloseTo(7.0711, 3);
});

it("keeps what lies past the fade as recorded", () => {
    const loop = blendLoopSeam(rampOf(10), 4);

    expect(Array.from(loop.slice(4))).toEqual([4, 5]);
});
