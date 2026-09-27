import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    VRM,
    VRMHumanBoneName,
    VRMSpringBoneCollider,
    VRMSpringBoneColliderShapeCapsule,
    VRMSpringBoneColliderShapeSphere,
} from "@pixiv/three-vrm";
import {
    VRMAnimation,
    createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";
import { AnimationMixer, Group, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it, vi } from "vitest";
import {
    extendVrmLoader,
    followGround,
    heroMotion,
    PoseState,
    prepareVrm,
    sizeArmColliders,
} from "@spawnite/engine";
import { AvatarId, avatars } from "../src/avatars";

const mmorpgFolder = resolve(import.meta.dirname, "..");

/** The path on disk of the file a Vite dev URL serves: `/@fs/` and its
 *  absolute path for a file outside the project, as the kit in this
 *  repository is, or its path from the project's root, alone or on the dev
 *  server's origin, as a kit or an engine installed under node_modules is. */
function resolveAssetPath(url: string) {
    const { pathname } = new URL(url, "http://localhost");
    return pathname.startsWith("/@fs/")
        ? fileURLToPath(pathname.replace(/^\/@fs\//, "file:///"))
        : join(mmorpgFolder, decodeURIComponent(pathname));
}

it("ships a model named for every avatar", () => {
    expect(Object.keys(avatars)).toEqual(Object.values(AvatarId));
    for (const [avatarId, body] of Object.entries(avatars)) {
        // Vitest receives Vite's dev URL; production uses a hashed asset URL.
        expect(body.model).toMatch(new RegExp(`/avatars/${avatarId}\\.vrm$`));
        expect(existsSync(resolveAssetPath(body.model)), body.model).toBe(true);
    }
});

async function loadAsset(path: string): Promise<Record<string, unknown>> {
    // The loader decodes textures through browser globals; no test reads them.
    vi.stubGlobal("self", globalThis);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({}));
    const loader = new GLTFLoader();
    //  Drei types its loader by its own GLTFLoader port; the register call
    //  is the same.
    extendVrmLoader(loader as unknown as Parameters<typeof extendVrmLoader>[0]);
    const file = new Uint8Array(readFileSync(resolveAssetPath(path)));
    const { userData } = await loader.parseAsync(file.buffer, "");
    return userData;
}

const FEET = new Vector3(3, 2, -4);
// Ground rising away from her feet on every side, so it rises behind her
// whichever way she faces.
const SLOPE = 0.15;

it.each([
    { name: "level", getHeightAt: () => FEET.y },
    {
        name: "sloped",
        getHeightAt: ({ x, z }: Pick<Vector3, "x" | "z">) =>
            FEET.y + SLOPE * Math.hypot(x - FEET.x, z - FEET.z),
    },
])("rests the hero's tail on $name ground", async (ground) => {
    //  Fris by name, not whichever body the heroine wears: her tail and its
    //  clearance are the subject here, and another body has neither.
    const { vrm } = await loadAsset(avatars[AvatarId.Fris].model);
    const { vrmAnimations } = await loadAsset(
        heroMotion.motions[PoseState.Idle],
    );
    const idle: unknown = Array.isArray(vrmAnimations)
        ? vrmAnimations[0]
        : undefined;
    if (!(vrm instanceof VRM) || !(idle instanceof VRMAnimation))
        throw new Error("The hero's model or idle has no VRM data.");
    prepareVrm(vrm, avatars[AvatarId.Fris]);
    followGround(vrm, ground);
    for (const joint of vrm.springBoneManager?.joints ?? []) {
        const grounds = joint.colliderGroups.filter((group) =>
            group.colliders.some(({ shape }) => shape.type === "ground"),
        );
        expect(grounds, joint.bone.name).toHaveLength(1);
        const obstacles = joint.colliderGroups.filter((group) =>
            group.colliders.some(({ shape }) => shape.type === "obstacles"),
        );
        expect(obstacles, joint.bone.name).toHaveLength(1);
    }
    const body = new Group();
    body.position.copy(FEET);
    body.add(vrm.scene);
    const mixer = new AnimationMixer(vrm.scene);
    mixer.clipAction(createVRMAnimationClip(idle, vrm)).play();
    // Two seconds of idle, for the tail to settle behind her.
    for (let frame = 0; frame < 120; frame++) {
        mixer.update(1 / 60);
        vrm.humanoid.update();
        vrm.scene.updateWorldMatrix(true, true);
        vrm.update(1 / 60);
    }
    // Only this pass refreshes a skinned mesh's bind inverse.
    body.updateMatrixWorld();

    const springBones = new Set(
        Array.from(vrm.springBoneManager?.joints ?? [], (joint) => joint.bone),
    );
    const vertex = new Vector3();
    let lowest = Infinity;
    vrm.scene.traverse((object) => {
        if (!(object instanceof SkinnedMesh)) return;
        const { skinIndex, skinWeight } = object.geometry.attributes;
        for (let index = 0; index < skinIndex.count; index++) {
            for (let slot = 0; slot < skinIndex.itemSize; slot++) {
                const bone =
                    object.skeleton.bones[skinIndex.getComponent(index, slot)];
                if (!skinWeight.getComponent(index, slot)) continue;
                if (!springBones.has(bone)) continue;
                object.localToWorld(object.getVertexPosition(index, vertex));
                lowest = Math.min(
                    lowest,
                    vertex.y - ground.getHeightAt(vertex),
                );
                break;
            }
        }
    });
    expect(lowest).toBeCloseTo(0, 2);
});

const armLimbs = [
    [VRMHumanBoneName.LeftUpperArm, VRMHumanBoneName.LeftLowerArm],
    [VRMHumanBoneName.RightUpperArm, VRMHumanBoneName.RightLowerArm],
    [VRMHumanBoneName.LeftLowerArm, VRMHumanBoneName.LeftHand],
    [VRMHumanBoneName.RightLowerArm, VRMHumanBoneName.RightHand],
] as const;

const armParts = [
    [VRMHumanBoneName.LeftUpperArm, "upperArm"],
    [VRMHumanBoneName.RightUpperArm, "upperArm"],
    [VRMHumanBoneName.LeftLowerArm, "lowerArm"],
    [VRMHumanBoneName.RightLowerArm, "lowerArm"],
    [VRMHumanBoneName.LeftHand, "hand"],
    [VRMHumanBoneName.RightHand, "hand"],
] as const;

it("gives the skirt's chains a collider over each arm, and nothing else one", async () => {
    //  Fris by name: the count below is her skirt's, and another body's cloth
    //  hangs in a different number of chains.
    const fris = avatars[AvatarId.Fris];
    const { vrm } = await loadAsset(fris.model);
    if (!(vrm instanceof VRM))
        throw new Error("The hero's model has no VRM data.");
    prepareVrm(vrm, fris);
    const wider = { upperArm: 0.09, lowerArm: 0.08, hand: 0.07 };

    let skirtJoints = 0;
    for (const radii of [fris.armColliders.radii, wider]) {
        sizeArmColliders(vrm, radii);
        for (const joint of vrm.springBoneManager?.joints ?? []) {
            const skirt = joint.bone.name.startsWith("Skirt_");
            if (skirt) skirtJoints++;
            for (const [bone, part] of armParts) {
                const node = vrm.humanoid.getRawBoneNode(bone);
                const onBone = joint.colliderGroups
                    .flatMap((group) => group.colliders)
                    .filter((collider) => collider.parent === node)
                    .map(({ shape }) =>
                        shape instanceof VRMSpringBoneColliderShapeCapsule ||
                        shape instanceof VRMSpringBoneColliderShapeSphere
                            ? shape.radius
                            : NaN,
                    );
                expect(onBone.includes(radii[part]), joint.bone.name).toBe(
                    skirt,
                );
            }
        }
    }
    // The skirt's own chains, twice over: a run that matched none would pass
    // every assertion above without reading a single skirt joint.
    expect(skirtJoints).toBe(2 * 14 * 4);

    // A capsule with no tail is a point at the shoulder, which is the gap
    // between the joints the model's own spheres already leave open.
    for (const [from, to] of armLimbs) {
        const bone = vrm.humanoid.getRawBoneNode(from)!;
        const capsules = bone.children.flatMap((child) =>
            child instanceof VRMSpringBoneCollider &&
            child.shape instanceof VRMSpringBoneColliderShapeCapsule
                ? [child.shape]
                : [],
        );
        expect(capsules, from).toHaveLength(1);
        const tail = capsules[0].tail.clone().applyMatrix4(bone.matrixWorld);
        const limb = vrm.humanoid
            .getRawBoneNode(to)!
            .getWorldPosition(new Vector3());
        expect(tail.distanceTo(limb), from).toBeLessThan(0.001);
    }
});

//  The only place a shipped body meets the code that prepares it. The story
//  that draws them is out of the runner, and the data tests read addresses
//  rather than models, so without this a record naming a chain its file does
//  not have, or a file re-exported with its hips back on the floor, reaches
//  the player and nothing else.
it.each(Object.entries(avatars))(
    "prepares %s from her own file",
    async (avatarId, avatar) => {
        const { vrm } = await loadAsset(avatar.model);
        if (!(vrm instanceof VRM))
            throw new Error(`${avatarId} has no VRM data.`);
        const { height } = prepareVrm(vrm, avatar);
        expect(height, "metres").toBeGreaterThan(1.4);
        expect(height, "metres").toBeLessThan(1.8);

        //  Her hips carry the clip's hip motion, so a body wearing them at
        //  ground level swings about its feet instead of its waist.
        const hips = vrm.humanoid.getRawBoneNode(VRMHumanBoneName.Hips);
        const waist = hips?.getWorldPosition(new Vector3()).y ?? 0;
        expect(waist / height, avatarId).toBeGreaterThan(0.4);

        const covered = Array.from(vrm.springBoneManager?.joints ?? [])
            .filter((joint) =>
                joint.colliderGroups.some((group) =>
                    group.colliders.some(
                        ({ shape }) =>
                            shape instanceof VRMSpringBoneColliderShapeCapsule,
                    ),
                ),
            )
            .map((joint) => joint.bone.name);
        expect(covered.length, avatarId).toBeGreaterThan(0);
        for (const bone of covered)
            expect(bone.startsWith(avatar.armColliders.bonePrefix)).toBe(true);
    },
);
