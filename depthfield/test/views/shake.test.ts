import { useSettings } from "@spawnite/engine";
import { afterEach, expect, it } from "vitest";
import { kickShake, readShake } from "../../src/views/shake";

//  The field camera's own kick answers the player's Screen shake setting,
//  as every shake the engine draws does.

afterEach(() => {
    readShake(10);
    useSettings.getState().resetSettings();
});

it("kicks the camera by the player's share of the shake", () => {
    useSettings.getState().changeSetting("cameraShake", 50);
    useSettings.getState().changeSetting("reducedMotion", false);

    kickShake(0.4);

    expect(readShake(0)).toBeCloseTo(0.2);
});

it("holds the camera still with the player's Screen shake at 0", () => {
    useSettings.getState().changeSetting("cameraShake", 0);

    kickShake(0.4);

    expect(readShake(0)).toBe(0);
});
