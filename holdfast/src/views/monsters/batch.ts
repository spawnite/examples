import { useModel, useSkinnedBatch } from "@spawnite/engine";
import type { MonsterKind } from "../../siege/traits";
import { monsterModels, readModelDressing } from "./models";
import type { MonsterBatch } from "./rig";
import { createMonsterUniforms, dressBatchMaterial } from "./skin";

//  The batch that draws every monster of a model dressed one way: one
//  draw of each of the model's meshes for the lot, into the frame and into
//  the sun's shadow. At 60 husks their own draws took about 3 ms a frame.

/** The scene's batch of `kind`'s model, dressed as its kind dresses it:
 *  kinds dressed alike share it. */
export function useMonsterBatch(kind: MonsterKind): MonsterBatch {
    const model = monsterModels[kind];
    const { scene } = useModel(model.url);
    return useSkinnedBatch(scene, {
        key: readModelDressing(model),
        uniforms: createMonsterUniforms(),
        dress: (material) =>
            dressBatchMaterial(
                material,
                material.name === model.eyeMaterial,
                model.cut,
            ),
        castShadow: true,
    });
}
