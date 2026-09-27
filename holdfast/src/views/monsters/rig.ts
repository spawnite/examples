import type { TraitRecord } from "koota";
import {
    AnimationMixer,
    Mesh,
    LoopOnce,
    LoopRepeat,
    type AnimationAction,
    type AnimationClip,
    type Material,
    type MeshStandardMaterial,
    type Object3D,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { EliteModifier, type MonsterTrait } from "../../siege/traits";
import { readMonsterLook } from "../palette";
import { MonsterClip, monsterModels } from "./models";
import { readShadowGeometry, readShadowMaterial } from "./shadow";
import {
    addEyeSprites,
    createMonsterSkin,
    dressMaterial,
    type MonsterSkin,
} from "./skin";

//  One monster's own copy of its kind's model: its bones, its materials,
//  so a hit flashes it alone, the mixer that plays its clips, and the soft
//  shadow under it. An elite wears its modifier's colours and stands
//  larger.

/** How much larger an elite stands than its kind. */
const eliteSize = 1.15;

export interface MonsterRig {
    object: Object3D;
    /** Its model's scale in the world, an elite's larger. */
    scale: number;
    /** How much larger it stands than its kind: 1, or an elite's size. */
    size: number;
    mixer: AnimationMixer;
    actions: Partial<Record<MonsterClip, AnimationAction>>;
    /** Its own materials, the ones the flash and the wind-up light. */
    skin: MonsterSkin;
    /** Its shadow on the ground, laid flat, and metres across it. */
    shadow: Mesh;
    shadowMetres: number;
}

interface LoadedModel {
    scene: Object3D;
    animations: AnimationClip[];
}

function isStandard(material: Material): material is MeshStandardMaterial {
    return "emissive" in material;
}

/** Which monster a rig draws: its kind, and its modifier if an elite. */
type MonsterBreed = Pick<TraitRecord<typeof MonsterTrait>, "kind" | "elite">;

export function createMonsterRig(
    { scene, animations }: LoadedModel,
    { kind, elite }: MonsterBreed,
): MonsterRig {
    const model = monsterModels[kind];
    const look = readMonsterLook(kind, elite);
    const size = elite === EliteModifier.None ? 1 : eliteSize;
    const object = clone(scene);
    const skin = createMonsterSkin(look);
    object.traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        mesh.castShadow = true;
        //  The bind pose's bounds miss a limb the clips swing out.
        mesh.frustumCulled = false;
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
                });
            return copy;
        });
        mesh.material = own.length === 1 ? own[0] : own;
    });
    if (model.eyeSprites)
        addEyeSprites({ object, sprites: model.eyeSprites, color: look.eyes });
    const shadow = new Mesh(readShadowGeometry(), readShadowMaterial());
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(model.shadowMetres * size);
    shadow.renderOrder = -1;
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
        shadow,
        shadowMetres: model.shadowMetres * size,
    };
}

export function disposeMonsterRig({ object, mixer, skin, shadow }: MonsterRig) {
    mixer.stopAllAction();
    mixer.uncacheRoot(object);
    shadow.removeFromParent();
    for (const material of [...skin.body, ...skin.eyes]) material.dispose();
}
