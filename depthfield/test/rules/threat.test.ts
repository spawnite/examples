import { expect, it } from "vitest";
import { readThreat } from "../../src/rules/threat";

//  The threat grows the enemies' health and damage with the run's clock and
//  the soldier's level, so the field keeps up with the upgrades.

function readAt(time: number, level: number) {
    return { ...readThreat({ time, level }) };
}

it("keeps the first minute near the clock's old growth", () => {
    const minute = readAt(60, 5);
    expect(minute.health).toBeCloseTo(1.25, 1);
    expect(minute.damage).toBeLessThan(1.15);
});

it("keeps growing past three minutes", () => {
    const boss = readAt(180, 14);
    const later = readAt(300, 14);
    expect(later.health).toBeGreaterThan(boss.health);
    expect(later.damage).toBeGreaterThan(boss.damage);
});

it("grows with the soldier's level, the damage more gently", () => {
    const low = readAt(150, 5);
    const high = readAt(150, 12);
    expect(high.health).toBeGreaterThan(low.health);
    expect(high.damage).toBeGreaterThan(low.damage);
    expect(high.damage - 1).toBeLessThan(high.health - 1);
});

it("grows an elite and the boss by the level alone", () => {
    const early = { ...readThreat({ time: 0, level: 14 }, true) };
    const late = { ...readThreat({ time: 600, level: 14 }, true) };
    expect(late).toEqual(early);
    expect(early.health).toBeGreaterThan(1);
});
