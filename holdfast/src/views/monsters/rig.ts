import type { TraitRecord } from "koota";
import {
    AnimationMixer,
    Mesh,
    LoopOnce,
    LoopRepeat,
    SkinnedMesh,
    type AnimationAction,
    type AnimationClip,
    type Material,
    type MeshStandardMaterial,
    type Object3D,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { SkinnedBatch, SkinnedCopy } from "@spawnite/engine";
import { MonsterKind, type MonsterTrait } from "../../siege/traits";
import { measureDrawnSize } from "../../siege/weakSpots";
import { addCoreGlow, type CoreGlow } from "./core";
import { readMonsterLook } from "../palette";
import { createMark, hideMarks, MarkKind, type Mark } from "./marks";
import { MonsterClip, monsterModels } from "./models";
import {
    addEyeGlows,
    batchSkin,
    createMonsterSkin,
    dressMaterial,
    type MonsterSkin,
    type MonsterUniforms,
} from "./skin";

//  One monster's own copy of its kind's model: its bones, the mixer that
//  plays its clips, its tint, so a hit flashes it alone, and the soft
//  shadow under it. Its kind's batch draws it with every other of its kind
//  where it is given one; without one, as the colossus, it draws on its own
//  with its own materials. An elite wears its modifier's colours and
//  stands larger, and so does one the room sizes up, as the night's last
//  colossus.

/** The batch that draws a kind's copies. */
export type MonsterBatch = SkinnedBatch<MonsterUniforms>;

export interface MonsterRig {
    object: Object3D;
    /** Its model's scale in the world, an elite's larger. */
    scale: number;
    /** How much larger it stands than its kind: 1, or an elite's size,
     *  times the size the room gave it. */
    size: number;
    mixer: AnimationMixer;
    actions: Partial<Record<MonsterClip, AnimationAction>>;
    /** Its tint: its own materials, or its copy's values in its batch. */
    skin: MonsterSkin;
    /** Its kind's batch, which draws it from `joinBatch` on; none draws it
     *  on its own. */
    batch: MonsterBatch | undefined;
    /** Its place in the batch, while it is in it. */
    copy: SkinnedCopy<MonsterUniforms> | undefined;
    /** What its skin in the batch is tinted by. */
    look: { body: string; eyeMaterial?: string };
    /** Where its shadow lies on the ground, laid flat, and metres across
     *  it. */
    shadow: Object3D;
    shadowMetres: number;
    /** What it draws beside its body, its shadow, its eyes' glows and a
     *  colossus's core, from `showMarks` until it is disposed of. */
    marks: Mark[];
    /** A colossus's glowing core, where its weak spot is; none on the
     *  rest. */
    core: CoreGlow;
}

interface LoadedModel {
    scene: Object3D;
    animations: AnimationClip[];
}

function isStandard(material: Material): material is MeshStandardMaterial {
    return "emissive" in material;
}

/** Which monster a rig draws: its kind, its modifier if an elite, and the
 *  size the room gave it, 1 when left out. */
type MonsterBreed = Pick<TraitRecord<typeof MonsterTrait>, "kind" | "elite"> & {
    size?: number;
};

/** A rig of `breed`, drawn in `batch`, its kind's, once it joins it, or on
 *  its own without one. Making one adds it to nothing, so a render may make
 *  one and drop it. */
export function createMonsterRig(
    { scene, animations }: LoadedModel,
    { kind, elite, size: grown = 1 }: MonsterBreed,
    batch?: MonsterBatch,
): MonsterRig {
    const model = monsterModels[kind];
    const look = readMonsterLook(kind, elite);
    const size = measureDrawnSize(elite, grown);
    const object = clone(scene);
    const skin = createMonsterSkin(look, { seams: model.seams });
    object.traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        mesh.castShadow = true;
        //  The bind pose's bounds miss a limb the clips swing out.
        mesh.frustumCulled = false;
        if (batch) return;
        const materials: Material[] = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
        const own = materials.map((material) => {
            const copy = material.clone();
            if (isStandard(copy))
                dressMaterial({
                    skin,
                    material: copy,
                    look,
                    eyes: material.name === model.eyeMaterial,
                    cut: model.cut,
                });
            return copy;
        });
        mesh.material = own.length === 1 ? own[0] : own;
    });
    const eyes = model.eyeSprites
        ? addEyeGlows({ object, sprites: model.eyeSprites, color: look.eyes })
        : [];
    const core: CoreGlow =
        kind === MonsterKind.Colossus
            ? addCoreGlow({ object, scale: model.scale, color: look.eyes })
            : { marks: [], colors: [] };
    const shadow = createMark(MarkKind.Shadow);
    shadow.object.rotation.x = -Math.PI / 2;
    shadow.object.scale.setScalar(model.shadowMetres * size);
    const mixer = new AnimationMixer(object);
    const actions: MonsterRig["actions"] = {};
    for (const [clip, ending] of Object.entries(model.clips)) {
        const found = animations.find((animation) =>
            animation.name.endsWith(ending),
        );
        if (!found) continue;
        const action = mixer.clipAction(found);
        const once = clip === MonsterClip.Fall || clip === MonsterClip.Flinch;
        action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
        action.clampWhenFinished = clip === MonsterClip.Fall;
        actions[clip as MonsterClip] = action;
    }
    return {
        object,
        scale: model.scale * size,
        size,
        mixer,
        actions,
        skin,
        batch,
        copy: undefined,
        look: { body: look.body, eyeMaterial: model.eyeMaterial },
        shadow: shadow.object,
        shadowMetres: model.shadowMetres * size,
        marks: [shadow, ...eyes, ...core.marks],
        core,
    };
}

/** Draws `rig` in its batch from the next draw, where it has one and is
 *  not in it already. */
export function joinBatch(rig: MonsterRig) {
    if (!rig.batch || rig.copy) return;
    rig.copy = rig.batch.addCopy(rig.object);
    batchSkin(rig.skin, rig.copy.parts, rig.look);
}

/** Takes `rig` out of its batch. */
export function leaveBatch(rig: MonsterRig) {
    rig.copy?.remove();
    rig.copy = undefined;
    rig.skin.parts.length = 0;
}

export function disposeMonsterRig(rig: MonsterRig) {
    const { object, mixer, skin, shadow, marks } = rig;
    hideMarks(marks);
    leaveBatch(rig);
    mixer.stopAllAction();
    mixer.uncacheRoot(object);
    shadow.removeFromParent();
    for (const material of [...skin.body, ...skin.eyes]) material.dispose();
    //  Each skeleton's bone texture, which the GPU keeps until it is freed.
    object.traverse((part) => {
        if (part instanceof SkinnedMesh) part.skeleton.dispose();
    });
}
