import { createWorld } from "koota";
import { expect, it } from "vitest";
import { GunId } from "../../../src/siege/guns";
import { readShotLook } from "../../../src/weapons/looks";
import {
    forgetKnock,
    measureKnock,
    noteKnock,
    takeKnock,
} from "../../../src/views/monsters/knockback";

//  A hit pushes a monster's body back by the weight of the gun that dealt
//  it, as the room's shot results name it: the heaviest of the hits a page
//  has not yet drawn, and a blaster bolt's where no shot named one, as for
//  a burn's tick.

const blaster = readShotLook(GunId.Blaster).knock;
const rail = readShotLook(GunId.Rail).knock;

it("pushes by the heaviest gun that hit it since its last push", () => {
    const monster = createWorld().spawn();
    noteKnock(monster, blaster);
    noteKnock(monster, rail);
    noteKnock(monster, blaster);

    expect(takeKnock(monster)).toEqual(rail);
    //  Taken: the next hit starts afresh.
    expect(takeKnock(monster)).toEqual(blaster);
});

it("pushes as a blaster bolt does where no shot named the hit", () => {
    const monster = createWorld().spawn();

    expect(takeKnock(monster)).toEqual(blaster);
});

it("forgets a push for a monster that left before it was drawn", () => {
    const monster = createWorld().spawn();
    noteKnock(monster, rail);
    forgetKnock(monster);

    expect(takeKnock(monster)).toEqual(blaster);
});

it("jumps back the whole push and eases home over its seconds", () => {
    expect(measureKnock(0, rail)).toBeCloseTo(rail.metres);
    const early = measureKnock(rail.seconds * 0.25, rail);
    const late = measureKnock(rail.seconds * 0.75, rail);
    expect(early).toBeLessThan(rail.metres);
    expect(late).toBeLessThan(early);
    expect(late).toBeGreaterThan(0);
    expect(measureKnock(rail.seconds, rail)).toBe(0);
    expect(measureKnock(Infinity, rail)).toBe(0);
});
