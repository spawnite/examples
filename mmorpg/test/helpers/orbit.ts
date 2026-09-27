import CameraControlsImpl from "camera-controls";
import type { World } from "koota";
import * as THREE from "three";
import { CameraTrait } from "@spawnite/engine";

//  A real orbit, not a literal: the clamping and the spherical are the library's.
export function createOrbit(position = new THREE.Vector3(3, 2, 5)) {
    CameraControlsImpl.install({ THREE });
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(position);
    return new CameraControlsImpl(camera);
}

/** Spawns the camera the rig would, and hands back its orbit. */
export function mountOrbit(world: World, position?: THREE.Vector3) {
    const orbit = createOrbit(position);
    world.spawn(CameraTrait({ orbit }));
    return orbit;
}
