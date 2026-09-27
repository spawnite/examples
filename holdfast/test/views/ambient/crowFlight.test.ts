import { describe, expect, it } from "vitest";
import {
    CrowStage,
    crowGoneSeconds,
    readCrowFlight,
} from "../../../src/views/ambient/crowFlight";

describe("readCrowFlight", () => {
    it("sits on its stone until the first shot", () => {
        const pose = readCrowFlight(Infinity);

        expect(pose.stage).toBe(CrowStage.Perched);
        expect(pose.distance).toBe(0);
        expect(pose.height).toBe(0);
    });

    it("springs up before it flies out", () => {
        const early = readCrowFlight(0.2);

        expect(early.stage).toBe(CrowStage.Rising);
        expect(early.height).toBeGreaterThan(0);
        expect(early.height).toBeGreaterThan(early.distance);
    });

    it("climbs and draws away while it flies, never turning back", () => {
        const times = [0.1, 0.5, 1, 2, 3, 4];
        const poses = times.map(readCrowFlight);

        for (let index = 1; index < poses.length; index++) {
            expect(poses[index].distance).toBeGreaterThan(
                poses[index - 1].distance,
            );
            expect(poses[index].height).toBeGreaterThanOrEqual(
                poses[index - 1].height,
            );
        }
        expect(readCrowFlight(2).stage).toBe(CrowStage.Flying);
    });

    it("climbs steeply, so it is seen against the sky over the trees", () => {
        const midway = readCrowFlight(2);
        const last = readCrowFlight(crowGoneSeconds - 0.01);

        expect(midway.height).toBeGreaterThan(midway.distance);
        expect(last.height).toBeGreaterThan(last.distance * 0.7);
    });

    it("is out over the forest and gone once its flight ends", () => {
        const last = readCrowFlight(crowGoneSeconds - 0.01);

        expect(last.distance).toBeGreaterThan(25);
        expect(readCrowFlight(crowGoneSeconds).stage).toBe(CrowStage.Gone);
    });

    it("beats its wings faster taking off than cruising", () => {
        expect(readCrowFlight(0.2).flapRate).toBeGreaterThan(
            readCrowFlight(3).flapRate,
        );
        expect(readCrowFlight(Infinity).flapRate).toBe(0);
    });
});
