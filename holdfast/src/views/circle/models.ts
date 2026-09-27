import campfireLogs from "@spawnite/assets/models/holdfast/campfire-logs.glb?url";
import leaningLog from "@spawnite/assets/models/log.glb?url";
import campfireStones from "@spawnite/assets/models/holdfast/campfire-stones.glb?url";
import chippedStone from "@spawnite/assets/models/holdfast/menhir-chipped.glb?url";
import slabStone from "@spawnite/assets/models/holdfast/menhir-slab.glb?url";
import tallStone from "@spawnite/assets/models/holdfast/menhir-tall.glb?url";
import { useGLTF } from "@react-three/drei";
import { Mesh, type BufferGeometry, type Object3D } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

//  The circle's models: three standing stones the ring takes turns with,
//  and the hearth's ring of stones and its logs. Each file is drawn with
//  the circle's own materials, so only its shape is read.

/** The standing stones' shapes, each 0.62 to 0.81 tall in its file. */
export const standingStoneModels = [slabStone, chippedStone, tallStone];
export const hearthStonesModel = campfireStones;
export const hearthLogsModel = campfireLogs;
/** A log 0.71 long, leant in over the fire. */
export const hearthLeaningLogModel = leaningLog;

const allModels = [
    ...standingStoneModels,
    campfireStones,
    campfireLogs,
    leaningLog,
];

/** Starts fetching every model while the page shows its menu. */
export function preloadCircleModels() {
    for (const url of allModels) useGLTF.preload(url);
}

const mergedShapes = new WeakMap<Object3D, BufferGeometry>();

/** A model's meshes as one geometry in their own frame, its foot at 0,
 *  merged once per file and shared by every stone drawn with it. */
export function useModelShape(url: string): BufferGeometry {
    const { scene } = useGLTF(url);
    const known = mergedShapes.get(scene);
    if (known) return known;
    const parts: BufferGeometry[] = [];
    scene.traverse((object) => {
        if (object instanceof Mesh) parts.push(object.geometry);
    });
    const shape = mergeGeometries(parts) ?? parts[0];
    mergedShapes.set(scene, shape);
    return shape;
}
