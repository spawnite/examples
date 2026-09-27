// @vitest-environment jsdom
import { createGameWorld } from "@spawnite/engine";
import * as THREE from "three";
import { expect, it } from "vitest";
import { cameraSettings, readCameraFraming } from "@spawnite/engine";
import { loadCamera } from "../src/save";
import { createSaveStore } from "@spawnite/engine";
import { buildSave } from "./helpers/save";
import { createMemoryStorage } from "./helpers/memoryStorage";
import { mountOrbit } from "./helpers/orbit";

//  A wheel and a drag can only leave a framing the same clamp already passed,
//  so a stored save is the one path that offers the controls a framing from
//  outside the bounds.
it.each([
    {
        camera: { azimuth: 1, polar: 3.1, distance: 40 },
        framing: {
            azimuth: 1,
            polar: cameraSettings.maxPolarAngle,
            distance: cameraSettings.maxDistance,
        },
    },
    {
        camera: { azimuth: -1, polar: 0.05, distance: 0.2 },
        framing: {
            azimuth: -1,
            polar: cameraSettings.minPolarAngle,
            distance: cameraSettings.minDistance,
        },
    },
])("restores the framing $camera inside the bounds", ({ camera, framing }) => {
    const world = createGameWorld();
    const controls = mountOrbit(world);
    controls.minDistance = cameraSettings.minDistance;
    controls.maxDistance = cameraSettings.maxDistance;
    controls.minPolarAngle = cameraSettings.minPolarAngle;
    controls.maxPolarAngle = cameraSettings.maxPolarAngle;
    const { storage } = createMemoryStorage(
        new Map([
            [
                "three-mmorpg-save",
                JSON.stringify({ ...buildSave(new THREE.Vector3()), camera }),
            ],
        ]),
    );

    loadCamera(world, {
        store: createSaveStore(() => storage, { key: "three-mmorpg-save" }),
    });

    expect(readCameraFraming(world)).toEqual(framing);

    world.destroy();
});
